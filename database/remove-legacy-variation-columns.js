/**
 * Migration script: Remove legacy variation columns (flavor_id, unit_id, unit_value, vari_attribute)
 * from store_products, stock_transfers, bill_items, purchase_order_items, fr_order_items, and stock_items.
 *
 * Usage: node database/remove-legacy-variation-columns.js
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

async function columnExists(conn, tableName, columnName) {
  const [rows] = await conn.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [tableName, columnName]
  );
  return rows.length > 0;
}

async function fkExists(conn, tableName, constraintName) {
  const [rows] = await conn.execute(
    `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?`,
    [tableName, constraintName]
  );
  return rows.length > 0;
}

async function indexExists(conn, tableName, indexName) {
  const [rows] = await conn.execute(
    `SHOW INDEX FROM \`${tableName}\` WHERE Key_name = ?`,
    [indexName]
  );
  return rows.length > 0;
}

async function tableExists(conn, tableName) {
  const [rows] = await conn.execute(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [tableName]
  );
  return rows.length > 0;
}

async function run() {
  console.log('--- Migration: Remove legacy variation columns ---');
  let conn;
  try {
    conn = await mysql.createConnection(dbConfig);

    // 1. Clean up store_products
    console.log('Checking store_products table...');
    if (await tableExists(conn, 'store_products')) {
      if (await fkExists(conn, 'store_products', 'store_products_ibfk_3')) {
        await conn.query(`ALTER TABLE store_products DROP FOREIGN KEY store_products_ibfk_3`);
        console.log('  ✅ Dropped foreign key store_products_ibfk_3 from store_products');
      }

    if (!(await columnExists(conn, 'store_products', 'variation_id'))) {
      await conn.query(`ALTER TABLE store_products ADD COLUMN variation_id INT NULL AFTER product_id`);
      console.log('  ✅ Added variation_id to store_products');
    }

    if (!(await indexExists(conn, 'store_products', 'idx_store_products_store_id'))) {
      await conn.query(`ALTER TABLE store_products ADD INDEX idx_store_products_store_id (store_id)`);
      console.log('  ✅ Added index idx_store_products_store_id');
    }

    if (await indexExists(conn, 'store_products', 'uq_store_prod_flav')) {
      await conn.query(`ALTER TABLE store_products DROP INDEX uq_store_prod_flav`);
      console.log('  ✅ Dropped index uq_store_prod_flav from store_products');
    }
    if (await indexExists(conn, 'store_products', 'flavor_id')) {
      await conn.query(`ALTER TABLE store_products DROP INDEX flavor_id`);
      console.log('  ✅ Dropped index flavor_id from store_products');
    }

    const storeProdCols = ['flavor_id', 'unit_id', 'unit_value', 'vari_attribute'];
    for (const col of storeProdCols) {
      if (await columnExists(conn, 'store_products', col)) {
        await conn.query(`ALTER TABLE store_products DROP COLUMN \`${col}\``);
        console.log(`  ✅ Dropped column "${col}" from store_products`);
      }
    }
    } else {
      console.log('  ⏭️  store_products table does not exist (dropped)');
    }

    // 2. Clean up stock_transfers
    console.log('Checking stock_transfers table...');
    if (await tableExists(conn, 'stock_transfers')) {
      if (!(await columnExists(conn, 'stock_transfers', 'variation_id'))) {
        await conn.query(`ALTER TABLE stock_transfers ADD COLUMN variation_id INT NULL AFTER product_id`);
        console.log('  ✅ Added variation_id to stock_transfers');
      }
      const transferCols = ['flavor_id', 'unit_id', 'unit_value'];
      for (const col of transferCols) {
        if (await columnExists(conn, 'stock_transfers', col)) {
          await conn.query(`ALTER TABLE stock_transfers DROP COLUMN \`${col}\``);
          console.log(`  ✅ Dropped column "${col}" from stock_transfers`);
        }
      }
    } else {
      console.log('  ⏭️  stock_transfers table does not exist');
    }

    // 3. Clean up bill_items
    console.log('Checking bill_items table...');
    if (await fkExists(conn, 'bill_items', 'bill_items_ibfk_3')) {
      await conn.query(`ALTER TABLE bill_items DROP FOREIGN KEY bill_items_ibfk_3`);
      console.log('  ✅ Dropped foreign key bill_items_ibfk_3 from bill_items');
    }

    // 4. Clean up purchase_order_items
    console.log('Checking purchase_order_items table...');
    if (await columnExists(conn, 'purchase_order_items', 'vari_attribute')) {
      await conn.query(`ALTER TABLE purchase_order_items DROP COLUMN vari_attribute`);
      console.log('  ✅ Dropped column vari_attribute from purchase_order_items');
    }


    // 6. Clean up stock_items (legacy table)
    console.log('Checking stock_items table...');
    if (await tableExists(conn, 'stock_items')) {
      if (await fkExists(conn, 'stock_items', 'stock_items_ibfk_4')) {
        await conn.query(`ALTER TABLE stock_items DROP FOREIGN KEY stock_items_ibfk_4`);
        console.log('  ✅ Dropped foreign key stock_items_ibfk_4 from stock_items');
      }
      const stockItemsCols = ['flavor_id', 'unit_id', 'unit_value'];
      for (const col of stockItemsCols) {
        if (await columnExists(conn, 'stock_items', col)) {
          await conn.query(`ALTER TABLE stock_items DROP COLUMN \`${col}\``);
          console.log(`  ✅ Dropped column "${col}" from stock_items`);
        }
      }
    } else {
      console.log('  ⏭️  stock_items table does not exist (dropped)');
    }

    console.log('🎉 Legacy columns removal migration completed successfully.');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

run();
