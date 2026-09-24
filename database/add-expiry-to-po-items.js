// Migration: add expiry_date column to purchase_order_items
require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });
const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'store',
  });

  try {
    // Check if column already exists
    const [cols] = await conn.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME   = 'purchase_order_items'
        AND COLUMN_NAME  = 'expiry_date'
    `);

    if (cols.length > 0) {
      console.log('Column expiry_date already exists — skipping.');
    } else {
      await conn.execute(`
        ALTER TABLE purchase_order_items
        ADD COLUMN expiry_date DATE NULL DEFAULT NULL
      `);
      console.log('✓ Added expiry_date column to purchase_order_items.');
    }
  } finally {
    await conn.end();
  }
}

run().catch(err => { console.error(err); process.exit(1); });
