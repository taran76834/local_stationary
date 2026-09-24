/**
 * Migration script: Drop store_products table and add performance index to stock_items_new.
 *
 * Usage: node database/drop-store-products-table.js
 */

const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const dbConfig = {
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '3306'),
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'store',
};

async function indexExists(conn, tableName, indexName) {
  const [rows] = await conn.execute(
    `SHOW INDEX FROM \`${tableName}\` WHERE Key_name = ?`,
    [indexName]
  );
  return rows.length > 0;
}

async function run() {
  console.log('--- Migration: Drop store_products table ---');
  let conn;
  try {
    conn = await mysql.createConnection(dbConfig);

    // 1. Add composite index to stock_items_new for fast stock counting
    console.log('Adding performance index to stock_items_new...');
    const [varIdCols] = await conn.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stock_items_new' AND COLUMN_NAME = 'variation_id'`
    );
    if (varIdCols.length === 0) {
      await conn.query(`ALTER TABLE stock_items_new ADD COLUMN variation_id INT NULL AFTER product_id`);
      console.log('  ✅ Added variation_id to stock_items_new');
    }

    const idxName = 'idx_si_store_status_prod_var';
    if (!(await indexExists(conn, 'stock_items_new', idxName))) {
      await conn.query(
        `ALTER TABLE stock_items_new ADD INDEX ${idxName} (store_id, status, product_id, variation_id)`
      );
      console.log(`  ✅ Added index ${idxName} to stock_items_new`);
    } else {
      console.log(`  ⏭️  Index ${idxName} already exists on stock_items_new`);
    }

    // 2. Drop store_products table
    console.log('Dropping store_products table...');
    await conn.query(`DROP TABLE IF EXISTS store_products`);
    console.log('  ✅ Table store_products dropped successfully.');

    console.log('🎉 Migration completed successfully.');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

run();
