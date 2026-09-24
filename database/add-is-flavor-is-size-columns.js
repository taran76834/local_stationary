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

  try {
    // 1. Check is_flavor in products
    const [flavorCol] = await conn.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'is_flavor'
    `);
    if (flavorCol.length === 0) {
      await conn.execute(`
        ALTER TABLE products
        ADD COLUMN is_flavor TINYINT(1) DEFAULT 0 AFTER product_type,
        ADD COLUMN is_size TINYINT(1) DEFAULT 0 AFTER is_flavor
      `);
      console.log('  ✅ Added is_flavor and is_size columns to products table.');
    } else {
      console.log('  ⏭️  is_flavor and is_size columns already exist in products table.');
    }

    // 2. Backfill existing products
    const targetTable = (await conn.execute(`SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product_variation_prices'`))[0].length > 0
      ? 'product_variation_prices'
      : 'product_flavor_prices';

    // Mark is_flavor = 1 if product has product_flavors or variation prices with flavor_id
    await conn.execute(`
      UPDATE products p
      SET is_flavor = 1
      WHERE EXISTS (SELECT 1 FROM product_flavors pf WHERE pf.product_id = p.id)
         OR EXISTS (SELECT 1 FROM ${targetTable} pfp WHERE pfp.product_id = p.id AND pfp.flavor_id IS NOT NULL)
    `);

    // Mark is_size = 1 if product has variation prices with unit_value or unit_id
    await conn.execute(`
      UPDATE products p
      SET is_size = 1
      WHERE EXISTS (SELECT 1 FROM ${targetTable} pfp WHERE pfp.product_id = p.id AND pfp.unit_value IS NOT NULL AND pfp.unit_value != '')
    `);

    // Sync product_type = 'variable_product' if is_flavor = 1 OR is_size = 1
    await conn.execute(`
      UPDATE products
      SET product_type = CASE WHEN is_flavor = 1 OR is_size = 1 THEN 'variable_product' ELSE 'simple_product' END
    `);

    console.log('  ✅ Backfilled is_flavor, is_size, and product_type across all products.');

  } catch (err) {
    console.error('❌ Migration error:', err.message);
  } finally {
    await conn.end();
  }
}

migrate();
