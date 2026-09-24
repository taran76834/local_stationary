require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '3306'),
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'store',
  });

  await conn.execute(
    "ALTER TABLE users MODIFY COLUMN role ENUM('admin','manager') NOT NULL DEFAULT 'admin'"
  );
  console.log('✅ Manager role added to users table.');
  await conn.end();
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });
