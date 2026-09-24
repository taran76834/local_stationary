import { query, getPool } from '@/lib/db';
import { requireAdmin, canAccessStore } from '@/lib/auth';
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
  const user = await requireAdmin(req, res);
  if (!user) return;

  const { id } = req.query;

  if (req.method === 'GET') {
    try {
      const orders = await query(`
        SELECT po.*, s.name AS supplier_name, st.name AS store_name, u.name AS created_by_name
        FROM purchase_orders po
        LEFT JOIN suppliers s  ON po.supplier_id = s.id
        LEFT JOIN stores    st ON po.store_id    = st.id
        LEFT JOIN users     u  ON po.created_by  = u.id
        WHERE po.id = ?
      `, [id]);
      if (!orders[0]) return res.status(404).json({ message: 'Order not found.' });

      const hasAccess = await canAccessStore(user, orders[0].store_id, (uid) => getUserStoreIds(user));
      if (!hasAccess) {
        return res.status(403).json({ message: 'You do not have permission to view product receipts for this store.' });
      }

      const items = await query(`
        SELECT poi.*, p.name AS product_name, p.product_type, pvp.attributes AS variation_attributes
        FROM purchase_order_items poi
        JOIN products p ON poi.product_id = p.id
        LEFT JOIN product_variation_prices pvp ON poi.variation_id = pvp.id
        WHERE poi.purchase_order_id = ?
      `, [id]);

      return res.status(200).json({ ...orders[0], items });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: 'Server error.' });
    }
  }

  // PATCH — update status
  if (req.method === 'PATCH') {
    const { status } = req.body;

    if (!['pending', 'received', 'cancelled'].includes(status))
      return res.status(400).json({ message: 'Invalid status.' });

    const pool = getPool();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [orders] = await conn.execute('SELECT * FROM purchase_orders WHERE id = ?', [id]);
      const order = orders[0];
      if (!order) { await conn.rollback(); return res.status(404).json({ message: 'Order not found.' }); }

      const hasAccess = await canAccessStore(user, order.store_id, (uid) => getUserStoreIds(user));
      if (!hasAccess) {
        await conn.rollback();
        return res.status(403).json({ message: 'You do not have permission to update product receipts for this store.' });
      }

      if (order.status === status) {
        await conn.rollback();
        return res.status(400).json({ message: `Order is already ${status}.` });
      }

      // If approving (receiving): add to stock AND record expiry dates for batches
      if (status === 'received' && order.status !== 'received') {
        const [items] = await conn.execute(
          'SELECT * FROM purchase_order_items WHERE purchase_order_id = ?',
          [id]
        );

        for (const item of items) {
          const qty = parseInt(item.quantity) || 0;
          if (qty <= 0) continue;
          const expiryDate = item.expiry_date ? String(item.expiry_date).slice(0, 10) : null;
          const variationId = item.variation_id ? parseInt(item.variation_id) : null;


          // 2. Reconcile oversold deficit units first, then bulk insert remaining as available
          if (qty <= 2000) {
            let oversoldSql = `SELECT id FROM stock_items_new WHERE store_id = ? AND product_id = ? AND status = 'oversold'`;
            const oversoldParams = [order.store_id, item.product_id];
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
                [order.id, expiryDate, ...oversoldIds]
              );
            }

            const remainingQty = qty - reconcileCount;
            if (remainingQty > 0) {
              const values = Array(remainingQty).fill('(?, ?, ?, ?, ?, \'available\')').join(',');
              const params = [];
              for (let i = 0; i < remainingQty; i++) {
                params.push(order.store_id, item.product_id, variationId, order.id, expiryDate);
              }

              await conn.execute(
                `INSERT INTO stock_items_new (store_id, product_id, variation_id, purchase_order_id, expiry_date, status) VALUES ${values}`,
                params
              );
            }
          }
        }
      }

      await conn.execute('UPDATE purchase_orders SET status = ? WHERE id = ?', [status, id]);

      await conn.commit();
      return res.status(200).json({ message: `Order status updated to ${status}.` });
    } catch (err) {
      await conn.rollback();
      console.error(err);
      return res.status(500).json({ message: 'Server error.' });
    } finally {
      conn.release();
    }
  }

  if (req.method === 'DELETE') {
    await query('DELETE FROM purchase_orders WHERE id = ?', [id]);
    return res.status(200).json({ message: 'Order deleted.' });
  }

  return res.status(405).end();
}
