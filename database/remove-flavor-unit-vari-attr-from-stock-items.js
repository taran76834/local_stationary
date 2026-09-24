import { getPool } from '../src/lib/db.js';

async function migrate() {
  const pool = getPool();
  const conn = await pool.getConnection();

  try {
    console.log('--- Migration: Clean up stock_items_new columns ---');

    // 1. Check/Add variation_id
    const [varIdCols] = await conn.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stock_items_new' AND COLUMN_NAME = 'variation_id'
    `);
    if (varIdCols.length === 0) {
      await conn.query(`ALTER TABLE stock_items_new ADD COLUMN variation_id INT NULL AFTER product_id`);
      console.log('  ✅ Added variation_id to stock_items_new');
    } else {
      console.log('  ⏭️  variation_id already exists in stock_items_new');
    }

    // 2. Drop FK and flavor_id if exists
    const [flavorCols] = await conn.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stock_items_new' AND COLUMN_NAME = 'flavor_id'
    `);
    if (flavorCols.length > 0) {
      // Check FK
      const [fks] = await conn.query(`
        SELECT CONSTRAINT_NAME
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stock_items_new' AND COLUMN_NAME = 'flavor_id' AND REFERENCED_TABLE_NAME IS NOT NULL
      `);
      for (const fk of fks) {
        await conn.query(`ALTER TABLE stock_items_new DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\``);
        console.log(`  ✅ Dropped foreign key ${fk.CONSTRAINT_NAME}`);
      }

      // Check index
      const [idxs] = await conn.query(`SHOW INDEX FROM stock_items_new WHERE Key_name = 'flavor_id'`);
      if (idxs.length > 0) {
        await conn.query(`ALTER TABLE stock_items_new DROP INDEX flavor_id`);
        console.log('  ✅ Dropped index flavor_id');
      }

      await conn.query(`ALTER TABLE stock_items_new DROP COLUMN flavor_id`);
      console.log('  ✅ Dropped flavor_id from stock_items_new');
    }

    // 3. Drop unit_id if exists
    const [unitCols] = await conn.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stock_items_new' AND COLUMN_NAME = 'unit_id'
    `);
    if (unitCols.length > 0) {
      await conn.query(`ALTER TABLE stock_items_new DROP COLUMN unit_id`);
      console.log('  ✅ Dropped unit_id from stock_items_new');
    }

    // 4. Drop unit_value if exists
    const [unitValCols] = await conn.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stock_items_new' AND COLUMN_NAME = 'unit_value'
    `);
    if (unitValCols.length > 0) {
      await conn.query(`ALTER TABLE stock_items_new DROP COLUMN unit_value`);
      console.log('  ✅ Dropped unit_value from stock_items_new');
    }

    // 5. Drop vari_attribute if exists
    const [variAttrCols] = await conn.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stock_items_new' AND COLUMN_NAME = 'vari_attribute'
    `);
    if (variAttrCols.length > 0) {
      await conn.query(`ALTER TABLE stock_items_new DROP COLUMN vari_attribute`);
      console.log('  ✅ Dropped vari_attribute from stock_items_new');
    }

    console.log('🎉 stock_items_new migration completed successfully.');
  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    conn.release();
    process.exit(0);
  }
}

migrate();
