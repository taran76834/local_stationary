import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export default async function handler(req, res) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  if (req.method === 'GET') {
    try {
      const rows = await query(`
        SELECT f.*, COUNT(pf.product_id) AS product_count
        FROM flavors f
        LEFT JOIN product_flavors pf ON pf.flavor_id = f.id
        GROUP BY f.id
        ORDER BY f.name ASC
      `);
      return res.status(200).json(rows);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: 'Server error.' });
    }
  }

  if (req.method === 'POST') {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'Name is required.' });
    try {
      const result = await query('INSERT INTO flavors (name) VALUES (?)', [name]);
      return res.status(201).json({ id: result.insertId, name });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Flavor already exists.' });
      return res.status(500).json({ message: 'Server error.' });
    }
  }

  return res.status(405).end();
}
