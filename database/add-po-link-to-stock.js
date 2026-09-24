/**
 * Add purchase_order_id column to stock_items_new table to link stock to receipts
 * Usage: node database/add-po-link-to-stock.js
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
  console.log('⏳ Adding purchase_order_id link to stock_items_new...\n');

  try {
    // Check if purchase_order_id column exists
    const [colExists] = await conn.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME='stock_items_new' AND COLUMN_NAME='purchase_order_id' AND TABLE_SCHEMA=?
    `, [process.env.DB_NAME || 'store']);

    if (colExists.length === 0) {
      await conn.execute(`
        ALTER TABLE stock_items_new ADD COLUMN purchase_order_id INT NULL 
        AFTER store_id
      `);
      console.log('  ✅ Column "purchase_order_id" — Added to stock_items_new');

      // Add foreign key constraint
      await conn.execute(`
        ALTER TABLE stock_items_new 
        ADD CONSTRAINT fk_stock_po FOREIGN KEY (purchase_order_id) 
        REFERENCES purchase_orders(id) ON DELETE SET NULL
      `).catch(() => {
        // Constraint might already exist, ignore error
      });
      console.log('  ✅ Foreign key — Added for purchase_order_id');
    } else {
      console.log('  ℹ️  Column "purchase_order_id" — Already exists');
    }

  } catch (err) {
    console.error('  ❌ Migration FAILED:', err.message);
    process.exit(1);
  }

  await conn.end();
  console.log('\n✅ Stock-to-PO link migration complete.');
}

migrate().catch(err => {
  console.error('\n❌ Migration failed:', err.message);
  process.exit(1);
});
