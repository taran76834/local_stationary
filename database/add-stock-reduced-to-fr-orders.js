/**
 * Migration script: Ensure stock_reduced in fr_orders, and variant_id / vari_attribute in fr_order_items.
 * Usage: node database/add-stock-reduced-to-fr-orders.js
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
  console.log('⏳ Ensuring fr_orders and fr_order_items columns...\n');

  try {
    // 1. stock_reduced in fr_orders
    const [stockRedCols] = await conn.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fr_orders' AND COLUMN_NAME = 'stock_reduced'
    `);
    if (stockRedCols.length === 0) {
      await conn.execute(`ALTER TABLE fr_orders ADD COLUMN stock_reduced TINYINT(1) NOT NULL DEFAULT 0 AFTER status`);
      console.log('  ✅ Column "stock_reduced" added to fr_orders');
    } else {
      console.log('  ⏭️  Column "stock_reduced" already exists in fr_orders');
    }

    // 2. variant_id in fr_order_items
    const [varIdCols] = await conn.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fr_order_items' AND COLUMN_NAME = 'variant_id'
    `);
    if (varIdCols.length === 0) {
      await conn.execute(`ALTER TABLE fr_order_items ADD COLUMN variant_id INT NULL AFTER product_id`);
      console.log('  ✅ Column "variant_id" added to fr_order_items');
    } else {
      console.log('  ⏭️  Column "variant_id" already exists in fr_order_items');
    }

    // 3. vari_attribute in fr_order_items
    const [variAttrCols] = await conn.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fr_order_items' AND COLUMN_NAME = 'vari_attribute'
    `);
    if (variAttrCols.length === 0) {
      await conn.execute(`ALTER TABLE fr_order_items ADD COLUMN vari_attribute LONGTEXT NULL AFTER variant_id`);
      console.log('  ✅ Column "vari_attribute" added to fr_order_items');
    } else {
      console.log('  ⏭️  Column "vari_attribute" already exists in fr_order_items');
    }

  } catch (err) {
    console.error('  ❌ Migration FAILED:', err.message);
    process.exit(1);
  }

  await conn.end();
  console.log('\n✅ fr_orders & fr_order_items columns migration complete.');
}

migrate().catch(err => {
  console.error('\n❌ Migration failed:', err.message);
  process.exit(1);
});
