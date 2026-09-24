/**
 * Create product_images table for product gallery images.
 * Usage: node database/add-product-images.js
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
  console.log('⏳ Creating "product_images" table...\n');

  try {
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS product_images (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT          NOT NULL,
        image      TEXT         NOT NULL,
        sort_order INT          DEFAULT 0,
        created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        INDEX idx_product_images (product_id)
      )
    `);
    console.log('  ✅ Table "product_images" created successfully');
  } catch (err) {
    console.error('  ❌ Migration FAILED:', err.message);
    process.exit(1);
  }

  await conn.end();
  console.log('\n✅ product_images migration complete.');
}

migrate().catch(err => {
  console.error('\n❌ Migration failed:', err.message);
  process.exit(1);
});
