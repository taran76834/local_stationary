import { query, getPool } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { getUserStores, getStorePermissions } from '@/lib/userMeta';

export default async function handler(req, res) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  const { id } = req.query;

  if (req.method === 'GET') {
    try {
      const bills = await query(`
        SELECT b.*, s.name AS store_name, u.name AS created_by_name
        FROM bills b
        LEFT JOIN stores s ON b.store_id = s.id
        LEFT JOIN users  u ON b.created_by = u.id
        WHERE b.id = ?
      `, [id]);
      if (!bills[0]) return res.status(404).json({ message: 'Bill not found.' });

      const items = await query(`
        SELECT bi.*, p.name AS product_name, pvp.attributes AS variation_attributes
        FROM bill_items bi
        JOIN products p ON bi.product_id = p.id
        LEFT JOIN product_variation_prices pvp ON bi.variation_id = pvp.id
        WHERE bi.bill_id = ?
      `, [id]);

      const parsedItems = items.map(item => {
        let attrs = item.variation_attributes;
        if (typeof attrs === 'string') {
          try { attrs = JSON.parse(attrs); } catch (e) {}
        }
        return { ...item, variation_attributes: attrs };
      });

      return res.status(200).json({ ...bills[0], items: parsedItems });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: 'Server error.' });
    }
  }

  if (req.method === 'PATCH') {
    const { status } = req.body;
    if (!['draft', 'paid', 'cancelled'].includes(status))
      return res.status(400).json({ message: 'Invalid status.' });

    const pool = getPool();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [bills] = await conn.execute('SELECT * FROM bills WHERE id = ?', [id]);
      const bill = bills[0];
      if (!bill) { await conn.rollback(); return res.status(404).json({ message: 'Bill not found.' }); }

      // Non-admin users can only cancel bills from their own assigned stores
      if (user.role !== 'admin') {
        let userStoreIds = [];
        if (user.role === 'sales') {
          const storePerms = await getStorePermissions(user.id);
          userStoreIds = Object.keys(storePerms).map(Number);
        } else {
          userStoreIds = await getUserStores(user.id);
        }
        if (bill.store_id && !userStoreIds.includes(Number(bill.store_id))) {
          await conn.rollback();
          return res.status(403).json({ message: 'You do not have permission to modify this bill.' });
        }
      }

      // Restore stock on cancel
      if (status === 'cancelled' && bill.status !== 'cancelled') {
        const [items] = await conn.execute('SELECT * FROM bill_items WHERE bill_id = ?', [id]);
        for (const item of items) {
          if (bill.store_id) {
            // Delete oversold deficit units created by this bill item
            await conn.execute(`
              DELETE FROM stock_items_new WHERE bill_item_id = ? AND status = 'oversold'
            `, [item.id]);

            // Restore individual stock_items_new units back to available
            await conn.execute(`
              UPDATE stock_items_new SET status = 'available', bill_item_id = NULL
              WHERE bill_item_id = ? AND status = 'sold'
            `, [item.id]);
          }
        }
      }

      await conn.execute('UPDATE bills SET status = ? WHERE id = ?', [status, id]);
      await conn.commit();
      return res.status(200).json({ message: 'Bill updated.' });
    } catch (err) {
      await conn.rollback();
      console.error(err);
      return res.status(500).json({ message: 'Server error.' });
    } finally {
      conn.release();
    }
  }

  if (req.method === 'DELETE') {
    const pool = getPool();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [items] = await conn.execute('SELECT id FROM bill_items WHERE bill_id = ?', [id]);
      for (const item of items) {
        await conn.execute(`DELETE FROM stock_items_new WHERE bill_item_id = ? AND status = 'oversold'`, [item.id]);
        await conn.execute(`UPDATE stock_items_new SET status = 'available', bill_item_id = NULL WHERE bill_item_id = ? AND status = 'sold'`, [item.id]);
      }
      await conn.execute('DELETE FROM bills WHERE id = ?', [id]);
      await conn.commit();
      return res.status(200).json({ message: 'Bill deleted.' });
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
