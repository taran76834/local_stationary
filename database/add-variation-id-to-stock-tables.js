/**
 * Migration script: Add variation_id column (INT NULL) to store_products and stock_items_new tables.
 * Usage: node database/add-variation-id-to-stock-tables.js
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
  console.log('Adding variation_id column (INT) to store_products & stock_items_new...\n');

  try {
    const dbName = process.env.DB_NAME || 'invincible_store';
    const tables = ['store_products', 'stock_items_new'];

    for (const tableName of tables) {
      const [tableCheck] = await conn.execute(`
        SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      `, [dbName, tableName]);

      if (tableCheck.length === 0) continue;

      const [colCheck] = await conn.execute(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = 'variation_id'
      `, [dbName, tableName]);

      if (colCheck.length === 0) {
        await conn.execute(`ALTER TABLE \`${tableName}\` ADD COLUMN variation_id INT NULL AFTER product_id`);
        console.log(`✅ Added "variation_id" INT column to ${tableName}.`);
      } else {
        console.log(`ℹ️ Column "variation_id" already exists in ${tableName}.`);
      }
    }

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await conn.end();
  }

  console.log('\nMigration to add variation_id to stock tables complete.');
}

migrate();
