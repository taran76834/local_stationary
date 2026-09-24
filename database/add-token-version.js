/**
 * Add token_version column to users table for JWT invalidation on password change.
 * Usage: node database/add-token-version.js
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
  console.log('⏳ Adding token_version column to users table...\n');

  try {
    // Check if column already exists
    const [rows] = await conn.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME='users' AND COLUMN_NAME='token_version' AND TABLE_SCHEMA=?
    `, [process.env.DB_NAME || 'store']);

    if (rows.length === 0) {
      await conn.execute(`
        ALTER TABLE users ADD COLUMN token_version INT DEFAULT 1
      `);
      console.log('  ✅ Column "token_version" — Added to users table');
    } else {
      console.log('  ℹ️  Column "token_version" — Already exists');
    }
  } catch (err) {
    console.error('  ❌ Migration FAILED:', err.message);
    process.exit(1);
  }

  await conn.end();
  console.log('\n✅ token_version migration complete.');
}

migrate().catch(err => {
  console.error('\n❌ Migration failed:', err.message);
  process.exit(1);
});
