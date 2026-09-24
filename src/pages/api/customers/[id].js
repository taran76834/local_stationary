import { query } from '@/lib/db';
import { requireAdmin, canEdit } from '@/lib/auth';

export default async function handler(req, res) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  const { id } = req.query;

  if (req.method === 'PUT') {
    const { name, phone } = req.body;
    if (!name || !name.trim())
      return res.status(400).json({ message: 'Customer name is required.' });
    try {
      await query(
        'UPDATE customers SET name = ?, phone = ? WHERE id = ?',
        [name.trim(), phone?.trim() || null, id]
      );
      return res.status(200).json({ message: 'Customer updated.' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: 'Server error.' });
    }
  }

  if (req.method === 'DELETE') {
    if (!canEdit(user))
      return res.status(403).json({ message: 'Admin access required to delete customers.' });
    try {
      await query('DELETE FROM customers WHERE id = ?', [id]);
      return res.status(200).json({ message: 'Customer deleted.' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: 'Server error.' });
    }
  }

  return res.status(405).end();
}
