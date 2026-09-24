import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

// Trim + title-case: "  CHOCOLATE MINT  " → "Chocolate Mint"
function toTitleCase(str) {
  if (!str) return '';
  return String(str)
    .trim()
    .replace(/\s+/g, ' ')   // collapse internal spaces
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());
}

// Get or create a record by name, return its id
async function getOrCreate(table, name) {
  const rows = await query(`SELECT id FROM ${table} WHERE name = ? LIMIT 1`, [name]);
  if (rows.length > 0) return rows[0].id;
  const result = await query(`INSERT INTO ${table} (name) VALUES (?)`, [name]);
  return result.insertId;
}

export default async function handler(req, res) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  if (req.method !== 'POST') return res.status(405).end();

  const { rows } = req.body; // [{ name, category, flavor, barcode, price, description }]
  if (!Array.isArray(rows) || rows.length === 0)
    return res.status(400).json({ message: 'No rows provided.' });

  const results = { created: 0, skipped: [], errors: [] };

  for (const row of rows) {
    const name = toTitleCase(row.name);
    if (!name) { results.skipped.push({ name: '(empty)', reason: 'Empty product name' }); continue; }

    try {
      const slug = name.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
      const salePriceVal = row.sale_price || row.salePrice || row.saleprice;
      const prodType = row.flavor ? 'variable_product' : 'simple_product';
      // Always insert — allow duplicates
      const result = await query(
        `INSERT INTO products (name, product_type, barcode, price, sale_price, description, image, slug) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          name,
          prodType,
          row.barcode ? String(row.barcode).trim() : null,
          row.price   ? String(row.price).trim()   : 0,
          salePriceVal ? String(salePriceVal).trim() : null,
          row.description ? String(row.description).trim() : null,
          row.image   ? String(row.image).trim()   : null,
          slug || null,
        ]
      );
      const productId = result.insertId;
      results.created++;

      // Category — add if provided (INSERT IGNORE keeps existing ones too)
      if (row.category) {
        const catId = await getOrCreate('categories', toTitleCase(row.category));
        await query('INSERT IGNORE INTO product_categories (product_id, category_id) VALUES (?, ?)', [productId, catId]);
      }

      // Flavor — add if provided
      if (row.flavor) {
        const flavorId = await getOrCreate('flavors', toTitleCase(row.flavor));
        await query('INSERT IGNORE INTO product_flavors (product_id, flavor_id) VALUES (?, ?)', [productId, flavorId]);
      }

    } catch (err) {
      console.error('Import row error:', err);
      results.errors.push({ name, reason: err.message });
    }
  }

  return res.status(200).json(results);
}
