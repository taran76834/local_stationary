/**
 * Migration script: Drop legacy product_flavor_prices table if product_variation_prices exists.
 * Usage: node database/drop-legacy-product-flavor-prices-table.js
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
  console.log('⏳ Dropping legacy product_flavor_prices table...\n');

  try {
    const [flavorRows] = await conn.execute(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product_flavor_prices'`
    );

    if (flavorRows.length > 0) {
      await conn.execute(`DROP TABLE IF EXISTS product_flavor_prices`);
      console.log('  ✅ Legacy table "product_flavor_prices" dropped successfully.');
    } else {
      console.log('  ⏭️  Table "product_flavor_prices" does not exist (already dropped).');
    }
  } catch (err) {
    console.error('  ❌ Migration FAILED:', err.message);
    process.exit(1);
  }

  await conn.end();
  console.log('\n✅ Drop product_flavor_prices migration complete.');
}

migrate().catch(err => {
  console.error('\n❌ Migration failed:', err.message);
  process.exit(1);
});
