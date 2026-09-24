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

  console.log('Creating brands table...');
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS brands (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      name       VARCHAR(100) NOT NULL UNIQUE,
      created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('  ✅ brands table — OK');

  console.log('\n✅ Done.');
  await conn.end();
}

migrate().catch(err => { console.error('❌ Failed:', err.message); process.exit(1); });
