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
    // 1. Add unit_id and unit_value to purchase_order_items
    const [poCol] = await conn.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchase_order_items' AND COLUMN_NAME = 'unit_id'
    `);
    if (poCol.length === 0) {
      await conn.execute(`
        ALTER TABLE purchase_order_items
        ADD COLUMN unit_id INT NULL AFTER flavor_id,
        ADD COLUMN unit_value VARCHAR(50) NULL AFTER unit_id
      `);
      console.log('  ✅ Added unit_id and unit_value to purchase_order_items.');
    } else {
      console.log('  ⏭️  unit_id already exists in purchase_order_items.');
    }

    // 2. Add unit_id and unit_value to bill_items
    const [billCol] = await conn.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bill_items' AND COLUMN_NAME = 'unit_id'
    `);
    if (billCol.length === 0) {
      await conn.execute(`
        ALTER TABLE bill_items
        ADD COLUMN unit_id INT NULL AFTER flavor_id,
        ADD COLUMN unit_value VARCHAR(50) NULL AFTER unit_id
      `);
      console.log('  ✅ Added unit_id and unit_value to bill_items.');
    } else {
      console.log('  ⏭️  unit_id already exists in bill_items.');
    }

  } catch (err) {
    console.error('❌ Migration error:', err.message);
  } finally {
    await conn.end();
  }
}

migrate();
