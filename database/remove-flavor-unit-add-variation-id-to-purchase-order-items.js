/**
 * Migration script: Drop legacy columns (flavor_id, unit_id, unit_value) and add variation_id (INT NULL) to purchase_order_items table.
 * Usage: node database/remove-flavor-unit-add-variation-id-to-purchase-order-items.js
 */

require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');

async function migrate() {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '3306'),
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'invincible_store',
  });

  console.log('Connected to MySQL database:', process.env.DB_NAME || 'invincible_store');
  console.log('Modifying purchase_order_items: removing flavor_id/unit_id/unit_value and adding variation_id...\n');

  try {
    const dbName = process.env.DB_NAME || 'invincible_store';

    // Check if table purchase_order_items exists
    const [tableCheck] = await conn.execute(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'purchase_order_items'
    `, [dbName]);

    if (tableCheck.length === 0) {
      console.log('Table purchase_order_items does not exist.');
      process.exit(0);
    }

    // 1. Add variation_id column if missing
    const [varCheck] = await conn.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'purchase_order_items' AND COLUMN_NAME = 'variation_id'
    `, [dbName]);

    if (varCheck.length === 0) {
      await conn.execute(`ALTER TABLE purchase_order_items ADD COLUMN variation_id INT NULL AFTER product_id`);
      console.log('✅ Added "variation_id" INT column to purchase_order_items.');
    } else {
      console.log('ℹ️ Column "variation_id" already exists in purchase_order_items.');
    }

    // Add foreign key for variation_id if product_variation_prices exists
    try {
      const [fkCheck] = await conn.execute(`
        SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'purchase_order_items' AND COLUMN_NAME = 'variation_id' AND REFERENCED_TABLE_NAME IS NOT NULL
      `, [dbName]);

      if (fkCheck.length === 0) {
        await conn.execute(`
          ALTER TABLE purchase_order_items 
          ADD CONSTRAINT fk_poi_variation FOREIGN KEY (variation_id) REFERENCES product_variation_prices(id) ON DELETE SET NULL
        `);
        console.log('✅ Added foreign key constraint for variation_id -> product_variation_prices(id).');
      }
    } catch (e) {
      console.log('  ℹ️  Foreign key constraint skipped or already exists:', e.message);
    }

    // 2. Drop legacy foreign keys & columns (flavor_id, unit_id, unit_value)
    const legacyCols = ['flavor_id', 'unit_id', 'unit_value'];
    for (const colName of legacyCols) {
      const [colCheck] = await conn.execute(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'purchase_order_items' AND COLUMN_NAME = ?
      `, [dbName, colName]);

      if (colCheck.length > 0) {
        // Drop any foreign key referencing this column first
        const [fkRows] = await conn.execute(`
          SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
          WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'purchase_order_items' AND COLUMN_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL
        `, [dbName, colName]);

        for (const fk of fkRows) {
          try {
            await conn.execute(`ALTER TABLE purchase_order_items DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\``);
            console.log(`  ✅ Dropped foreign key "${fk.CONSTRAINT_NAME}" on ${colName}.`);
          } catch (err) {
            // Ignore if fails
          }
        }

        await conn.execute(`ALTER TABLE purchase_order_items DROP COLUMN \`${colName}\``);
        console.log(`✅ Dropped legacy column "${colName}" from purchase_order_items.`);
      } else {
        console.log(`ℹ️ Column "${colName}" does not exist in purchase_order_items.`);
      }
    }

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await conn.end();
  }

  console.log('\nMigration for purchase_order_items complete.');
}

migrate();
