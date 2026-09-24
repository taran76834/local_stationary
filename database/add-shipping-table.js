/**
 * Migration: Create shipping_rates table.
 * Usage: node database/add-shipping-table.js
 */

require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');

async function migrate() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'invincible_latest',
  });

  console.log('Connected to MySQL database:', process.env.DB_NAME || 'invincible_latest');

  try {
    // 1. Create shipping_rates table
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS shipping_rates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        country VARCHAR(100) NOT NULL DEFAULT 'India',
        state VARCHAR(100) NULL,
        city VARCHAR(100) NULL,
        price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        estimated_days VARCHAR(50) NULL DEFAULT '3-5 business days',
        status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_country_state_city (country, state, city)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Ensure state column exists if table was created previously without it
    const [stateCol] = await conn.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'shipping_rates' AND COLUMN_NAME = 'state'
    `, [process.env.DB_NAME || 'invincible_latest']);

    if (stateCol.length === 0) {
      await conn.execute(`ALTER TABLE shipping_rates ADD COLUMN state VARCHAR(100) NULL AFTER country`);
      console.log('✅ Added "state" column to shipping_rates.');
    }
    console.log('✅ Created / verified "shipping_rates" table.');

    // 2. Drop shipping_settings table if it exists
    await conn.execute(`DROP TABLE IF EXISTS shipping_settings`);
    console.log('✅ Removed "shipping_settings" table.');

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await conn.end();
  }

  console.log('\nShipping table migration completed successfully.');
}

migrate();
