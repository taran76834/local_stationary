/**
 * Migration script: Add sell_on_website TINYINT column to products table.
 * Usage: node database/add-sell-on-website-to-products.js
 */

require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');

async function migrate() {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '3306'),
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'store',
    multipleStatements: true,
  });

  console.log('✅ Connected to MySQL database:', process.env.DB_NAME || 'store');
  console.log('⏳ Checking "sell_on_website" column in "products" table...\n');

  try {
    const dbName = process.env.DB_NAME || 'store';
    const [cols] = await conn.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'products' AND COLUMN_NAME = 'sell_on_website'
    `, [dbName]);

    if (cols.length === 0) {
      await conn.execute(`ALTER TABLE products ADD COLUMN sell_on_website TINYINT(1) NOT NULL DEFAULT 0`);
      console.log('  ✅ Added "sell_on_website" column to products table.');
    } else {
      console.log('  ℹ️  Column "sell_on_website" already exists in products table.');
    }

  } catch (err) {
    console.error('  ❌ Migration FAILED:', err.message);
    process.exit(1);
  }

  await conn.end();
  console.log('\n✅ Migration complete: sell_on_website column verified.');
}

migrate().catch(err => {
  console.error('\n❌ Migration failed:', err.message);
  process.exit(1);
});
