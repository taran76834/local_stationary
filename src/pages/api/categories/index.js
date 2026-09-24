import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
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

  if (req.method === 'GET') {
    try {
      const rows = await query(`
        SELECT c.*, COUNT(pc.product_id) AS product_count
        FROM categories c
        LEFT JOIN product_categories pc ON pc.category_id = c.id
        GROUP BY c.id
        ORDER BY c.name ASC
      `);
      return res.status(200).json(rows);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: 'Server error.' });
    }
  }

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

  if (req.method === 'POST') {
    const { name, image, slug } = req.body;
    if (!name) return res.status(400).json({ message: 'Name is required.' });
    try {
      const finalSlug = slugify(slug || name);
      const imagePath = saveCategoryImage(image);
      const result = await query(
        'INSERT INTO categories (name, image, slug) VALUES (?, ?, ?)',
        [name, imagePath || null, finalSlug || null]
      );
      return res.status(201).json({ id: result.insertId, name, image: imagePath, slug: finalSlug });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Category name or slug already exists.' });
      return res.status(500).json({ message: 'Server error.' });
    }
  }

  return res.status(405).end();
}
