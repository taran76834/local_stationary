/**
 * Migration script: Add vari_attribute column (LONGTEXT NULL) to fr_order_items table.
 * Usage: node database/add-vari-attribute-to-fr-order-items.js
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
  console.log('Adding vari_attribute column (LONGTEXT) to fr_order_items...\n');

  try {
    const dbName = process.env.DB_NAME || 'invincible_store';

    // Check if table fr_order_items exists
    const [tableCheck] = await conn.execute(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'fr_order_items'
    `, [dbName]);

    if (tableCheck.length === 0) {
      console.log('Table fr_order_items does not exist.');
      process.exit(0);
    }

    const [colCheck] = await conn.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'fr_order_items' AND COLUMN_NAME = 'vari_attribute'
    `, [dbName]);

    if (colCheck.length === 0) {
      await conn.execute(`ALTER TABLE fr_order_items ADD COLUMN vari_attribute LONGTEXT NULL AFTER variant_id`);
      console.log('✅ Added "vari_attribute" LONGTEXT column to fr_order_items.');
    } else {
      console.log('ℹ️ Column "vari_attribute" already exists in fr_order_items.');
    }

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await conn.end();
  }

  console.log('\nMigration to add vari_attribute to fr_order_items complete.');
}

migrate();
