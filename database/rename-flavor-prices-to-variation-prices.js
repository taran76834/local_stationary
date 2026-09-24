/**
 * Migration script: Rename product_flavor_prices table to product_variation_prices.
 * Usage: node database/rename-flavor-prices-to-variation-prices.js
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
  console.log('⏳ Renaming "product_flavor_prices" to "product_variation_prices"...\n');

  try {
    const dbName = process.env.DB_NAME || 'store';
    const [flavorRows] = await conn.execute(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'product_flavor_prices'`,
      [dbName]
    );

    const [variationRows] = await conn.execute(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'product_variation_prices'`,
      [dbName]
    );

    const hasFlavorTable = flavorRows.length > 0;
    const hasVariationTable = variationRows.length > 0;

    if (hasFlavorTable && !hasVariationTable) {
      await conn.execute(`RENAME TABLE product_flavor_prices TO product_variation_prices`);
      console.log('  ✅ Table "product_flavor_prices" renamed to "product_variation_prices" successfully.');
    } else if (!hasVariationTable) {
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS product_variation_prices (
          id          INT AUTO_INCREMENT PRIMARY KEY,
          product_id  INT           NOT NULL,
          flavor_id   INT           NULL,
          unit_id     INT           NULL,
          unit_value  VARCHAR(50)   NULL,
          barcode     VARCHAR(100)  NULL,
          price       DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          sale_price  DECIMAL(10,2) NULL,
          created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
          updated_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
          INDEX idx_pvp_product (product_id),
          INDEX idx_pvp_flavor (flavor_id)
        )
      `);
      console.log('  ✅ Created "product_variation_prices" table successfully.');
    } else {
      console.log('  ⏭️  Table "product_variation_prices" already exists.');
    }
  } catch (err) {
    console.error('  ❌ Migration FAILED:', err.message);
    process.exit(1);
  }

  await conn.end();
  console.log('\n✅ product_variation_prices table migration complete.');
}

migrate().catch(err => {
  console.error('\n❌ Migration failed:', err.message);
  process.exit(1);
});
