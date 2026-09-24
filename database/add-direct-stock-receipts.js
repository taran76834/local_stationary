/**
 * Add support for direct stock receipts:
 * - Add store_id to purchase_orders table
 * - Add created_by to purchase_orders table
 * - Update status ENUM to include 'direct'
 * Usage: node database/add-direct-stock-receipts.js
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
  console.log('⏳ Adding direct stock receipt support...\n');

  try {
    // Check if store_id column exists
    const [storeIdCol] = await conn.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME='purchase_orders' AND COLUMN_NAME='store_id' AND TABLE_SCHEMA=?
    `, [process.env.DB_NAME || 'store']);

    if (storeIdCol.length === 0) {
      await conn.execute(`
        ALTER TABLE purchase_orders ADD COLUMN store_id INT NULL 
        AFTER id
      `);
      console.log('  ✅ Column "store_id" — Added to purchase_orders');
    } else {
      console.log('  ℹ️  Column "store_id" — Already exists');
    }

    // Check if created_by column exists
    const [createdByCol] = await conn.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME='purchase_orders' AND COLUMN_NAME='created_by' AND TABLE_SCHEMA=?
    `, [process.env.DB_NAME || 'store']);

    if (createdByCol.length === 0) {
      await conn.execute(`
        ALTER TABLE purchase_orders ADD COLUMN created_by INT NULL 
        AFTER store_id
      `);
      console.log('  ✅ Column "created_by" — Added to purchase_orders');
    } else {
      console.log('  ℹ️  Column "created_by" — Already exists');
    }

    // Update status ENUM to include 'direct'
    await conn.execute(`
      ALTER TABLE purchase_orders 
      MODIFY COLUMN status ENUM('pending','received','cancelled','direct') 
      NOT NULL DEFAULT 'pending'
    `);
    console.log('  ✅ ENUM "status" — Updated to include "direct"');

    // Add foreign key for store_id if it doesn't exist
    const [fkStore] = await conn.execute(`
      SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_NAME='purchase_orders' AND COLUMN_NAME='store_id' 
      AND REFERENCED_TABLE_NAME='stores' AND TABLE_SCHEMA=?
    `, [process.env.DB_NAME || 'store']);

    if (fkStore.length === 0) {
      await conn.execute(`
        ALTER TABLE purchase_orders 
        ADD CONSTRAINT fk_po_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL
      `).catch(() => {
        // Constraint might already exist
      });
      console.log('  ✅ Foreign key — Added for store_id');
    }

    // Add foreign key for created_by if it doesn't exist
    const [fkUser] = await conn.execute(`
      SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_NAME='purchase_orders' AND COLUMN_NAME='created_by' 
      AND REFERENCED_TABLE_NAME='users' AND TABLE_SCHEMA=?
    `, [process.env.DB_NAME || 'store']);

    if (fkUser.length === 0) {
      await conn.execute(`
        ALTER TABLE purchase_orders 
        ADD CONSTRAINT fk_po_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      `).catch(() => {
        // Constraint might already exist
      });
      console.log('  ✅ Foreign key — Added for created_by');
    }

  } catch (err) {
    console.error('  ❌ Migration FAILED:', err.message);
    process.exit(1);
  }

  await conn.end();
  console.log('\n✅ Direct stock receipts migration complete.');
}

migrate().catch(err => {
  console.error('\n❌ Migration failed:', err.message);
  process.exit(1);
});
