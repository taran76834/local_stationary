/**
 * Create product_flavor_prices table for per-flavor pricing variations.
 * Usage: node database/add-product-flavor-prices.js
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
  console.log('⏳ Creating "product_variation_prices" table...\n');

  try {
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS product_variation_prices (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        product_id  INT           NOT NULL,
        flavor_id   INT           NULL,
        price       DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        sale_price  DECIMAL(10,2) NULL,
        created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
        updated_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `);
    console.log('  ✅ Table "product_variation_prices" created successfully');
  } catch (err) {
    console.error('  ❌ Migration FAILED:', err.message);
    process.exit(1);
  }

  await conn.end();
  console.log('\n✅ product_variation_prices migration complete.');
}

migrate().catch(err => {
  console.error('\n❌ Migration failed:', err.message);
  process.exit(1);
});
