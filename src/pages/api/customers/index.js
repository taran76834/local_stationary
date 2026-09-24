import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export default async function handler(req, res) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  // GET — list all customers (optionally filter by ?q=search)
  if (req.method === 'GET') {
    try {
      const { q } = req.query;
      let rows;
      if (q && q.trim()) {
        const like = `%${q.trim()}%`;
        rows = await query(
          `SELECT * FROM customers
           WHERE name LIKE ? OR phone LIKE ?
           ORDER BY name ASC LIMIT 50`,
          [like, like]
        );
      } else {
        rows = await query('SELECT * FROM customers ORDER BY name ASC');
      }
      return res.status(200).json(rows);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: 'Server error.' });
    }
  }

  // POST — create a new customer
  if (req.method === 'POST') {
    const { name, phone } = req.body;
    if (!name || !name.trim())
      return res.status(400).json({ message: 'Customer name is required.' });
    try {
      // Upsert: if same phone exists, return existing record
      if (phone && phone.trim()) {
        const existing = await query(
          'SELECT * FROM customers WHERE phone = ? LIMIT 1',
          [phone.trim()]
        );
        if (existing.length > 0) {
          return res.status(200).json(existing[0]);
        }
      }
      const result = await query(
        'INSERT INTO customers (name, phone) VALUES (?, ?)',
        [name.trim(), phone?.trim() || null]
      );
      const created = await query('SELECT * FROM customers WHERE id = ?', [result.insertId]);
      return res.status(201).json(created[0]);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: 'Server error.' });
    }
  }

  return res.status(405).end();
}
