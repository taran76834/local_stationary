/**
 * Migration: Create countries, states, cities relational tables and seed data,
 * and update shipping_rates to use relational IDs (country_id, state_id, city_id).
 * Usage: node database/create-geo-and-shipping-tables.js
 */

require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');
const { Country, State, City } = require('country-state-city');

async function migrate() {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '3306'),
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'invincible_latest',
  });

  console.log('Connected to MySQL database:', process.env.DB_NAME || 'invincible_latest');

  try {
    // 1. Create countries table
    console.log('Creating countries table...');
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS countries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        iso_code VARCHAR(10) NOT NULL UNIQUE,
        phone_code VARCHAR(20) NULL,
        currency VARCHAR(10) NULL,
        flag VARCHAR(10) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_name (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 2. Create states table
    console.log('Creating states table...');
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS states (
        id INT AUTO_INCREMENT PRIMARY KEY,
        country_id INT NOT NULL,
        name VARCHAR(150) NOT NULL,
        state_code VARCHAR(20) NULL,
        country_code VARCHAR(10) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_states_country FOREIGN KEY (country_id) REFERENCES countries(id) ON DELETE CASCADE,
        INDEX idx_country_id (country_id),
        INDEX idx_name (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 3. Create cities table
    console.log('Creating cities table...');
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS cities (
        id INT AUTO_INCREMENT PRIMARY KEY,
        state_id INT NOT NULL,
        country_id INT NOT NULL,
        name VARCHAR(150) NOT NULL,
        state_code VARCHAR(20) NULL,
        country_code VARCHAR(10) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_cities_state FOREIGN KEY (state_id) REFERENCES states(id) ON DELETE CASCADE,
        CONSTRAINT fk_cities_country FOREIGN KEY (country_id) REFERENCES countries(id) ON DELETE CASCADE,
        INDEX idx_state_id (state_id),
        INDEX idx_country_id (country_id),
        INDEX idx_name (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Check if countries already populated
    const [existingCountries] = await conn.execute('SELECT COUNT(*) as cnt FROM countries');
    if (existingCountries[0].cnt === 0) {
      console.log('Seeding countries...');
      const allCountries = Country.getAllCountries();
      const countryValues = allCountries.map(c => [
        c.name,
        c.isoCode,
        c.phonecode || null,
        c.currency || null,
        c.flag || null,
      ]);

      await conn.query(
        'INSERT INTO countries (name, iso_code, phone_code, currency, flag) VALUES ?',
        [countryValues]
      );
      console.log(`✅ Seeded ${allCountries.length} countries.`);
    } else {
      console.log(`ℹ️ Countries already seeded (${existingCountries[0].cnt} records).`);
    }

    // Build country_code -> country_id map
    const [dbCountries] = await conn.execute('SELECT id, iso_code FROM countries');
    const countryMap = new Map();
    for (const c of dbCountries) {
      countryMap.set(c.iso_code, c.id);
    }

    // Check if states already populated
    const [existingStates] = await conn.execute('SELECT COUNT(*) as cnt FROM states');
    if (existingStates[0].cnt === 0) {
      console.log('Seeding states...');
      const allStates = State.getAllStates();
      const stateValues = [];
      for (const s of allStates) {
        const countryId = countryMap.get(s.countryCode);
        if (countryId) {
          stateValues.push([
            countryId,
            s.name,
            s.isoCode || null,
            s.countryCode,
          ]);
        }
      }

      if (stateValues.length > 0) {
        // Insert in batches of 1000
        for (let i = 0; i < stateValues.length; i += 1000) {
          const batch = stateValues.slice(i, i + 1000);
          await conn.query(
            'INSERT INTO states (country_id, name, state_code, country_code) VALUES ?',
            [batch]
          );
        }
      }
      console.log(`✅ Seeded ${stateValues.length} states.`);
    } else {
      console.log(`ℹ️ States already seeded (${existingStates[0].cnt} records).`);
    }

    // Build `countryCode:stateCode` -> state_id map
    const [dbStates] = await conn.execute('SELECT id, country_code, state_code FROM states');
    const stateMap = new Map();
    for (const s of dbStates) {
      if (s.state_code) {
        stateMap.set(`${s.country_code}:${s.state_code}`, s.id);
      }
    }

    // Check if cities already populated
    const [existingCities] = await conn.execute('SELECT COUNT(*) as cnt FROM cities');
    if (existingCities[0].cnt === 0) {
      console.log('Seeding cities (this may take a few seconds)...');
      const allCities = City.getAllCities();
      const cityValues = [];
      for (const c of allCities) {
        const countryId = countryMap.get(c.countryCode);
        const stateId = stateMap.get(`${c.countryCode}:${c.stateCode}`);
        if (countryId && stateId) {
          cityValues.push([
            stateId,
            countryId,
            c.name,
            c.stateCode || null,
            c.countryCode,
          ]);
        }
      }

      if (cityValues.length > 0) {
        const BATCH_SIZE = 3000;
        for (let i = 0; i < cityValues.length; i += BATCH_SIZE) {
          const batch = cityValues.slice(i, i + BATCH_SIZE);
          await conn.query(
            'INSERT INTO cities (state_id, country_id, name, state_code, country_code) VALUES ?',
            [batch]
          );
        }
      }
      console.log(`✅ Seeded ${cityValues.length} cities.`);
    } else {
      console.log(`ℹ️ Cities already seeded (${existingCities[0].cnt} records).`);
    }

    // 4. Update or recreate shipping_rates table to use relational primary IDs
    console.log('Updating shipping_rates table with foreign keys...');

    // Drop old shipping_rates if schema differs
    await conn.execute('DROP TABLE IF EXISTS shipping_rates');

    await conn.execute(`
      CREATE TABLE shipping_rates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        country_id INT NULL,
        state_id INT NULL,
        city_id INT NULL,
        price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        estimated_days VARCHAR(50) NULL DEFAULT '3-5 business days',
        status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_shipping_country FOREIGN KEY (country_id) REFERENCES countries(id) ON DELETE SET NULL,
        CONSTRAINT fk_shipping_state FOREIGN KEY (state_id) REFERENCES states(id) ON DELETE SET NULL,
        CONSTRAINT fk_shipping_city FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE SET NULL,
        INDEX idx_geo_rate (country_id, state_id, city_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Created "shipping_rates" table using country_id, state_id, and city_id.');

  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await conn.end();
  }

  console.log('\nGeo tables and shipping_rates migration finished successfully.');
}

migrate();
