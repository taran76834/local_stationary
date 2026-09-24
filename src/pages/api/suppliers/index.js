import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export default async function handler(req, res) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  if (req.method === 'GET') {
    const rows = await query('SELECT * FROM suppliers ORDER BY name ASC');
    return res.status(200).json(rows);
  }

  if (req.method === 'POST') {
    const { name, contact, phone, email, address } = req.body;
    if (!name) return res.status(400).json({ message: 'Supplier name is required.' });
    try {
      const result = await query(
        'INSERT INTO suppliers (name, contact, phone, email, address) VALUES (?,?,?,?,?)',
        [name, contact || null, phone || null, email || null, address || null]
      );
      return res.status(201).json({ id: result.insertId, name });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: 'Server error.' });
    }
  }

  return res.status(405).end();
}
