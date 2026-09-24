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
    // 1. Check unit_id in stock_items_new
    const [sinCol] = await conn.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stock_items_new' AND COLUMN_NAME = 'unit_id'
    `);
    if (sinCol.length === 0) {
      await conn.execute(`
        ALTER TABLE stock_items_new
        ADD COLUMN unit_id INT NULL AFTER flavor_id,
        ADD COLUMN unit_value VARCHAR(50) NULL AFTER unit_id
      `);
      console.log('  ✅ Added unit_id and unit_value to stock_items_new.');
    } else {
      console.log('  ⏭️  unit_id already exists in stock_items_new.');
    }

    // 2. Check unit_id in store_products
    const [spCol] = await conn.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'store_products' AND COLUMN_NAME = 'unit_id'
    `);
    if (spCol.length === 0) {
      await conn.execute(`
        ALTER TABLE store_products
        ADD COLUMN unit_id INT NULL AFTER flavor_id,
        ADD COLUMN unit_value VARCHAR(50) NULL AFTER unit_id
      `);
      console.log('  ✅ Added unit_id and unit_value to store_products.');
    } else {
      console.log('  ⏭️  unit_id already exists in store_products.');
    }

  } catch (err) {
    console.error('❌ Migration error:', err.message);
  } finally {
    await conn.end();
  }
}

migrate();
