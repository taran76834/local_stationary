import { query } from '@/lib/db';
import { requireAdmin, canEdit } from '@/lib/auth';

export default async function handler(req, res) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  const { id } = req.query;

  if (req.method === 'PUT') {
    if (!canEdit(user)) return res.status(403).json({ message: 'Admin access required.' });
    const { name, address, phone } = req.body;
    if (!name) return res.status(400).json({ message: 'Store name is required.' });
    try {
      await query('UPDATE stores SET name=?, address=?, phone=? WHERE id=?', [name, address || null, phone || null, id]);
      return res.status(200).json({ message: 'Store updated.' });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Store name already exists.' });
      return res.status(500).json({ message: 'Server error.' });
    }
  }

  if (req.method === 'DELETE') {
    if (!canEdit(user)) return res.status(403).json({ message: 'Admin access required.' });
    try {
      const [usedInStock, usedInBills] = await Promise.all([
        query('SELECT product_id FROM stock_items_new WHERE store_id = ? AND status = \'available\' LIMIT 1', [id]),
        query('SELECT id FROM bills WHERE store_id = ? LIMIT 1', [id]),
      ]);
      if (usedInStock.length > 0) {
        return res.status(409).json({ message: 'Cannot delete: store has products with stock assigned.' });
      }
      if (usedInBills.length > 0) {
        return res.status(409).json({ message: 'Cannot delete: store has bills associated with it.' });
      }
      await query('DELETE FROM stores WHERE id = ?', [id]);
      return res.status(200).json({ message: 'Store deleted.' });
    } catch (err) {
      return res.status(500).json({ message: 'Server error.' });
    }
  }

  return res.status(405).end();
}
