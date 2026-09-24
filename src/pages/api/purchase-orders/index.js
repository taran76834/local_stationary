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

  if (req.method === 'GET') {
    try {
      const orders = await query(`
        SELECT po.*, s.name AS supplier_name, st.name AS store_name, u.name AS created_by_name
        FROM purchase_orders po
        LEFT JOIN suppliers s  ON po.supplier_id = s.id
        LEFT JOIN stores    st ON po.store_id    = st.id
        LEFT JOIN users     u  ON po.created_by  = u.id
        ORDER BY po.ordered_at DESC
      `);

      // Filter by store access: admin sees all, sales uses store_permissions, others use assigned_stores
      const filtered = user.role === 'admin'
        ? orders
        : orders.filter(o => canAccessStore(user, o.store_id, (uid) => getUserStoreIds(user)));

      return res.status(200).json(filtered);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: 'Server error.' });
    }
  }

  if (req.method === 'POST') {
    const { store_id, supplier_id, items, notes } = req.body;

    if (!store_id || !Array.isArray(items) || items.length === 0)
      return res.status(400).json({ message: 'Store and items are required.' });

    // Validate store access
    const hasAccess = await canAccessStore(user, store_id, (uid) => getUserStoreIds(user));
    if (!hasAccess) {
      return res.status(403).json({ message: 'You do not have permission to create product receipts for this store.' });
    }

    const total = items.reduce((s, i) => s + i.quantity * i.unit_cost, 0);
    const orderNumber = 'PO-' + Date.now().toString().slice(-6);

    const pool = getPool();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [orderResult] = await conn.execute(
        `INSERT INTO purchase_orders (order_number, store_id, created_by, supplier_id, total_amount, notes, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [orderNumber, store_id, user.id, supplier_id || null, total, notes || null, 'pending']
      );
      const orderId = orderResult.insertId;

      for (const item of items) {
        const variationId = item.variation_id ? parseInt(item.variation_id) : null;
        const expiryDateVal = item.expiry_date || item.expiryDate || null;
        const variAttrVal = item.vari_attribute || null;

        await conn.execute(
          `INSERT INTO purchase_order_items (purchase_order_id, product_id, variation_id, vari_attribute, quantity, unit_cost, expiry_date)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [orderId, item.product_id, variationId, variAttrVal, item.quantity, item.unit_cost, expiryDateVal]
        );
      }

      await conn.commit();
      return res.status(201).json({ message: 'Purchase order created.', id: orderId, order_number: orderNumber });
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
