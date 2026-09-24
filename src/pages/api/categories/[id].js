import { query } from '@/lib/db';
import { requireAdmin, canEdit } from '@/lib/auth';
import { saveCategoryImage } from '@/lib/upload';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  const { id } = req.query;

function slugify(text) {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

  if (req.method === 'PUT') {
    if (!canEdit(user)) return res.status(403).json({ message: 'Admin access required.' });
    const { name, image, slug } = req.body;
    if (!name) return res.status(400).json({ message: 'Name is required.' });
    try {
      const finalSlug = slugify(slug || name);
      const imagePath = saveCategoryImage(image);
      await query('UPDATE categories SET name = ?, image = ?, slug = ? WHERE id = ?', [name, imagePath || null, finalSlug || null, id]);
      return res.status(200).json({ message: 'Category updated.' });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Category name or slug already exists.' });
      return res.status(500).json({ message: 'Server error.' });
    }
  }

  if (req.method === 'DELETE') {
    // Only admin and store_minus can delete
    if (!canEdit(user)) return res.status(403).json({ message: 'Admin access required.' });
    try {
      const used = await query('SELECT product_id FROM product_categories WHERE category_id = ? LIMIT 1', [id]);
      if (used.length > 0) {
        return res.status(409).json({ message: 'Cannot delete: category is used by one or more products.' });
      }
      await query('DELETE FROM categories WHERE id = ?', [id]);
      return res.status(200).json({ message: 'Category deleted.' });
    } catch (err) {
      return res.status(500).json({ message: 'Server error.' });
    }
  }

  return res.status(405).end();
}
