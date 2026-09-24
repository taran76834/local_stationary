/**
 * Migration script: Cleanup legacy flavor and unit tables, remove is_flavor/is_size,
 * create master variation_types table, and update product_variation_prices to use attributes JSON.
 * Usage: node database/cleanup-legacy-flavor-unit-tables.js
 */

require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');

async function migrate() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'store',
    multipleStatements: true,
  });

  console.log('✅ Connected to MySQL database:', process.env.DB_NAME || 'store');
  console.log('⏳ Cleaning up legacy flavor/unit tables and setting up dynamic variation_types...\n');

  try {
    const dbName = process.env.DB_NAME || 'store';

    // 1. Drop legacy junction & master tables if they exist
    console.log('  ⏳ Dropping legacy tables (product_flavors, product_units, flavors, units)...');
    await conn.execute(`SET FOREIGN_KEY_CHECKS = 0`);
    await conn.execute(`DROP TABLE IF EXISTS product_flavors`);
    await conn.execute(`DROP TABLE IF EXISTS product_units`);
    await conn.execute(`DROP TABLE IF EXISTS flavors`);
    await conn.execute(`DROP TABLE IF EXISTS units`);
    await conn.execute(`SET FOREIGN_KEY_CHECKS = 1`);
    console.log('  ✅ Legacy tables dropped successfully.');

    // 2. Remove is_flavor and is_size from products if present
    const [flavorCol] = await conn.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'products' AND COLUMN_NAME = 'is_flavor'
    `, [dbName]);
    if (flavorCol.length > 0) {
      await conn.execute(`ALTER TABLE products DROP COLUMN is_flavor`);
      console.log('  ✅ Dropped column "is_flavor" from products table.');
    }

    const [sizeCol] = await conn.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'products' AND COLUMN_NAME = 'is_size'
    `, [dbName]);
    if (sizeCol.length > 0) {
      await conn.execute(`ALTER TABLE products DROP COLUMN is_size`);
      console.log('  ✅ Dropped column "is_size" from products table.');
    }

    // 3. Create variation_types table
    console.log('  ⏳ Creating "variation_types" table...');
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS variation_types (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        name       VARCHAR(100) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✅ Table "variation_types" created.');

    // Seed default variation types: Flavor, Weight, Strength
    const defaultTypes = ['Flavor', 'Weight', 'Strength'];
    for (const typeName of defaultTypes) {
      await conn.execute(
        `INSERT IGNORE INTO variation_types (name) VALUES (?)`,
        [typeName]
      );
    }
    console.log('  ✅ Default variation types seeded (Flavor, Weight, Strength).');

    // 4. Ensure product_variation_prices exists and has attributes column
    const [variationPriceTable] = await conn.execute(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'product_variation_prices'
    `, [dbName]);

    if (variationPriceTable.length === 0) {
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS product_variation_prices (
          id          INT AUTO_INCREMENT PRIMARY KEY,
          product_id  INT NOT NULL,
          attributes  JSON NOT NULL,
          price       DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          sale_price  DECIMAL(10,2) NULL,
          barcode     VARCHAR(100) NULL,
          created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
          INDEX idx_pvp_product (product_id)
        )
      `);
      console.log('  ✅ Created "product_variation_prices" table.');
    } else {
      // Check if attributes column exists
      const [attrCol] = await conn.execute(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'product_variation_prices' AND COLUMN_NAME = 'attributes'
      `, [dbName]);

      if (attrCol.length === 0) {
        await conn.execute(`ALTER TABLE product_variation_prices ADD COLUMN attributes JSON NULL AFTER product_id`);
        console.log('  ✅ Added "attributes" JSON column to product_variation_prices table.');
      }

      // Drop old foreign key constraints on product_variation_prices if they exist
      const [fkRows] = await conn.execute(`
        SELECT CONSTRAINT_NAME
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'product_variation_prices' AND REFERENCED_TABLE_NAME IS NOT NULL
          AND COLUMN_NAME IN ('flavor_id', 'unit_id')
      `, [dbName]);

      for (const fk of fkRows) {
        try {
          await conn.execute(`ALTER TABLE product_variation_prices DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\``);
          console.log(`  ✅ Dropped FK constraint "${fk.CONSTRAINT_NAME}".`);
        } catch (e) {
          // Ignore if already dropped
        }
      }

      // Drop old columns if they exist in product_variation_prices
      const oldCols = ['flavor_id', 'unit_id', 'unit_value'];
      await conn.execute(`SET FOREIGN_KEY_CHECKS = 0`);
      for (const colName of oldCols) {
        const [c] = await conn.execute(`
          SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'product_variation_prices' AND COLUMN_NAME = ?
        `, [dbName, colName]);
        if (c.length > 0) {
          try {
            await conn.execute(`ALTER TABLE product_variation_prices DROP COLUMN \`${colName}\``);
            console.log(`  ✅ Dropped legacy column "${colName}" from product_variation_prices.`);
          } catch (e) {
            console.log(`  ℹ️  Could not drop column "${colName}": ${e.message}`);
          }
        }
      }
      await conn.execute(`SET FOREIGN_KEY_CHECKS = 1`);
    }

  } catch (err) {
    console.error('  ❌ Migration FAILED:', err.message);
    process.exit(1);
  }

  await conn.end();
  console.log('\n✅ Legacy cleanup and dynamic variation migration complete.');
}

migrate().catch(err => {
  console.error('\n❌ Migration failed:', err.message);
  process.exit(1);
});
