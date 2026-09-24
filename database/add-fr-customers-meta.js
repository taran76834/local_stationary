/**
 * Migration script: Create fr_customers_meta table for frontend customer metadata.
 * Usage: node database/add-fr-customers-meta.js
 */

require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'invincible_store',
  });

  console.log('✅ Connected to MySQL database:', process.env.DB_NAME || 'invincible_store');

  try {
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS fr_customers_meta (
        id INT AUTO_INCREMENT PRIMARY KEY,
        fr_customer_id INT NOT NULL,
        meta_key VARCHAR(150) NOT NULL,
        meta_value TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_fr_customers_meta_customer FOREIGN KEY (fr_customer_id) REFERENCES fr_customers(id) ON DELETE CASCADE,
        UNIQUE KEY uq_fr_customer_meta_key (fr_customer_id, meta_key)
      )
    `);
    console.log('✅ Created table "fr_customers_meta".');

    // Track migration in fr_migrations
    await conn.execute(`
      INSERT IGNORE INTO fr_migrations (name) VALUES ('005_create_fr_customers_meta.sql')
    `);
    console.log('✅ Logged migration in fr_migrations.');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

run();
