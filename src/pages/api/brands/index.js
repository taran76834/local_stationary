import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { saveUploadedImage } from '@/lib/upload';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
};

export default async function handler(req, res) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  if (req.method === 'GET') {
    try {
      const rows = await query(`
        SELECT b.*, COUNT(pb.product_id) AS product_count
        FROM brands b
        LEFT JOIN product_brands pb ON pb.brand_id = b.id
        GROUP BY b.id
        ORDER BY b.name ASC
      `);
      return res.status(200).json(rows);
    } catch (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') return res.status(200).json([]);
      return res.status(500).json({ message: 'Server error.' });
    }
  }

  if (req.method === 'POST') {
    const { name, image } = req.body;
    if (!name) return res.status(400).json({ message: 'Name is required.' });
    try {
      const imagePath = image ? saveUploadedImage(image, 'brands', 'brand') : null;
      const result = await query(
        'INSERT INTO brands (name, image) VALUES (?, ?)',
        [name, imagePath]
      );
      return res.status(201).json({ id: result.insertId, name, image: imagePath });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Brand already exists.' });
      return res.status(500).json({ message: 'Server error.' });
    }
  }

  return res.status(405).end();
}
