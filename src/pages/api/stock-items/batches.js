import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

// Returns available stock batches for a product+store, ordered FEFO
// so the UI can show which expiry batches will be consumed
export default async function handler(req, res) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  if (req.method !== 'GET') return res.status(405).end();

  const { store_id, product_id, variation_id } = req.query;
  if (!store_id || !product_id)
    return res.status(400).json({ message: 'store_id and product_id are required.' });

  let sql = `
    SELECT
      si.variation_id,
      pvp.attributes AS variation_attributes,
      si.expiry_date,
      COUNT(*) AS qty
    FROM stock_items_new si
    JOIN products p ON si.product_id = p.id
    LEFT JOIN product_variation_prices pvp ON si.variation_id = pvp.id
    WHERE si.store_id = ? AND si.product_id = ? AND si.status = 'available'
  `;
  const params = [store_id, product_id];

  if (variation_id) { sql += ` AND si.variation_id = ?`; params.push(variation_id); }

  sql += `
    GROUP BY si.variation_id, pvp.attributes, si.expiry_date
    ORDER BY si.expiry_date IS NULL ASC, si.expiry_date ASC
  `;

  const rows = await query(sql, params);
  return res.status(200).json(rows);
}
