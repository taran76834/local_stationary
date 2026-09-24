import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export default async function handler(req, res) {
  // GET: Listing rates with relational joined names
  if (req.method === 'GET') {
    try {
      const { country_id, state_id, search, status } = req.query;

      let sql = `
        SELECT 
          sr.id,
          sr.country_id,
          sr.state_id,
          sr.city_id,
          c.name AS country_name,
          c.iso_code AS country_code,
          c.flag AS country_flag,
          s.name AS state_name,
          s.state_code AS state_code,
          ci.name AS city_name,
          sr.price,
          sr.estimated_days,
          sr.status,
          sr.created_at,
          sr.updated_at
        FROM shipping_rates sr
        LEFT JOIN countries c ON sr.country_id = c.id
        LEFT JOIN states s ON sr.state_id = s.id
        LEFT JOIN cities ci ON sr.city_id = ci.id
        WHERE 1=1
      `;
      const params = [];

      if (country_id) {
        sql += ' AND sr.country_id = ?';
        params.push(country_id);
      }

      if (state_id) {
        sql += ' AND sr.state_id = ?';
        params.push(state_id);
      }

      if (status && ['active', 'inactive'].includes(status)) {
        sql += ' AND sr.status = ?';
        params.push(status);
      }

      if (search) {
        sql += ' AND (c.name LIKE ? OR s.name LIKE ? OR ci.name LIKE ?)';
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }

      sql += ' ORDER BY (sr.country_id IS NULL) DESC, c.name ASC, (sr.state_id IS NULL) DESC, s.name ASC, (sr.city_id IS NULL) DESC, ci.name ASC, sr.created_at DESC';

      const rates = await query(sql, params);

      return res.status(200).json({ rates });
    } catch (err) {
      console.error('Error fetching shipping rates:', err);
      return res.status(500).json({ message: 'Failed to fetch shipping rates.' });
    }
  }

  // POST: Admin & Manager can add a new shipping rate with foreign key primary IDs
  if (req.method === 'POST') {
    const user = await requireAdmin(req, res);
    if (!user) return;

    if (user.role !== 'admin' && user.role !== 'manager') {
      return res.status(403).json({ message: 'Only administrators and managers can add shipping rates.' });
    }

    const { country_id, state_id, city_id, price, estimated_days, status } = req.body;

    if (price === undefined || price === null || isNaN(parseFloat(price)) || parseFloat(price) < 0) {
      return res.status(400).json({ message: 'A valid non-negative shipping price is required.', errorField: 'price' });
    }

    const countryIdVal = country_id && !isNaN(parseInt(country_id)) ? parseInt(country_id) : null;
    const stateIdVal = state_id && !isNaN(parseInt(state_id)) ? parseInt(state_id) : null;
    const cityIdVal = city_id && !isNaN(parseInt(city_id)) ? parseInt(city_id) : null;
    const priceVal = parseFloat(price);
    const estimatedDaysVal = estimated_days && estimated_days.trim() ? estimated_days.trim() : '3-5 business days';
    const statusVal = status === 'inactive' ? 'inactive' : 'active';

    try {
      // Check for duplicate combination
      const duplicateConditions = [];
      const dupParams = [];

      if (countryIdVal === null) {
        duplicateConditions.push('country_id IS NULL');
      } else {
        duplicateConditions.push('country_id = ?');
        dupParams.push(countryIdVal);
      }

      if (stateIdVal === null) {
        duplicateConditions.push('state_id IS NULL');
      } else {
        duplicateConditions.push('state_id = ?');
        dupParams.push(stateIdVal);
      }

      if (cityIdVal === null) {
        duplicateConditions.push('city_id IS NULL');
      } else {
        duplicateConditions.push('city_id = ?');
        dupParams.push(cityIdVal);
      }

      const existing = await query(
        `SELECT id FROM shipping_rates WHERE ${duplicateConditions.join(' AND ')} LIMIT 1`,
        dupParams
      );

      if (existing.length > 0) {
        return res.status(409).json({
          message: 'A shipping rate with this geographic combination already exists.',
          errorField: 'combination',
        });
      }

      const result = await query(
        `INSERT INTO shipping_rates (country_id, state_id, city_id, price, estimated_days, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [countryIdVal, stateIdVal, cityIdVal, priceVal, estimatedDaysVal, statusVal]
      );

      const inserted = await query(`
        SELECT 
          sr.*,
          c.name AS country_name,
          s.name AS state_name,
          ci.name AS city_name
        FROM shipping_rates sr
        LEFT JOIN countries c ON sr.country_id = c.id
        LEFT JOIN states s ON sr.state_id = s.id
        LEFT JOIN cities ci ON sr.city_id = ci.id
        WHERE sr.id = ?
      `, [result.insertId]);

      return res.status(201).json({ message: 'Shipping rate added successfully.', rate: inserted[0] });
    } catch (err) {
      console.error('Error adding shipping rate:', err);
      return res.status(500).json({ message: 'Failed to create shipping rate.' });
    }
  }

  return res.status(405).json({ message: 'Method not allowed' });
}
