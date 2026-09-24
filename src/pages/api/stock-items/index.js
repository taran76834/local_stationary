import { query, getPool } from '@/lib/db';
import { getAuthUser, canAccessStore } from '@/lib/auth';
import { getUserStores, getStorePermissions } from '@/lib/userMeta';

// Role-aware store lookup: sales uses store_permissions, everyone else uses assigned_stores
async function getUserStoreIds(user) {
  if (user.role === 'sales') {
    const perms = await getStorePermissions(user.id);
    return Object.keys(perms).map(Number);
  }
  return getUserStores(user.id);
}

export default async function handler(req, res) {
  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ message: 'Not authenticated.' });

  // GET — grouped stock view
  if (req.method === 'GET') {
    const { store_id, product_id, status, expiring_soon, expired } = req.query;

    let userStores = [];
    if (user.role !== 'admin') {
      if (user.role === 'manager') {
        userStores = await getUserStores(user.id);
        if (!userStores || userStores.length === 0) {
          return res.status(200).json([]);
        }
        if (store_id && !userStores.map(Number).includes(Number(store_id))) {
          return res.status(403).json({ message: 'You do not have permission to view stock for this store.' });
        }
      } else if (user.role !== 'sales') {
        userStores = await getUserStores(user.id);
        if (!userStores || userStores.length === 0) {
          return res.status(200).json([]);
        }
        if (store_id && !userStores.map(Number).includes(Number(store_id))) {
          return res.status(403).json({ message: 'You do not have permission to view stock for this store.' });
        }
      }
    }

    let sql = `
      SELECT
        p.id          AS product_id,
        p.name        AS product_name,
        p.product_type,
        s.id          AS store_id,
        s.name        AS store_name,
        si.variation_id,
        pvp.attributes AS variation_attributes,
        si.expiry_date,
        si.status,
        COUNT(*)      AS qty,
        MIN(si.created_at)         AS created_at,
        MIN(si.purchase_order_id)  AS purchase_order_id
      FROM stock_items_new si
      JOIN products p ON si.product_id = p.id AND p.delete_status IS NULL
      JOIN stores   s ON si.store_id   = s.id
      LEFT JOIN product_variation_prices pvp ON si.variation_id = pvp.id
      WHERE 1=1
    `;
    const params = [];

    if (store_id) {
      sql += ' AND si.store_id = ?';
      params.push(store_id);
    } else if (user.role !== 'admin' && user.role !== 'sales' && userStores.length > 0) {
      const placeholders = userStores.map(() => '?').join(',');
      sql += ` AND si.store_id IN (${placeholders})`;
      params.push(...userStores);
    }

    if (product_id) { sql += ' AND si.product_id = ?'; params.push(product_id); }

    let effectiveStatus = status;
    if (user.role === 'sales' && status === 'sold') {
      effectiveStatus = 'available';
    }
    if (effectiveStatus) {
      sql += ' AND si.status = ?';
      params.push(effectiveStatus);
    } else {
      sql += " AND si.status = 'available'";
    }
    if (expiring_soon === '1') {
      sql += ' AND si.expiry_date IS NOT NULL AND si.expiry_date >= CURDATE() AND si.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)';
    }
    if (expired === '1') {
      sql += ' AND si.expiry_date IS NOT NULL AND si.expiry_date < CURDATE()';
    }
    sql += ' GROUP BY p.id, p.name, p.product_type, s.id, s.name, si.variation_id, pvp.attributes, si.expiry_date, si.status';
    sql += ' ORDER BY si.expiry_date ASC, p.name ASC';
    sql += ' LIMIT 500';

    try {
      const rows = await query(sql, params);
      return res.status(200).json(rows);
    } catch (err) {
      console.error('[stock-items GET]', err.message);
      return res.status(500).json({ message: err.message });
    }
  }

  // POST — manually add stock units
  if (req.method === 'POST') {
    const { store_id, product_id, variation_id, quantity, expiry_date } = req.body;
    const qtyNum = parseInt(quantity) || 0;
    if (!store_id || !product_id || !quantity || qtyNum < 1)
      return res.status(400).json({ message: 'store_id, product_id and quantity are required.' });

    const hasAccess = await canAccessStore(user, store_id, () => getUserStoreIds(user));
    if (!hasAccess) {
      return res.status(403).json({ message: 'You do not have permission to add stock for this store.' });
    }

    const pool = getPool();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const expiry = expiry_date || null;
      const vId = variation_id ? parseInt(variation_id) : null;

      const orderNumber = `DIR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const [orderResult] = await conn.execute(
        `INSERT INTO purchase_orders (order_number, store_id, created_by, status, total_amount, notes)
         VALUES (?, ?, ?, 'direct', 0, ?)`,
        [orderNumber, store_id, user.id, `Direct stock addition: ${qtyNum} unit(s) of product #${product_id}`]
      );
      const orderId = orderResult.insertId;

      await conn.execute(
        `INSERT INTO purchase_order_items (purchase_order_id, product_id, variation_id, quantity, unit_cost)
         VALUES (?, ?, ?, ?, 0)`,
        [orderId, product_id, vId, qtyNum]
      );

      // Reconcile existing oversold shortfall items first
      let oversoldSql = `SELECT id FROM stock_items_new WHERE store_id = ? AND product_id = ? AND status = 'oversold'`;
      const oversoldParams = [store_id, product_id];
      if (vId) {
        oversoldSql += ` AND variation_id = ?`;
        oversoldParams.push(vId);
      } else {
        oversoldSql += ` AND (variation_id IS NULL OR variation_id = 0)`;
      }
      oversoldSql += ` ORDER BY created_at ASC LIMIT ?`;
      oversoldParams.push(String(qtyNum));

      const [oversoldRows] = await conn.execute(oversoldSql, oversoldParams);
      const reconcileCount = oversoldRows.length;

      if (reconcileCount > 0) {
        const oversoldIds = oversoldRows.map(r => r.id);
        const ph = oversoldIds.map(() => '?').join(',');
        await conn.execute(
          `UPDATE stock_items_new SET status = 'sold', purchase_order_id = ?, expiry_date = ? WHERE id IN (${ph})`,
          [orderId, expiry, ...oversoldIds]
        );
      }

      const remainingQty = qtyNum - reconcileCount;
      if (remainingQty > 0) {
        for (let i = 0; i < remainingQty; i++) {
          await conn.execute(
            `INSERT INTO stock_items_new (store_id, product_id, variation_id, purchase_order_id, expiry_date, status) VALUES (?, ?, ?, ?, ?, 'available')`,
            [store_id, product_id, vId, orderId, expiry]
          );
        }
      }

      await conn.commit();
      return res.status(201).json({ message: `${quantity} unit(s) added to stock.` });
    } catch (err) {
      await conn.rollback();
      console.error(err);
      return res.status(500).json({ message: 'Server error.' });
    } finally {
      conn.release();
    }
  }

  // PATCH — update expiry_date for a group (product + variation + store + old expiry + status)
  if (req.method === 'PATCH') {
    const { store_id, product_id, variation_id, old_expiry, status, new_expiry } = req.body;
    if (!store_id || !product_id)
      return res.status(400).json({ message: 'store_id and product_id are required.' });

    const hasAccess = await canAccessStore(user, store_id, () => getUserStoreIds(user));
    if (!hasAccess) {
      return res.status(403).json({ message: 'You do not have permission to edit stock for this store.' });
    }

    const oldVal = old_expiry || null;
    const newVal = new_expiry || null;
    const vId = variation_id ? parseInt(variation_id) : null;

    let sql = `UPDATE stock_items_new SET expiry_date = ? WHERE store_id = ? AND product_id = ?`;
    const params = [newVal, store_id, product_id];

    if (vId) { sql += ` AND variation_id = ?`; params.push(vId); }
    else { sql += ` AND variation_id IS NULL`; }

    if (oldVal === null) { sql += ` AND expiry_date IS NULL`; }
    else { sql += ` AND expiry_date = ?`; params.push(oldVal); }

    sql += ` AND status = ?`;
    params.push(status || 'available');

    await query(sql, params);
    return res.status(200).json({ message: 'Expiry date updated.' });
  }

  // DELETE — remove a group of stock items (product + variation + store + expiry + status)
  if (req.method === 'DELETE') {
    const { store_id, product_id, variation_id, expiry_date, status } = req.body;
    if (!store_id || !product_id)
      return res.status(400).json({ message: 'store_id and product_id are required.' });

    const hasAccess = await canAccessStore(user, store_id, () => getUserStoreIds(user));
    if (!hasAccess) {
      return res.status(403).json({ message: 'You do not have permission to delete stock for this store.' });
    }

    const pool = getPool();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const expiry = expiry_date || null;
      const st     = status || 'available';
      const vId    = variation_id ? parseInt(variation_id) : null;

      let countSql = `SELECT COUNT(*) AS n FROM stock_items_new WHERE store_id=? AND product_id=? AND status=?`;
      const countParams = [store_id, product_id, st];
      if (vId) { countSql += ` AND variation_id=?`; countParams.push(vId); }
      else { countSql += ` AND variation_id IS NULL`; }
      if (expiry === null) { countSql += ` AND expiry_date IS NULL`; }
      else { countSql += ` AND expiry_date=?`; countParams.push(expiry); }

      const [cnt] = await conn.execute(countSql, countParams);
      const n = cnt[0].n;

      if (n > 0) {
        const orderNumber = `DIR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const [orderResult] = await conn.execute(
          `INSERT INTO purchase_orders (order_number, store_id, created_by, status, total_amount, notes)
           VALUES (?, ?, ?, 'direct', 0, ?)`,
          [orderNumber, store_id, user.id, `Direct stock removal: -${n} unit(s) of product #${product_id}`]
        );
        const orderId = orderResult.insertId;

        await conn.execute(
          `INSERT INTO purchase_order_items (purchase_order_id, product_id, variation_id, quantity, unit_cost)
           VALUES (?, ?, ?, ?, 0)`,
          [orderId, product_id, vId, -n]
        );
      }

      let delSql = `DELETE FROM stock_items_new WHERE store_id=? AND product_id=? AND status=?`;
      const delParams = [store_id, product_id, st];
      if (vId) { delSql += ` AND variation_id=?`; delParams.push(vId); }
      else { delSql += ` AND variation_id IS NULL`; }
      if (expiry === null) { delSql += ` AND expiry_date IS NULL`; }
      else { delSql += ` AND expiry_date=?`; delParams.push(expiry); }

      await conn.execute(delSql, delParams);

      await conn.commit();
      return res.status(200).json({ message: `${n} unit(s) removed.` });
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
