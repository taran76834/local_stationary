import { query } from '@/lib/db';
import { requireAdmin, canEdit } from '@/lib/auth';
import { saveUploadedImage } from '@/lib/upload';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '8mb',
    },
  },
};

export default async function handler(req, res) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  const { id } = req.query;

  if (req.method === 'PUT') {
    if (!canEdit(user)) return res.status(403).json({ message: 'Admin access required.' });
    const { name, image } = req.body;
    if (!name) return res.status(400).json({ message: 'Name is required.' });
    try {
      // image can be: new base64 data URI, existing path/URL, or undefined (no change)
      let imagePath = undefined;
      if (image !== undefined) {
        imagePath = image ? saveUploadedImage(image, 'brands', 'brand') : null;
      }

      if (imagePath !== undefined) {
        await query('UPDATE brands SET name = ?, image = ? WHERE id = ?', [name, imagePath, id]);
      } else {
        await query('UPDATE brands SET name = ? WHERE id = ?', [name, id]);
      }
      return res.status(200).json({ message: 'Brand updated.' });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Brand already exists.' });
      return res.status(500).json({ message: 'Server error.' });
    }
  }

  if (req.method === 'DELETE') {
    if (!canEdit(user)) return res.status(403).json({ message: 'Admin access required.' });
    try {
      const used = await query('SELECT product_id FROM product_brands WHERE brand_id = ? LIMIT 1', [id]);
      if (used.length > 0) {
        return res.status(409).json({ message: 'Cannot delete: brand is used by one or more products.' });
      }
      await query('DELETE FROM brands WHERE id = ?', [id]);
      return res.status(200).json({ message: 'Brand deleted.' });
    } catch (err) {
      return res.status(500).json({ message: 'Server error.' });
    }
  }

  return res.status(405).end();
}
