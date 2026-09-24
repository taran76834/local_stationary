import { query } from '@/lib/db';
import { requireAdmin, canEdit } from '@/lib/auth';

export default async function handler(req, res) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  const { id } = req.query;

  if (req.method === 'PUT') {
    if (!canEdit(user)) return res.status(403).json({ message: 'Admin access required.' });
    const { name, contact, phone, email, address } = req.body;
    if (!name) return res.status(400).json({ message: 'Supplier name is required.' });
    await query(
      'UPDATE suppliers SET name=?, contact=?, phone=?, email=?, address=? WHERE id=?',
      [name, contact || null, phone || null, email || null, address || null, id]
    );
    return res.status(200).json({ message: 'Supplier updated.' });
  }

  if (req.method === 'DELETE') {
    if (!canEdit(user)) return res.status(403).json({ message: 'Admin access required.' });
    await query('DELETE FROM suppliers WHERE id = ?', [id]);
    return res.status(200).json({ message: 'Supplier deleted.' });
  }

  return res.status(405).end();
}
