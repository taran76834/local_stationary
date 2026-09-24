import { query } from '../../../lib/db';
import { getAuthUser, canManageProductsCheck, getCanManageProducts } from '../../../lib/auth';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const rows = await query(`SELECT id, name, created_at FROM variation_types ORDER BY id ASC`);
      return res.status(200).json(rows);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: 'Server error.' });
    }
  }

  if (req.method === 'POST') {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ message: 'Unauthorized.' });

    if (user.role === 'sales') {
      user.canManageProducts = await getCanManageProducts(user.id);
    }
    if (!canManageProductsCheck(user)) return res.status(403).json({ message: 'Admin access required.' });

    const { name } = req.body;
    const trimmed = String(name || '').trim();
    if (!trimmed) return res.status(400).json({ message: 'Variation type name is required.' });

    try {
      await query(`INSERT IGNORE INTO variation_types (name) VALUES (?)`, [trimmed]);
      const rows = await query(`SELECT id, name FROM variation_types WHERE name = ?`, [trimmed]);
      return res.status(201).json(rows[0] || { name: trimmed });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: 'Server error.' });
    }
  }

  return res.status(405).end();
}
