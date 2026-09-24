import { query, getPool } from '@/lib/db';
import { getAuthUser, canAccessStore } from '@/lib/auth';
import { getUserStores, getStorePermissions } from '@/lib/userMeta';

export default async function handler(req, res) {
  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ message: 'Not authenticated.' });

  // GET /api/store-products?store_id=1
  if (req.method === 'GET') {
    const { store_id } = req.query;
    try {
      const stockItemQuery = store_id ? `
        SELECT si.product_id, si.variation_id, pvp.attributes AS vari_attribute,
               SUM(CASE WHEN si.status = 'available' THEN 1 WHEN si.status = 'oversold' THEN -1 ELSE 0 END) AS stock
        FROM stock_items_new si
        JOIN products p ON si.product_id = p.id
        LEFT JOIN product_variation_prices pvp ON si.variation_id = pvp.id
        WHERE si.store_id = ? AND si.status IN ('available', 'oversold')
        GROUP BY si.product_id, si.variation_id, pvp.attributes
      ` : `
        SELECT si.product_id, si.variation_id, pvp.attributes AS vari_attribute,
               SUM(CASE WHEN si.status = 'available' THEN 1 WHEN si.status = 'oversold' THEN -1 ELSE 0 END) AS stock
        FROM stock_items_new si
        JOIN products p ON si.product_id = p.id
        LEFT JOIN product_variation_prices pvp ON si.variation_id = pvp.id
        WHERE si.status IN ('available', 'oversold')
        GROUP BY si.product_id, si.variation_id, pvp.attributes
      `;

      const params = store_id ? [store_id] : [];

      const [products, stockItemRows] = await Promise.all([
        query(`SELECT id AS product_id, name, barcode, price, product_type FROM products WHERE delete_status IS NULL ORDER BY name ASC`),
        query(stockItemQuery, params)
      ]);

      const flavorStockMap = {};
      const totalStockMap = {};

      const addVariationStock = (pid, vid, variAttr, qty) => {
        if (!flavorStockMap[pid]) flavorStockMap[pid] = [];
        const existing = flavorStockMap[pid].find(item => {
          if (vid && item.variation_id && Number(item.variation_id) === Number(vid)) return true;
          if (variAttr && item.vari_attribute) {
            const s1 = typeof variAttr === 'string' ? variAttr.trim() : JSON.stringify(variAttr);
            const s2 = typeof item.vari_attribute === 'string' ? item.vari_attribute.trim() : JSON.stringify(item.vari_attribute);
            if (s1 === s2) return true;
          }
          return false;
        });

        if (existing) {
          existing.stock += qty;
          if (!existing.variation_id && vid) existing.variation_id = vid;
          if (!existing.vari_attribute && variAttr) existing.vari_attribute = variAttr;
        } else {
          flavorStockMap[pid].push({
            variation_id: vid || null,
            vari_attribute: variAttr || null,
            stock: qty
          });
        }
      };

      // Map from stock_items_new (ground truth for physical stock and oversold deficit)
      stockItemRows.forEach(r => {
        const pid = r.product_id;
        const vid = r.variation_id;
        const attr = r.vari_attribute;
        const qty = parseInt(r.stock) || 0;

        totalStockMap[pid] = (totalStockMap[pid] || 0) + qty;
        if (vid || attr) {
          addVariationStock(pid, vid, attr, qty);
        }
      });

      const result = products.map(p => ({
        ...p,
        stock: totalStockMap[p.product_id] !== undefined ? totalStockMap[p.product_id] : 0,
        flavor_stocks: flavorStockMap[p.product_id] || []
      }));

      return res.status(200).json(result);
    } catch (err) {
      console.error('[store-products GET]', err);
      return res.status(500).json({ message: 'Server error.' });
    }
  }

  // POST — add stock for a product in a store
  if (req.method === 'POST') {
    const { store_id, product_id, expiry_batches } = req.body;
    if (!store_id || !product_id) return res.status(400).json({ message: 'store_id and product_id required.' });

    const hasAccess = await canAccessStore(user, store_id, async (uid) => {
      if (user.role === 'sales') {
        const storePerms = await getStorePermissions(uid);
        return Object.keys(storePerms).map(Number);
      }
      return getUserStores(uid);
    });
    if (!hasAccess) {
      return res.status(403).json({ message: 'You do not have permission to edit stock for this store.' });
    }

    const pool = getPool();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const batches = Array.isArray(expiry_batches) ? expiry_batches : [];
      const totalQuantity = batches.reduce((s, b) => s + (parseInt(b.qty) || 0), 0);

      const orderNumber = `DIR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const [orderResult] = await conn.execute(
        `INSERT INTO purchase_orders (order_number, store_id, created_by, status, total_amount, notes)
         VALUES (?, ?, ?, 'direct', 0, ?)`,
        [orderNumber, store_id, user.id, `Direct stock addition: ${totalQuantity} unit(s) of product #${product_id}`]
      );
      const orderId = orderResult.insertId;

      for (const batch of batches) {
        const qty = parseInt(batch.qty) || 0;
        const expiryDate = batch.expiry_date || null;

        if (qty <= 0) continue;
        if (qty > 2000) {
          await conn.rollback();
          return res.status(400).json({ message: `Quantity cannot exceed 2,000 units per batch. Got: ${qty}` });
        }

        const variationId = batch.variation_id ? parseInt(batch.variation_id) : (batch.var_key && !isNaN(parseInt(batch.var_key)) ? parseInt(batch.var_key) : null);

        // Add item to purchase_order_items
        await conn.execute(
          `INSERT INTO purchase_order_items (purchase_order_id, product_id, variation_id, quantity, unit_cost)
           VALUES (?, ?, ?, ?, 0)`,
          [orderId, product_id, variationId, qty]
        );

        // Reconcile existing oversold shortfall items first
        let oversoldSql = `SELECT id FROM stock_items_new WHERE store_id = ? AND product_id = ? AND status = 'oversold'`;
        const oversoldParams = [store_id, product_id];
        if (variationId) {
          oversoldSql += ` AND variation_id = ?`;
          oversoldParams.push(variationId);
        } else {
          oversoldSql += ` AND (variation_id IS NULL OR variation_id = 0)`;
        }
        oversoldSql += ` ORDER BY created_at ASC LIMIT ?`;
        oversoldParams.push(String(qty));

        const [oversoldRows] = await conn.execute(oversoldSql, oversoldParams);
        const reconcileCount = oversoldRows.length;

        if (reconcileCount > 0) {
          const oversoldIds = oversoldRows.map(r => r.id);
          const ph = oversoldIds.map(() => '?').join(',');
          await conn.execute(
            `UPDATE stock_items_new SET status = 'sold', purchase_order_id = ?, expiry_date = ? WHERE id IN (${ph})`,
            [orderId, expiryDate, ...oversoldIds]
          );
        }

        const remainingQty = qty - reconcileCount;
        if (remainingQty > 0) {
          const values = Array(remainingQty).fill('(?, ?, ?, ?, ?, \'available\')').join(',');
          const params = [];
          for (let i = 0; i < remainingQty; i++) params.push(store_id, product_id, variationId, orderId, expiryDate);

          await conn.execute(
            `INSERT INTO stock_items_new (store_id, product_id, variation_id, purchase_order_id, expiry_date, status) VALUES ${values}`,
            params
          );
        }
      }

      await conn.commit();
      return res.status(200).json({ message: 'Stock updated.' });
    } catch (err) {
      await conn.rollback();
      console.error(err);
      return res.status(500).json({ message: 'Server error.' });
    } finally {
      conn.release();
    }
  }

  return res.status(405).end();
}
