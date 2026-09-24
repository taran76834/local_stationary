require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '3306'),
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'store',
  });

  try {
    const [cols] = await conn.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME   = 'bill_items'
        AND COLUMN_NAME  = 'expiry_date'
    `);

    if (cols.length > 0) {
      console.log('  ⏭️  Column expiry_date already exists in bill_items — skipping.');
    } else {
      await conn.execute(`
        ALTER TABLE bill_items
        ADD COLUMN expiry_date DATE NULL DEFAULT NULL
      `);
      console.log('  ✅ Added expiry_date column to bill_items.');
    }
  } catch (err) {
    console.error('❌ Migration error:', err.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

run();
