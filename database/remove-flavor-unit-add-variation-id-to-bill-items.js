/**
 * Migration script: Update bill_items schema for variations (add variation_id, vari_attribute and drop legacy columns).
 * Usage: node database/remove-flavor-unit-add-variation-id-to-bill-items.js
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
  });

  try {
    console.log('--- Migration: Update bill_items schema for variations ---');

    // 1. Check/Add variation_id
    const [varIdCols] = await conn.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bill_items' AND COLUMN_NAME = 'variation_id'
    `);
    if (varIdCols.length === 0) {
      await conn.execute(`ALTER TABLE bill_items ADD COLUMN variation_id INT NULL AFTER product_id`);
      console.log('  ✅ Added variation_id to bill_items');
    } else {
      console.log('  ⏭️  variation_id already exists in bill_items');
    }

    // 2. Check/Add vari_attribute
    const [variAttrCols] = await conn.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bill_items' AND COLUMN_NAME = 'vari_attribute'
    `);
    if (variAttrCols.length === 0) {
      await conn.execute(`ALTER TABLE bill_items ADD COLUMN vari_attribute LONGTEXT NULL AFTER variation_id`);
      console.log('  ✅ Added vari_attribute to bill_items');
    } else {
      console.log('  ⏭️  vari_attribute already exists in bill_items');
    }

    // 3. Drop FK and flavor_id if exists
    const [flavorCols] = await conn.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bill_items' AND COLUMN_NAME = 'flavor_id'
    `);
    if (flavorCols.length > 0) {
      const [fks] = await conn.execute(`
        SELECT CONSTRAINT_NAME
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bill_items' AND COLUMN_NAME = 'flavor_id' AND REFERENCED_TABLE_NAME IS NOT NULL
      `);
      for (const fk of fks) {
        try {
          await conn.execute(`ALTER TABLE bill_items DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\``);
          console.log(`  ✅ Dropped foreign key ${fk.CONSTRAINT_NAME} from bill_items`);
        } catch (e) {}
      }

      try {
        const [idxs] = await conn.execute(`SHOW INDEX FROM bill_items WHERE Key_name = 'flavor_id'`);
        if (idxs.length > 0) {
          await conn.execute(`ALTER TABLE bill_items DROP INDEX flavor_id`);
          console.log('  ✅ Dropped index flavor_id from bill_items');
        }
      } catch (e) {}

      try {
        await conn.execute(`ALTER TABLE bill_items DROP COLUMN flavor_id`);
        console.log('  ✅ Dropped flavor_id from bill_items');
      } catch (e) {}
    }

    // 4. Drop unit_id if exists
    const [unitCols] = await conn.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bill_items' AND COLUMN_NAME = 'unit_id'
    `);
    if (unitCols.length > 0) {
      try {
        await conn.execute(`ALTER TABLE bill_items DROP COLUMN unit_id`);
        console.log('  ✅ Dropped unit_id from bill_items');
      } catch (e) {}
    }

    // 5. Drop unit_value if exists
    const [unitValCols] = await conn.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bill_items' AND COLUMN_NAME = 'unit_value'
    `);
    if (unitValCols.length > 0) {
      try {
        await conn.execute(`ALTER TABLE bill_items DROP COLUMN unit_value`);
        console.log('  ✅ Dropped unit_value from bill_items');
      } catch (e) {}
    }

    console.log('🎉 bill_items migration completed successfully.');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

migrate();
