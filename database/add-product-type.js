/**
 * Add 'product_type' column to products table and backfill existing products.
 * Usage: node database/add-product-type.js
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
  console.log('⏳ Adding "product_type" column to products table...\n');

  try {
    const [cols] = await conn.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'product_type'
    `);

    if (cols.length === 0) {
      await conn.execute(`ALTER TABLE products ADD COLUMN product_type VARCHAR(50) NOT NULL DEFAULT 'simple_product' AFTER name`);
      console.log('  ✅ Column "product_type" added to products table');
    } else {
      console.log('  ⏭️  Column "product_type" already exists in products table');
    }

    // Backfill product_type for existing products
    // If product has entries in product_flavors or product_variation_prices / product_flavor_prices, set to 'variable_product', else 'simple_product'
    const targetTable = (await conn.execute(`SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product_variation_prices'`))[0].length > 0
      ? 'product_variation_prices'
      : 'product_flavor_prices';

    await conn.execute(`
      UPDATE products p
      SET p.product_type = CASE
        WHEN (SELECT COUNT(*) FROM ${targetTable} fp WHERE fp.product_id = p.id) > 0
        THEN 'variable_product'
        ELSE 'simple_product'
      END
    `);
    console.log('  ✅ Product types backfilled (simple_product / variable_product)');

  } catch (err) {
    console.error('  ❌ Migration FAILED:', err.message);
    process.exit(1);
  }

  await conn.end();
  console.log('\n✅ product_type migration complete.');
}

migrate().catch(err => {
  console.error('\n❌ Migration failed:', err.message);
  process.exit(1);
});
