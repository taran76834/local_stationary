const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'store',
  });

  try {
    console.log('Modifying stock_items_new status column to allow oversold...');
    await conn.execute(
      "ALTER TABLE stock_items_new MODIFY COLUMN status ENUM('available', 'sold', 'expired', 'oversold') NOT NULL DEFAULT 'available'"
    );
    console.log('Successfully updated stock_items_new status column enum definition.');
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await conn.end();
  }
}

run();
