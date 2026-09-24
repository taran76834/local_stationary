import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export default async function handler(req, res) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  if (user.role !== 'admin' && user.role !== 'manager') {
    return res.status(403).json({ message: 'Only administrators and managers can manage shipping rates.' });
  }

  const { id } = req.query;

  // GET single rate
  if (req.method === 'GET') {
    try {
      const rows = await query(`
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
      `, [id]);
      if (!rows.length) return res.status(404).json({ message: 'Shipping rate not found.' });
      return res.status(200).json(rows[0]);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: 'Server error' });
    }
  }

  // PUT / PATCH: Update shipping rate
  if (req.method === 'PUT' || req.method === 'PATCH') {
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
      // Check for duplicate combination on other rows
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

      duplicateConditions.push('id != ?');
      dupParams.push(id);

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

      await query(
        `UPDATE shipping_rates 
         SET country_id = ?, state_id = ?, city_id = ?, price = ?, estimated_days = ?, status = ?
         WHERE id = ?`,
        [countryIdVal, stateIdVal, cityIdVal, priceVal, estimatedDaysVal, statusVal, id]
      );

      const updated = await query(`
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
      `, [id]);
      if (!updated.length) return res.status(404).json({ message: 'Shipping rate not found.' });

      return res.status(200).json({ message: 'Shipping rate updated successfully.', rate: updated[0] });
    } catch (err) {
      console.error('Error updating shipping rate:', err);
      return res.status(500).json({ message: 'Failed to update shipping rate.' });
    }
  }

  // DELETE: Delete shipping rate
  if (req.method === 'DELETE') {
    try {
      const result = await query('DELETE FROM shipping_rates WHERE id = ?', [id]);
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Shipping rate not found.' });
      }
      return res.status(200).json({ message: 'Shipping rate deleted successfully.' });
    } catch (err) {
      console.error('Error deleting shipping rate:', err);
      return res.status(500).json({ message: 'Failed to delete shipping rate.' });
    }
  }

  return res.status(405).json({ message: 'Method not allowed' });
}
