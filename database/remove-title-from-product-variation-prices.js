/**
 * Migration script: Drop title column from product_variation_prices table.
 * Usage: node database/remove-title-from-product-variation-prices.js
 */

require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');

async function migrate() {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '3306'),
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'invincible_store',
  });

  console.log('Connected to MySQL database:', process.env.DB_NAME || 'invincible_store');
  console.log('Dropping title column from product_variation_prices...\n');

  try {
    const dbName = process.env.DB_NAME || 'invincible_store';

    // Check if table product_variation_prices exists
    const [tableCheck] = await conn.execute(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('product_variation_prices', 'product_flavor_prices')
    `, [dbName]);

    if (tableCheck.length === 0) {
      console.log('No variation table found.');
      process.exit(0);
    }

    const tableName = tableCheck.find(t => t.TABLE_NAME === 'product_variation_prices')?.TABLE_NAME || tableCheck[0].TABLE_NAME;

    const [colCheck] = await conn.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = 'title'
    `, [dbName, tableName]);

    if (colCheck.length > 0) {
      await conn.execute(`ALTER TABLE ${tableName} DROP COLUMN title`);
      console.log(`✅ Dropped column "title" from ${tableName}.`);
    } else {
      console.log(`ℹ️ Column "title" does not exist in ${tableName}.`);
    }

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await conn.end();
  }

  console.log('\nMigration to remove title from product_variation_prices complete.');
}

migrate();
