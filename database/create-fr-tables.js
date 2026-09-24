/**
 * Migration script: Create frontend (fr_) tables and ensure fr_orders schema matches specs.
 * Usage: node database/create-fr-tables.js
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
    multipleStatements: true,
  });

  console.log('✅ Connected to MySQL database:', process.env.DB_NAME || 'invincible_store');
  console.log('⏳ Creating/Updating frontend (fr_) tables...\n');

  // 1. fr_migrations
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS fr_migrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('  ✅ Table "fr_migrations" — OK');

  // 2. fr_customers
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS fr_customers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      email VARCHAR(150) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      phone VARCHAR(20) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  console.log('  ✅ Table "fr_customers" — OK');

  // 2b. fr_customers_meta
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
  console.log('  ✅ Table "fr_customers_meta" — OK');

  // 3. fr_favorites
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS fr_favorites (
      id INT AUTO_INCREMENT PRIMARY KEY,
      customer_id INT NOT NULL,
      product_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY customer_product_unique (customer_id, product_id),
      CONSTRAINT fk_fr_favorites_customer FOREIGN KEY (customer_id) REFERENCES fr_customers(id) ON DELETE CASCADE
    )
  `);
  console.log('  ✅ Table "fr_favorites" — OK');

  // 4. fr_orders
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS fr_orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_number VARCHAR(50) NOT NULL UNIQUE,
      customer_id INT NULL,
      billing_first_name VARCHAR(100) NOT NULL,
      billing_last_name VARCHAR(100) NOT NULL,
      billing_country VARCHAR(100) NOT NULL DEFAULT 'India',
      billing_address_1 VARCHAR(255) NOT NULL,
      billing_address_2 VARCHAR(255) NULL,
      billing_city VARCHAR(100) NOT NULL,
      billing_state VARCHAR(100) NOT NULL,
      billing_postcode VARCHAR(20) NOT NULL,
      billing_phone VARCHAR(25) NOT NULL,
      billing_email VARCHAR(150) NOT NULL,
      ship_to_different_address TINYINT(1) DEFAULT 0,
      shipping_first_name VARCHAR(100) NULL,
      shipping_last_name VARCHAR(100) NULL,
      shipping_country VARCHAR(100) NULL,
      shipping_address_1 VARCHAR(255) NULL,
      shipping_address_2 VARCHAR(255) NULL,
      shipping_city VARCHAR(100) NULL,
      shipping_state VARCHAR(100) NULL,
      shipping_postcode VARCHAR(20) NULL,
      shipping_phone VARCHAR(25) NULL,
      shipping_email VARCHAR(150) NULL,
      order_notes TEXT NULL,
      subtotal DECIMAL(10, 2) NOT NULL,
      shipping_fee DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
      total_amount DECIMAL(10, 2) NOT NULL,
      payment_method VARCHAR(50) NOT NULL DEFAULT 'razorpay',
      payment_status VARCHAR(50) NOT NULL DEFAULT 'pending',
      razorpay_order_id VARCHAR(100) NULL,
      razorpay_payment_id VARCHAR(100) NULL,
      razorpay_signature VARCHAR(255) NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      stock_reduced TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_fr_orders_customer FOREIGN KEY (customer_id) REFERENCES fr_customers(id) ON DELETE SET NULL
    )
  `);
  console.log('  ✅ Table "fr_orders" — OK');

  // 5. fr_order_items
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS fr_order_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id INT NOT NULL,
      product_id INT NOT NULL,
      variant_id INT NULL,
      vari_attribute LONGTEXT NULL,
      product_name VARCHAR(255) NOT NULL,
      price DECIMAL(10, 2) NOT NULL,
      quantity INT NOT NULL DEFAULT 1,
      subtotal DECIMAL(10, 2) NOT NULL,
      CONSTRAINT fk_fr_order_items_order FOREIGN KEY (order_id) REFERENCES fr_orders(id) ON DELETE CASCADE
    )
  `);
  console.log('  ✅ Table "fr_order_items" — OK');

  // Ensure stock_reduced column exists in fr_orders
  const [stockRed] = await conn.execute(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fr_orders' AND COLUMN_NAME = 'stock_reduced'`);
  if (stockRed.length === 0) {
    await conn.execute(`ALTER TABLE fr_orders ADD COLUMN stock_reduced TINYINT(1) NOT NULL DEFAULT 0 AFTER status`);
    console.log('  ✅ Added stock_reduced to fr_orders');
  }

  // Ensure shipping_phone and shipping_email exist in fr_orders
  const [sPhone] = await conn.execute(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fr_orders' AND COLUMN_NAME = 'shipping_phone'`);
  if (sPhone.length === 0) {
    await conn.execute(`ALTER TABLE fr_orders ADD COLUMN shipping_phone VARCHAR(25) NULL AFTER shipping_postcode`);
    console.log('  ✅ Added shipping_phone to fr_orders');
  }

  const [sEmail] = await conn.execute(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fr_orders' AND COLUMN_NAME = 'shipping_email'`);
  if (sEmail.length === 0) {
    await conn.execute(`ALTER TABLE fr_orders ADD COLUMN shipping_email VARCHAR(150) NULL AFTER shipping_phone`);
    console.log('  ✅ Added shipping_email to fr_orders');
  }

  // Ensure variant_id & vari_attribute exist in fr_order_items
  const [varIdCol] = await conn.execute(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fr_order_items' AND COLUMN_NAME = 'variant_id'`);
  if (varIdCol.length === 0) {
    await conn.execute(`ALTER TABLE fr_order_items ADD COLUMN variant_id INT NULL AFTER product_id`);
    console.log('  ✅ Added variant_id to fr_order_items');
  }

  const [variAttrCol] = await conn.execute(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fr_order_items' AND COLUMN_NAME = 'vari_attribute'`);
  if (variAttrCol.length === 0) {
    await conn.execute(`ALTER TABLE fr_order_items ADD COLUMN vari_attribute LONGTEXT NULL AFTER variant_id`);
    console.log('  ✅ Added vari_attribute to fr_order_items');
  }

  // Drop billing_company & shipping_company if present
  const [bComp] = await conn.execute(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fr_orders' AND COLUMN_NAME = 'billing_company'`);
  if (bComp.length > 0) {
    await conn.execute(`ALTER TABLE fr_orders DROP COLUMN billing_company`);
    console.log('  ✅ Dropped billing_company from fr_orders');
  }

  const [sComp] = await conn.execute(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fr_orders' AND COLUMN_NAME = 'shipping_company'`);
  if (sComp.length > 0) {
    await conn.execute(`ALTER TABLE fr_orders DROP COLUMN shipping_company`);
    console.log('  ✅ Dropped shipping_company from fr_orders');
  }

  // Record migrations in fr_migrations if missing
  const migrationsToRecord = [
    '001_create_fr_customers.sql',
    '002_create_fr_favorites.sql',
    '003_create_fr_orders.sql',
    '004_remove_company_from_fr_orders.sql',
    '005_add_shipping_phone_email_to_fr_orders.sql'
  ];

  for (const mName of migrationsToRecord) {
    await conn.execute(`INSERT IGNORE INTO fr_migrations (name) VALUES (?)`, [mName]);
  }
  console.log('  ✅ Migration tracking updated in fr_migrations.');

  console.log('\n🎉 Frontend migration tables setup complete!');
  await conn.end();
}

run().catch(err => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});
