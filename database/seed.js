/**
 * Run this script once to seed the default admin user.
 * Usage: node database/seed.js
 *
 * Make sure your .env.local is configured and MySQL is running.
 */

require('dotenv').config({ path: '.env.local' });
const mysql   = require('mysql2/promise');
const bcrypt  = require('bcryptjs');

async function seed() {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '3306'),
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'store',
  });

  const hash = await bcrypt.hash('admin123', 10);

  await conn.execute(`
    INSERT INTO users (name, email, password, role)
    VALUES (?, ?, ?, 'admin')
    ON DUPLICATE KEY UPDATE password = VALUES(password)
  `, ['Admin', 'admin@store.com', hash]);

  console.log('✅ Admin user seeded.');
  console.log('   Email:    admin@store.com');
  console.log('   Password: admin123');
  console.log('   ⚠️  Change the password after first login!');

  await conn.end();
}

seed().catch(err => { console.error(err); process.exit(1); });
