/**
 * Add 'image' column to brands table.
 * Usage: node database/add-brand-image.js
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
  console.log('⏳ Adding "image" column to brands table...\n');

  try {
    const [cols] = await conn.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'brands' AND COLUMN_NAME = 'image'
    `);

    if (cols.length === 0) {
      await conn.execute(`ALTER TABLE brands ADD COLUMN image TEXT NULL AFTER name`);
      console.log('  ✅ Column "image" added to brands table');
    } else {
      console.log('  ⏭️  Column "image" already exists in brands table');
    }
  } catch (err) {
    console.error('  ❌ Migration FAILED:', err.message);
    process.exit(1);
  }

  await conn.end();
  console.log('\n✅ Brand image migration complete.');
}

migrate().catch(err => {
  console.error('\n❌ Migration failed:', err.message);
  process.exit(1);
});
