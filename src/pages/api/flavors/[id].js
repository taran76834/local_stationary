import { query } from '@/lib/db';
import { requireAdmin, canEdit } from '@/lib/auth';

export default async function handler(req, res) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  const { id } = req.query;

  if (req.method === 'PUT') {
    if (!canEdit(user)) return res.status(403).json({ message: 'Admin access required.' });
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'Name is required.' });
    try {
      await query('UPDATE flavors SET name = ? WHERE id = ?', [name, id]);
      return res.status(200).json({ message: 'Flavor updated.' });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Flavor already exists.' });
      return res.status(500).json({ message: 'Server error.' });
    }
  }

  if (req.method === 'DELETE') {
    // Only admin and store_minus can delete
    if (!canEdit(user)) return res.status(403).json({ message: 'Admin access required.' });
    try {
      const used = await query('SELECT product_id FROM product_flavors WHERE flavor_id = ? LIMIT 1', [id]);
      if (used.length > 0) {
        return res.status(409).json({ message: 'Cannot delete: flavor is used by one or more products.' });
      }
      await query('DELETE FROM flavors WHERE id = ?', [id]);
      return res.status(200).json({ message: 'Flavor deleted.' });
    } catch (err) {
      return res.status(500).json({ message: 'Server error.' });
    }
  }

  return res.status(405).end();
}
