import { query } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export default async function handler(req, res) {
  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ message: 'Not authenticated.' });

  if (req.method === 'GET') {
    try {
      const rows = await query(`
        SELECT u.*, COUNT(pu.product_id) AS product_count
        FROM units u
        LEFT JOIN product_units pu ON pu.unit_id = u.id
        GROUP BY u.id
        ORDER BY u.name ASC
      `);
      return res.status(200).json(rows);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: 'Server error.' });
    }
  }

  if (req.method === 'POST') {
    const { name } = req.body;
    const trimmed = String(name || '').trim();
    if (!trimmed) return res.status(400).json({ message: 'Unit name is required.' });

    try {
      // Check for case-insensitive duplicate unit name
      const existing = await query('SELECT id FROM units WHERE LOWER(name) = LOWER(?)', [trimmed]);
      if (existing.length > 0) {
        return res.status(409).json({ message: `Unit '${trimmed}' already exists.` });
      }

      const result = await query('INSERT INTO units (name) VALUES (?)', [trimmed]);
      return res.status(201).json({ id: result.insertId, name: trimmed });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ message: `Unit '${trimmed}' already exists.` });
      }
      console.error(err);
      return res.status(500).json({ message: 'Server error.' });
    }
  }

  return res.status(405).end();
}
