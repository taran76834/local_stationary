/**
 * Migration script: Drop legacy brand_id column and foreign key fk_products_brand from products table.
 * Usage: node database/drop-brand-id-from-products.js
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
  });

  console.log('✅ Connected to MySQL database:', process.env.DB_NAME || 'store');
  console.log('⏳ Dropping legacy brand_id column from products table...\n');

  try {
    // 1. Drop FK fk_products_brand if present
    const [fks] = await conn.execute(`
      SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND CONSTRAINT_NAME = 'fk_products_brand'
    `);
    if (fks.length > 0) {
      await conn.execute(`ALTER TABLE products DROP FOREIGN KEY fk_products_brand`);
      console.log('  ✅ Foreign key fk_products_brand dropped from products');
    }

    // 2. Drop column brand_id if present
    const [cols] = await conn.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'brand_id'
    `);
    if (cols.length > 0) {
      await conn.execute(`ALTER TABLE products DROP COLUMN brand_id`);
      console.log('  ✅ Column "brand_id" dropped from products table');
    } else {
      console.log('  ⏭️  Column "brand_id" does not exist in products table');
    }
  } catch (err) {
    console.error('  ❌ Migration FAILED:', err.message);
    process.exit(1);
  }

  await conn.end();
  console.log('\n✅ Drop brand_id migration complete.');
}

migrate().catch(err => {
  console.error('\n❌ Migration failed:', err.message);
  process.exit(1);
});
