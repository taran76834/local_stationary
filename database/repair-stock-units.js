require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');

async function repair() {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '3306'),
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'store',
  });

  console.log('✅ Connected to MySQL database:', process.env.DB_NAME || 'store');
  console.log('⏳ Repairing stock units & variations...\n');

  try {
    // 1. Backfill purchase_order_items where unit_id IS NULL but product_variation_prices / product_flavor_prices has single/matching variation
    const targetTable = (await conn.execute(`SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product_variation_prices'`))[0].length > 0
      ? 'product_variation_prices'
      : 'product_flavor_prices';

    const [pfpRows] = await conn.execute(`
      SELECT pfp.product_id, pfp.flavor_id, pfp.unit_id, pfp.unit_value
      FROM ${targetTable} pfp
      WHERE pfp.unit_id IS NOT NULL AND pfp.unit_value IS NOT NULL AND pfp.unit_value != ''
    `);

    for (const pfp of pfpRows) {
      // Update purchase_order_items
      await conn.execute(`
        UPDATE purchase_order_items
        SET unit_id = ?, unit_value = ?
        WHERE product_id = ? AND (flavor_id = ? OR (flavor_id IS NULL AND ? IS NULL)) AND (unit_id IS NULL OR unit_value IS NULL)
      `, [pfp.unit_id, pfp.unit_value, pfp.product_id, pfp.flavor_id, pfp.flavor_id]);

      // Update stock_items_new
      await conn.execute(`
        UPDATE stock_items_new
        SET unit_id = ?, unit_value = ?
        WHERE product_id = ? AND (flavor_id = ? OR (flavor_id IS NULL AND ? IS NULL)) AND (unit_id IS NULL OR unit_value IS NULL)
      `, [pfp.unit_id, pfp.unit_value, pfp.product_id, pfp.flavor_id, pfp.flavor_id]);

      // Update store_products
      await conn.execute(`
        UPDATE store_products
        SET unit_id = ?, unit_value = ?
        WHERE product_id = ? AND (flavor_id = ? OR (flavor_id IS NULL AND ? IS NULL)) AND (unit_id IS NULL OR unit_value IS NULL)
      `, [pfp.unit_id, pfp.unit_value, pfp.product_id, pfp.flavor_id, pfp.flavor_id]);
    }

    console.log('  ✅ Backfilled unit_id and unit_value across stock_items_new, purchase_order_items, and store_products.');

  } catch (err) {
    console.error('❌ Repair error:', err.message);
  } finally {
    await conn.end();
  }
}

repair();
