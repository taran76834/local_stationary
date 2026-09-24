import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { getCanViewOrdersCustomers } from '@/lib/userMeta';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  // Sales users need the "View Orders & Website Customers" toggle enabled
  if (user.role === 'sales') {
    const allowed = await getCanViewOrdersCustomers(user.id);
    if (!allowed) return res.status(403).json({ message: 'Access denied.' });
  }

  // GET website customers list
  if (req.method === 'GET') {
    try {
      const { q } = req.query;

      let sql = `
        SELECT c.*,
          COALESCE(o.total_orders, 0) AS total_orders,
          COALESCE(o.total_spent, 0.00) AS total_spent,
          o.last_order_date
        FROM fr_customers c
        LEFT JOIN (
          SELECT customer_id, 
            COUNT(*) AS total_orders, 
            SUM(total_amount) AS total_spent,
            MAX(created_at) AS last_order_date
          FROM fr_orders
          WHERE customer_id IS NOT NULL
          GROUP BY customer_id
        ) o ON c.id = o.customer_id
        WHERE 1=1
      `;
      const params = [];

      if (q && q.trim()) {
        const term = `%${q.trim()}%`;
        sql += ` AND (
          c.name LIKE ? OR
          c.email LIKE ? OR
          c.phone LIKE ?
        )`;
        params.push(term, term, term);
      }

      sql += ` ORDER BY c.id DESC`;

      const customers = await query(sql, params);
      return res.status(200).json(customers);
    } catch (err) {
      console.error('Error fetching website customers:', err);
      return res.status(500).json({ message: 'Server error fetching website customers.' });
    }
  }

  // POST create new website customer
  if (req.method === 'POST') {
    try {
      const { name, email, phone, password } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ message: 'Customer name is required.' });
      }
      if (!email || !email.trim()) {
        return res.status(400).json({ message: 'Customer email is required.' });
      }

      // Check existing email
      const existing = await query(
        'SELECT id FROM fr_customers WHERE email = ? LIMIT 1',
        [email.trim().toLowerCase()]
      );
      if (existing.length) {
        return res.status(400).json({ message: 'A customer with this email already exists.' });
      }

      const defaultPass = password || '123456';
      const hashedPassword = await bcrypt.hash(defaultPass, 10);

      const result = await query(
        `INSERT INTO fr_customers (name, email, password, phone, created_at, updated_at) 
         VALUES (?, ?, ?, ?, NOW(), NOW())`,
        [name.trim(), email.trim().toLowerCase(), hashedPassword, phone?.trim() || null]
      );

      const created = await query('SELECT * FROM fr_customers WHERE id = ?', [result.insertId]);
      return res.status(201).json(created[0]);
    } catch (err) {
      console.error('Error creating website customer:', err);
      return res.status(500).json({ message: 'Server error creating customer.' });
    }
  }

  return res.status(405).end();
}
