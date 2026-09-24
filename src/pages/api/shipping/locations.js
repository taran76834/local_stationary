import { query } from '@/lib/db';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { type, country_id, state_id, search } = req.query;

  try {
    if (type === 'countries' || !type) {
      // Prioritize India at the top
      const countries = await query(`
        SELECT id, name, iso_code, flag, phone_code 
        FROM countries 
        ORDER BY (iso_code = 'IN') DESC, name ASC
      `);
      return res.status(200).json({ countries });
    }

    if (type === 'states') {
      if (!country_id) {
        return res.status(400).json({ message: 'country_id is required for fetching states.' });
      }
      const states = await query(`
        SELECT id, country_id, name, state_code 
        FROM states 
        WHERE country_id = ? 
        ORDER BY name ASC
      `, [country_id]);
      return res.status(200).json({ states });
    }

    if (type === 'cities') {
      if (!country_id && !state_id) {
        return res.status(400).json({ message: 'country_id or state_id is required for fetching cities.' });
      }

      let sql = 'SELECT id, state_id, country_id, name FROM cities WHERE 1=1';
      const params = [];

      if (state_id) {
        sql += ' AND state_id = ?';
        params.push(state_id);
      } else if (country_id) {
        sql += ' AND country_id = ?';
        params.push(country_id);
      }

      if (search) {
        sql += ' AND name LIKE ?';
        params.push(`%${search}%`);
      }

      sql += ' ORDER BY name ASC';

      const cities = await query(sql, params);
      return res.status(200).json({ cities });
    }

    return res.status(400).json({ message: 'Invalid location type.' });
  } catch (err) {
    console.error('Error fetching locations:', err);
    return res.status(500).json({ message: 'Failed to fetch location data.' });
  }
}
