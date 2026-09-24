/**
 * Migration: Add shipping_phone and shipping_email columns to fr_orders table.
 * Usage: node database/add-shipping-phone-email-to-orders.js
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

  // 1. Check fr_orders table existence
  const [tables] = await conn.execute(`SHOW TABLES LIKE 'fr_orders'`);
  if (tables.length === 0) {
    console.log('⚠️  Table "fr_orders" does not exist yet. Skipping alter.');
    await conn.end();
    return;
  }

  // 2. Check and add shipping_phone
  const [phoneCol] = await conn.execute(`
    SELECT COLUMN_NAME 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'fr_orders' 
      AND COLUMN_NAME = 'shipping_phone'
  `);

  if (phoneCol.length === 0) {
    console.log('⏳ Adding "shipping_phone" column to fr_orders...');
    await conn.execute(`
      ALTER TABLE fr_orders 
      ADD COLUMN shipping_phone VARCHAR(25) NULL AFTER shipping_postcode
    `);
    console.log('  ✅ "shipping_phone" column added.');
  } else {
    console.log('  ⏭️  "shipping_phone" column already exists.');
  }

  // 3. Check and add shipping_email
  const [emailCol] = await conn.execute(`
    SELECT COLUMN_NAME 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'fr_orders' 
      AND COLUMN_NAME = 'shipping_email'
  `);

  if (emailCol.length === 0) {
    console.log('⏳ Adding "shipping_email" column to fr_orders...');
    await conn.execute(`
      ALTER TABLE fr_orders 
      ADD COLUMN shipping_email VARCHAR(150) NULL AFTER shipping_phone
    `);
    console.log('  ✅ "shipping_email" column added.');
  } else {
    console.log('  ⏭️  "shipping_email" column already exists.');
  }

  // 4. Record in fr_migrations if table exists
  const [mTable] = await conn.execute(`SHOW TABLES LIKE 'fr_migrations'`);
  if (mTable.length > 0) {
    await conn.execute(
      `INSERT IGNORE INTO fr_migrations (name) VALUES ('005_add_shipping_phone_email_to_fr_orders.sql')`
    );
  }

  console.log('🎉 Migration add-shipping-phone-email-to-orders complete!\n');
  await conn.end();
}

run().catch((err) => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});
