import { query } from '@/lib/db';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const payload = req.method === 'POST' ? req.body : req.query;

  let countryId = payload.country_id ? parseInt(payload.country_id) : null;
  let stateId = payload.state_id ? parseInt(payload.state_id) : null;
  let cityId = payload.city_id ? parseInt(payload.city_id) : null;

  const countryName = (payload.country || '').trim();
  const stateName = (payload.state || '').trim();
  const cityName = (payload.city || '').trim();

  try {
    // If IDs were not provided, resolve them from names
    if (!countryId && countryName) {
      const cRows = await query('SELECT id FROM countries WHERE LOWER(name) = LOWER(?) OR LOWER(iso_code) = LOWER(?) LIMIT 1', [countryName, countryName]);
      if (cRows.length > 0) countryId = cRows[0].id;
    }

    if (countryId && !stateId && stateName) {
      const sRows = await query('SELECT id FROM states WHERE country_id = ? AND (LOWER(name) = LOWER(?) OR LOWER(state_code) = LOWER(?)) LIMIT 1', [countryId, stateName, stateName]);
      if (sRows.length > 0) stateId = sRows[0].id;
    }

    if (countryId && !cityId && cityName) {
      let citySql = 'SELECT id, state_id FROM cities WHERE country_id = ? AND LOWER(name) = LOWER(?)';
      const cityParams = [countryId, cityName];
      if (stateId) {
        citySql += ' AND state_id = ?';
        cityParams.push(stateId);
      }
      citySql += ' LIMIT 1';
      const ciRows = await query(citySql, cityParams);
      if (ciRows.length > 0) {
        cityId = ciRows[0].id;
        if (!stateId) stateId = ciRows[0].state_id;
      }
    }

    // 1. Check for specific city match in shipping_rates
    if (countryId && cityId) {
      const cityRates = await query(`
        SELECT sr.*, c.name AS country_name, s.name AS state_name, ci.name AS city_name
        FROM shipping_rates sr
        LEFT JOIN countries c ON sr.country_id = c.id
        LEFT JOIN states s ON sr.state_id = s.id
        LEFT JOIN cities ci ON sr.city_id = ci.id
        WHERE sr.country_id = ? AND sr.city_id = ? AND sr.status = 'active'
        LIMIT 1
      `, [countryId, cityId]);

      if (cityRates.length > 0) {
        const rate = cityRates[0];
        return res.status(200).json({
          shipping_fee: parseFloat(rate.price),
          is_free: parseFloat(rate.price) === 0,
          rate_type: 'city',
          matched_rule: {
            id: rate.id,
            country_id: rate.country_id,
            country_name: rate.country_name,
            state_id: rate.state_id,
            state_name: rate.state_name,
            city_id: rate.city_id,
            city_name: rate.city_name,
            price: rate.price,
          },
          estimated_days: rate.estimated_days || '3-5 business days',
        });
      }
    }

    // 2. Check for state-wide rate in shipping_rates (state_id matched, city_id IS NULL)
    if (countryId && stateId) {
      const stateRates = await query(`
        SELECT sr.*, c.name AS country_name, s.name AS state_name
        FROM shipping_rates sr
        LEFT JOIN countries c ON sr.country_id = c.id
        LEFT JOIN states s ON sr.state_id = s.id
        WHERE sr.country_id = ? AND sr.state_id = ? AND sr.city_id IS NULL AND sr.status = 'active'
        LIMIT 1
      `, [countryId, stateId]);

      if (stateRates.length > 0) {
        const rate = stateRates[0];
        return res.status(200).json({
          shipping_fee: parseFloat(rate.price),
          is_free: parseFloat(rate.price) === 0,
          rate_type: 'state',
          matched_rule: {
            id: rate.id,
            country_id: rate.country_id,
            country_name: rate.country_name,
            state_id: rate.state_id,
            state_name: rate.state_name,
            city_id: null,
            city_name: null,
            price: rate.price,
          },
          estimated_days: rate.estimated_days || '3-5 business days',
        });
      }
    }

    // 3. Check for country-wide rate in shipping_rates (country_id matched, state_id IS NULL and city_id IS NULL)
    if (countryId) {
      const countryRates = await query(`
        SELECT sr.*, c.name AS country_name
        FROM shipping_rates sr
        LEFT JOIN countries c ON sr.country_id = c.id
        WHERE sr.country_id = ? AND sr.state_id IS NULL AND sr.city_id IS NULL AND sr.status = 'active'
        LIMIT 1
      `, [countryId]);

      if (countryRates.length > 0) {
        const rate = countryRates[0];
        return res.status(200).json({
          shipping_fee: parseFloat(rate.price),
          is_free: parseFloat(rate.price) === 0,
          rate_type: 'country',
          matched_rule: {
            id: rate.id,
            country_id: rate.country_id,
            country_name: rate.country_name,
            state_id: null,
            state_name: null,
            city_id: null,
            city_name: null,
            price: rate.price,
          },
          estimated_days: rate.estimated_days || '3-5 business days',
        });
      }
    }

    // 4. Check for Global / All Countries rate (country_id IS NULL, state_id IS NULL, city_id IS NULL)
    const globalRates = await query(`
      SELECT sr.*
      FROM shipping_rates sr
      WHERE sr.country_id IS NULL AND sr.state_id IS NULL AND sr.city_id IS NULL AND sr.status = 'active'
      LIMIT 1
    `);

    if (globalRates.length > 0) {
      const rate = globalRates[0];
      return res.status(200).json({
        shipping_fee: parseFloat(rate.price),
        is_free: parseFloat(rate.price) === 0,
        rate_type: 'global_all_countries',
        matched_rule: {
          id: rate.id,
          country_id: null,
          country_name: 'All Countries',
          state_id: null,
          state_name: null,
          city_id: null,
          city_name: null,
          price: rate.price,
        },
        estimated_days: rate.estimated_days || '3-5 business days',
      });
    }

    // 5. Default if no rule matches
    return res.status(200).json({
      shipping_fee: 0,
      is_free: true,
      rate_type: 'none',
      matched_rule: null,
      estimated_days: '3-5 business days',
    });
  } catch (err) {
    console.error('Error calculating shipping fee:', err);
    return res.status(500).json({ message: 'Failed to calculate shipping.' });
  }
}
