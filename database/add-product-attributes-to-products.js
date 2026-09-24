/**
 * Migration script: Add product_attributes JSON column to products table
 * Usage: node database/add-product-attributes-to-products.js
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
  console.log('⏳ Checking "product_attributes" column in "products" table...\n');

  try {
    const dbName = process.env.DB_NAME || 'store';
    const [cols] = await conn.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'products' AND COLUMN_NAME = 'product_attributes'
    `, [dbName]);

    if (cols.length === 0) {
      await conn.execute(`ALTER TABLE products ADD COLUMN product_attributes JSON NULL AFTER slug`);
      console.log('  ✅ Added "product_attributes" JSON column to products table.');
    } else {
      console.log('  ℹ️  Column "product_attributes" already exists in products table.');
    }

  } catch (err) {
    console.error('  ❌ Migration FAILED:', err.message);
    process.exit(1);
  }

  await conn.end();
  console.log('\n✅ Migration complete: product_attributes column verified.');
}

migrate().catch(err => {
  console.error('\n❌ Migration failed:', err.message);
  process.exit(1);
});
