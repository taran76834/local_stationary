import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { getCanViewOrdersCustomers } from '@/lib/userMeta';

export default async function handler(req, res) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  // Sales users need the "View Orders & Website Customers" toggle enabled
  if (user.role === 'sales') {
    const allowed = await getCanViewOrdersCustomers(user.id);
    if (!allowed) return res.status(403).json({ message: 'Access denied.' });
  }

  if (req.method === 'GET') {
    try {
      const { q, status, payment_status } = req.query;

      let sql = `
        SELECT o.*, 
          COALESCE(i.item_count, 0) AS item_count,
          COALESCE(i.total_quantity, 0) AS total_quantity
        FROM fr_orders o
        LEFT JOIN (
          SELECT order_id, COUNT(*) AS item_count, SUM(quantity) AS total_quantity
          FROM fr_order_items
          GROUP BY order_id
        ) i ON o.id = i.order_id
        WHERE 1=1
      `;
      const params = [];

      if (q && q.trim()) {
        const term = `%${q.trim()}%`;
        sql += ` AND (
          o.order_number LIKE ? OR
          o.billing_first_name LIKE ? OR
          o.billing_last_name LIKE ? OR
          o.billing_email LIKE ? OR
          o.billing_phone LIKE ?
        )`;
        params.push(term, term, term, term, term);
      }

      if (status && status !== 'all') {
        sql += ` AND o.status = ?`;
        params.push(status);
      }

      if (payment_status && payment_status !== 'all') {
        sql += ` AND o.payment_status = ?`;
        params.push(payment_status);
      }

      sql += ` ORDER BY o.id DESC`;

      const orders = await query(sql, params);
      return res.status(200).json(orders);
    } catch (err) {
      console.error('Error fetching orders:', err);
      return res.status(500).json({ message: 'Server error fetching orders.' });
    }
  }

  return res.status(405).end();
}
