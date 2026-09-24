/**
 * Migration script: Add barcode column to product_flavor_prices table for variation barcodes.
 * Usage: node database/add-variation-barcode.js
 */

require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'invincible_store',
  });

  console.log('✅ Connected to MySQL database:', process.env.DB_NAME || 'invincible_store');

  try {
    const targetTable = (await conn.execute(`SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product_variation_prices'`))[0].length > 0
      ? 'product_variation_prices'
      : 'product_flavor_prices';

    const [rows] = await conn.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'barcode'
    `, [targetTable]);

    if (rows.length === 0) {
      await conn.execute(`ALTER TABLE ${targetTable} ADD COLUMN barcode VARCHAR(100) NULL`);
      console.log(`✅ Added "barcode" column to ${targetTable} table.`);
    } else {
      console.log(`⏭️  Column "barcode" already exists in ${targetTable} table.`);
    }
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

run();
