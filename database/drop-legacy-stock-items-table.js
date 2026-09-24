/**
 * Migration script: Drop legacy stock_items table (replaced by stock_items_new).
 *
 * Usage: node database/drop-legacy-stock-items-table.js
 */

const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const dbConfig = {
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '3306'),
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'store',
};

async function run() {
  console.log('--- Migration: Drop legacy stock_items table ---');
  let conn;
  try {
    conn = await mysql.createConnection(dbConfig);

    console.log('Dropping legacy stock_items table...');
    await conn.query(`DROP TABLE IF EXISTS stock_items`);
    console.log('  ✅ Table stock_items dropped successfully.');

    console.log('🎉 Migration completed successfully.');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

run();
