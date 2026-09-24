/**
 * Run this script to create user_meta table in MySQL database.
 * Usage: node database/add-user-meta.js
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
  console.log('⏳ Creating user_meta table...\n');

  try {
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS user_meta (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        user_id    INT NOT NULL,
        \`key\`      VARCHAR(100) NOT NULL,
        \`value\`    TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY uq_user_key (user_id, \`key\`)
      )
    `);
    console.log('  ✅ Table "user_meta" — Created / Exists');
  } catch (err) {
    console.error('  ❌ Table "user_meta" — FAILED:', err.message);
    process.exit(1);
  }

  await conn.end();
  console.log('\n✅ user_meta migration complete.');
}

migrate().catch(err => {
  console.error('\n❌ Migration failed:', err.message);
  process.exit(1);
});
