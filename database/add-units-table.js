/**
 * Migration script: Create `units` table, `product_units` table, and add `unit_id` & `unit_value` to `product_flavor_prices`.
 * Usage: node database/add-units-table.js
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
  console.log('⏳ Running units migration...\n');

  try {
    // 1. Create units table
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS units (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        name       VARCHAR(50) NOT NULL UNIQUE,
        created_at TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✅ Table "units" created / verified.');

    // 2. Insert default standard units if empty
    const defaultUnits = ['kg', 'g', 'ml', 'L', 'lbs', 'pcs'];
    for (const unit of defaultUnits) {
      await conn.execute('INSERT IGNORE INTO units (name) VALUES (?)', [unit]);
    }
    console.log('  ✅ Seeded standard units (kg, g, ml, L, lbs, pcs).');

    // 3. Create product_units table
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS product_units (
        product_id INT NOT NULL,
        unit_id    INT NOT NULL,
        PRIMARY KEY (product_id, unit_id),
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (unit_id)    REFERENCES units(id)    ON DELETE CASCADE
      )
    `);
    console.log('  ✅ Table "product_units" created / verified.');

    // 4. Add unit_id and unit_value to product_variation_prices if not present
    const targetTable = (await conn.execute(`SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product_variation_prices'`))[0].length > 0
      ? 'product_variation_prices'
      : 'product_flavor_prices';

    const [colUnitId] = await conn.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'unit_id'
    `, [targetTable]);
    if (colUnitId.length === 0) {
      await conn.execute(`
        ALTER TABLE ${targetTable}
        ADD COLUMN unit_id INT NULL AFTER flavor_id,
        ADD COLUMN unit_value VARCHAR(50) NULL AFTER unit_id,
        ADD CONSTRAINT fk_pfp_unit FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE
      `);
      console.log(`  ✅ Added unit_id and unit_value to ${targetTable}.`);
    } else {
      console.log(`  ⏭️  unit_id already exists in ${targetTable}.`);
    }

    // 5. Make flavor_id NULL-able in target table
    await conn.execute(`
      ALTER TABLE ${targetTable} MODIFY COLUMN flavor_id INT NULL
    `);
    console.log(`  ✅ Allowed NULL values for flavor_id in ${targetTable}.`);

    // 6. Ensure explicit FK indexes exist before dropping composite unique index
    const [idxP] = await conn.execute(`
      SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = 'idx_pfp_product'
    `, [targetTable]);
    if (idxP.length === 0) {
      await conn.execute(`ALTER TABLE ${targetTable} ADD INDEX idx_pfp_product (product_id)`);
    }

    const [idxF] = await conn.execute(`
      SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = 'idx_pfp_flavor'
    `, [targetTable]);
    if (idxF.length === 0) {
      await conn.execute(`ALTER TABLE ${targetTable} ADD INDEX idx_pfp_flavor (flavor_id)`);
    }

    // 7. Drop old UNIQUE KEY uq_product_flavor if exists
    const [uqIndex] = await conn.execute(`
      SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = 'uq_product_flavor'
    `, [targetTable]);
    if (uqIndex.length > 0) {
      await conn.execute(`ALTER TABLE ${targetTable} DROP INDEX uq_product_flavor`);
      console.log('  ✅ Dropped old uq_product_flavor index to allow unit-based pricing variations.');
    } else {
      console.log('  ⏭️  uq_product_flavor index already dropped.');
    }

  } catch (err) {
    console.error('❌ Migration error:', err.message);
    process.exit(1);
  }

  await conn.end();
  console.log('\n✅ Units migration completed successfully.');
}

migrate().catch(err => {
  console.error('\n❌ Migration failed:', err.message);
  process.exit(1);
});
