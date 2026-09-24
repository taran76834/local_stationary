/**
 * Add 'sales' role to users.role ENUM.
 * Usage: node database/add-sales-role.js
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
  console.log('⏳ Adding "sales" role to users.role ENUM...\n');

  try {
    // Modify the ENUM to include 'sales'
    await conn.execute(`
      ALTER TABLE users 
      MODIFY COLUMN role ENUM('admin', 'manager', 'store_minus', 'store_plus', 'sales') 
      NOT NULL DEFAULT 'admin'
    `);
    console.log('  ✅ ENUM "role" — Updated to include "sales"');
  } catch (err) {
    if (err.message.includes('Duplicate')) {
      console.log('  ℹ️  ENUM "role" — Already contains "sales"');
    } else {
      console.error('  ❌ Migration FAILED:', err.message);
      process.exit(1);
    }
  }

  await conn.end();
  console.log('\n✅ sales role migration complete.');
}

migrate().catch(err => {
  console.error('\n❌ Migration failed:', err.message);
  process.exit(1);
});
