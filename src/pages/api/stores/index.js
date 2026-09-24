import { query } from '@/lib/db';
import { requireAdminOnly, getAuthUser } from '@/lib/auth';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    // GET: All authenticated users can view stores
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ message: 'Not authenticated.' });

    const rows = await query(`
      SELECT s.*, COUNT(DISTINCT si.product_id) AS product_count
      FROM stores s
      LEFT JOIN stock_items_new si ON si.store_id = s.id AND si.status = 'available'
      GROUP BY s.id
      ORDER BY s.name ASC
    `);
    return res.status(200).json(rows);
  }

  // POST/PUT/DELETE: Admin only
  const user = await requireAdminOnly(req, res);
  if (!user) return;

  if (req.method === 'POST') {
    const { name, address, phone } = req.body;
    if (!name) return res.status(400).json({ message: 'Store name is required.' });
    try {
      const result = await query(
        'INSERT INTO stores (name, address, phone) VALUES (?, ?, ?)',
        [name, address || null, phone || null]
      );
      return res.status(201).json({ id: result.insertId, name });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Store already exists.' });
      return res.status(500).json({ message: 'Server error.' });
    }
  }

  return res.status(405).end();
}
