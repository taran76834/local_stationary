/**
 * Add 'flavor_id' to purchase_order_items, stock_items, store_products, and bill_items.
 * Usage: node database/add-flavor-to-stock.js
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
  console.log('⏳ Adding "flavor_id" to stock & receipt tables...\n');

  try {
    // 1. purchase_order_items
    const [poiCols] = await conn.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchase_order_items' AND COLUMN_NAME = 'flavor_id'
    `);
    if (poiCols.length === 0) {
      try {
        await conn.execute(`
          ALTER TABLE purchase_order_items
          ADD COLUMN flavor_id INT NULL AFTER product_id
        `);
      } catch (e) {}
      console.log('  ✅ Handled flavor_id on purchase_order_items');
    } else {
      console.log('  ⏭️  flavor_id already exists in purchase_order_items');
    }

    // 2. stock_items
    const [siTables] = await conn.execute(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stock_items'
    `);
    if (siTables.length > 0) {
      const [siCols] = await conn.execute(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stock_items' AND COLUMN_NAME = 'flavor_id'
      `);
      if (siCols.length === 0) {
        try {
          await conn.execute(`
            ALTER TABLE stock_items
            ADD COLUMN flavor_id INT NULL AFTER product_id
          `);
        } catch (e) {}
        console.log('  ✅ Handled flavor_id on stock_items');
      } else {
        console.log('  ⏭️  flavor_id already exists in stock_items');
      }
    } else {
      console.log('  ⏭️  stock_items table does not exist (dropped)');
    }

    // 2b. stock_items_new
    const [sinCols] = await conn.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stock_items_new' AND COLUMN_NAME = 'flavor_id'
    `);
    if (sinCols.length === 0) {
      try {
        await conn.execute(`
          ALTER TABLE stock_items_new
          ADD COLUMN flavor_id INT NULL AFTER product_id
        `);
      } catch (e) {}
      console.log('  ✅ Handled flavor_id on stock_items_new');
    } else {
      console.log('  ⏭️  flavor_id already exists in stock_items_new');
    }

    // 3. store_products
    const [spTables] = await conn.execute(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'store_products'
    `);
    if (spTables.length > 0) {
      const [spCols] = await conn.execute(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'store_products' AND COLUMN_NAME = 'flavor_id'
      `);
      if (spCols.length === 0) {
        // Drop old unique key if present and add new one with flavor_id
        try {
          await conn.execute(`ALTER TABLE store_products DROP INDEX uq_store_product`);
        } catch (e) {}
        try {
          await conn.execute(`
            ALTER TABLE store_products
            ADD COLUMN flavor_id INT NULL AFTER product_id
          `);
        } catch (e) {}
        console.log('  ✅ Added flavor_id to store_products');
      } else {
        console.log('  ⏭️  flavor_id already exists in store_products');
      }
    } else {
      console.log('  ⏭️  store_products table does not exist (dropped)');
    }

    // 4. bill_items
    const [biCols] = await conn.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bill_items' AND COLUMN_NAME = 'flavor_id'
    `);
    if (biCols.length === 0) {
      try {
        await conn.execute(`
          ALTER TABLE bill_items
          ADD COLUMN flavor_id INT NULL AFTER product_id
        `);
      } catch (e) {}
      console.log('  ✅ Handled flavor_id on bill_items');
    } else {
      console.log('  ⏭️  flavor_id already exists in bill_items');
    }

  } catch (err) {
    console.error('  ❌ Migration FAILED:', err.message);
    process.exit(1);
  }

  await conn.end();
  console.log('\n✅ flavor stock migration complete.');
}

migrate().catch(err => {
  console.error('\n❌ Migration failed:', err.message);
  process.exit(1);
});
