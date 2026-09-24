/**
 * Migration script: Add delete_status column to products table for soft delete support.
 * Usage: node database/add-delete-status-to-products.js
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
  console.log('⏳ Checking "delete_status" column in "products" table...\n');

  try {
    const dbName = process.env.DB_NAME || 'store';
    const [cols] = await conn.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'products' AND COLUMN_NAME = 'delete_status'
    `, [dbName]);

    if (cols.length === 0) {
      await conn.execute(`ALTER TABLE products ADD COLUMN delete_status VARCHAR(20) NULL DEFAULT NULL`);
      console.log('  ✅ Added "delete_status" column to products table.');
    } else {
      console.log('  ℹ️  Column "delete_status" already exists in products table.');
    }

    const [idx] = await conn.execute(`
      SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'products' AND INDEX_NAME = 'idx_products_delete_status'
    `, [dbName]);

    if (idx.length === 0) {
      await conn.execute(`ALTER TABLE products ADD INDEX idx_products_delete_status (delete_status)`);
      console.log('  ✅ Added index "idx_products_delete_status" to products table.');
    } else {
      console.log('  ℹ️  Index "idx_products_delete_status" already exists in products table.');
    }

  } catch (err) {
    console.error('  ❌ Migration FAILED:', err.message);
    process.exit(1);
  }

  await conn.end();
  console.log('\n✅ Migration complete: delete_status column verified.');
}

migrate().catch(err => {
  console.error('\n❌ Migration failed:', err.message);
  process.exit(1);
});
