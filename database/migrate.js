/**
 * Migration script: Create all tables and apply all column patches in MySQL database.
 * Usage: node database/migrate.js
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
  console.log('⏳ Running migrations...\n');

  const tables = [
    {
      name: 'stores',
      sql: `
        CREATE TABLE IF NOT EXISTS stores (
          id         INT AUTO_INCREMENT PRIMARY KEY,
          name       VARCHAR(150) NOT NULL UNIQUE,
          address    TEXT,
          phone      VARCHAR(30),
          created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
        )
      `,
    },
    {
      name: 'users',
      sql: `
        CREATE TABLE IF NOT EXISTS users (
          id         INT AUTO_INCREMENT PRIMARY KEY,
          name       VARCHAR(100)  NOT NULL,
          email      VARCHAR(150)  NOT NULL UNIQUE,
          password   VARCHAR(255)  NOT NULL,
          role       ENUM('admin','manager','store_minus','store_plus','sales') NOT NULL DEFAULT 'admin',
          created_at TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
        )
      `,
    },
    {
      name: 'user_meta',
      sql: `
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
      `,
    },
    {
      name: 'categories',
      sql: `
        CREATE TABLE IF NOT EXISTS categories (
          id         INT AUTO_INCREMENT PRIMARY KEY,
          name       VARCHAR(100) NOT NULL UNIQUE,
          image      TEXT,
          slug       VARCHAR(150) UNIQUE,
          created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
        )
      `,
    },
    {
      name: 'flavors',
      sql: `
        CREATE TABLE IF NOT EXISTS flavors (
          id         INT AUTO_INCREMENT PRIMARY KEY,
          name       VARCHAR(100) NOT NULL UNIQUE,
          created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
        )
      `,
    },
    {
      name: 'units',
      sql: `
        CREATE TABLE IF NOT EXISTS units (
          id         INT AUTO_INCREMENT PRIMARY KEY,
          name       VARCHAR(50)  NOT NULL UNIQUE,
          created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
        )
      `,
    },
    {
      name: 'brands',
      sql: `
        CREATE TABLE IF NOT EXISTS brands (
          id         INT AUTO_INCREMENT PRIMARY KEY,
          name       VARCHAR(100) NOT NULL UNIQUE,
          image      TEXT NULL,
          created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
        )
      `,
    },
    {
      name: 'products',
      sql: `
        CREATE TABLE IF NOT EXISTS products (
          id          INT AUTO_INCREMENT PRIMARY KEY,
          name        VARCHAR(150)  NOT NULL,
          product_type VARCHAR(50)  NOT NULL DEFAULT 'simple_product',
          is_flavor   TINYINT(1)    NOT NULL DEFAULT 0,
          is_size     TINYINT(1)    NOT NULL DEFAULT 0,
          sell_on_website TINYINT(1) NOT NULL DEFAULT 0,
          barcode     VARCHAR(100)  UNIQUE,
          price       DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          sale_price  DECIMAL(10,2) NULL,
          description TEXT,
          image       TEXT,
          slug        VARCHAR(150) UNIQUE,
          delete_status VARCHAR(20) NULL DEFAULT NULL,
          created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
          updated_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `,
    },
    {
      name: 'product_categories',
      sql: `
        CREATE TABLE IF NOT EXISTS product_categories (
          product_id  INT NOT NULL,
          category_id INT NOT NULL,
          PRIMARY KEY (product_id, category_id),
          FOREIGN KEY (product_id)  REFERENCES products(id)   ON DELETE CASCADE,
          FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
        )
      `,
    },
    {
      name: 'product_flavors',
      sql: `
        CREATE TABLE IF NOT EXISTS product_flavors (
          product_id INT NOT NULL,
          flavor_id  INT NOT NULL,
          PRIMARY KEY (product_id, flavor_id),
          FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
          FOREIGN KEY (flavor_id)  REFERENCES flavors(id)  ON DELETE CASCADE
        )
      `,
    },
    {
      name: 'product_units',
      sql: `
        CREATE TABLE IF NOT EXISTS product_units (
          product_id INT NOT NULL,
          unit_id    INT NOT NULL,
          PRIMARY KEY (product_id, unit_id),
          FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
          FOREIGN KEY (unit_id)    REFERENCES units(id)    ON DELETE CASCADE
        )
      `,
    },
    {
      name: 'product_brands',
      sql: `
        CREATE TABLE IF NOT EXISTS product_brands (
          product_id INT NOT NULL,
          brand_id   INT NOT NULL,
          PRIMARY KEY (product_id, brand_id),
          FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
          FOREIGN KEY (brand_id)   REFERENCES brands(id)   ON DELETE CASCADE
        )
      `,
    },
    {
      name: 'suppliers',
      sql: `
        CREATE TABLE IF NOT EXISTS suppliers (
          id         INT AUTO_INCREMENT PRIMARY KEY,
          name       VARCHAR(150) NOT NULL,
          contact    VARCHAR(100),
          phone      VARCHAR(30),
          email      VARCHAR(150),
          address    TEXT,
          created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
        )
      `,
    },
    {
      name: 'purchase_orders',
      sql: `
        CREATE TABLE IF NOT EXISTS purchase_orders (
          id           INT AUTO_INCREMENT PRIMARY KEY,
          order_number VARCHAR(50)   NOT NULL UNIQUE,
          supplier_id  INT           NULL,
          status       ENUM('pending','received','cancelled') NOT NULL DEFAULT 'pending',
          total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          notes        TEXT,
          ordered_at   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
          updated_at   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
        )
      `,
    },
    {
      name: 'purchase_order_items',
      sql: `
        CREATE TABLE IF NOT EXISTS purchase_order_items (
          id                INT AUTO_INCREMENT PRIMARY KEY,
          purchase_order_id INT           NOT NULL,
          product_id        INT           NOT NULL,
          flavor_id         INT           NULL,
          unit_id           INT           NULL,
          unit_value        VARCHAR(50)   NULL,
          quantity          INT           NOT NULL DEFAULT 1,
          unit_cost         DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          subtotal          DECIMAL(10,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
          FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
          FOREIGN KEY (product_id)        REFERENCES products(id)        ON DELETE CASCADE
        )
      `,
    },
    {
      name: 'bills',
      sql: `
        CREATE TABLE IF NOT EXISTS bills (
          id             INT AUTO_INCREMENT PRIMARY KEY,
          bill_number    VARCHAR(50)   NOT NULL UNIQUE,
          store_id       INT           NULL,
          customer_name  VARCHAR(150),
          customer_phone VARCHAR(30),
          status         ENUM('draft','paid','cancelled') NOT NULL DEFAULT 'paid',
          total_amount   DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          discount       DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          tax            DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          notes          TEXT,
          created_at     TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
          updated_at     TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL
        )
      `,
    },
    {
      name: 'store_products',
      sql: `
        CREATE TABLE IF NOT EXISTS store_products (
          id         INT AUTO_INCREMENT PRIMARY KEY,
          store_id   INT NOT NULL,
          product_id INT NOT NULL,
          flavor_id  INT NULL,
          unit_id    INT NULL,
          unit_value VARCHAR(50) NULL,
          stock      INT NOT NULL DEFAULT 0,
          FOREIGN KEY (store_id)   REFERENCES stores(id)   ON DELETE CASCADE,
          FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
        )
      `,
    },
    {
      name: 'stock_items',
      sql: `
        CREATE TABLE IF NOT EXISTS stock_items (
          id                INT AUTO_INCREMENT PRIMARY KEY,
          store_id          INT NOT NULL,
          product_id        INT NOT NULL,
          flavor_id         INT NULL,
          unit_id           INT NULL,
          unit_value        VARCHAR(50) NULL,
          purchase_order_id INT NULL,
          expiry_date       DATE NULL,
          status            ENUM('available','sold','expired') NOT NULL DEFAULT 'available',
          bill_item_id      INT NULL,
          created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (store_id)          REFERENCES stores(id)          ON DELETE CASCADE,
          FOREIGN KEY (product_id)        REFERENCES products(id)        ON DELETE CASCADE,
          FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE SET NULL
        )
      `,
    },
    {
      name: 'stock_items_new',
      sql: `
        CREATE TABLE IF NOT EXISTS stock_items_new (
          id                INT AUTO_INCREMENT PRIMARY KEY,
          store_id          INT NOT NULL,
          product_id        INT NOT NULL,
          flavor_id         INT NULL,
          unit_id           INT NULL,
          unit_value        VARCHAR(50) NULL,
          purchase_order_id INT NULL,
          expiry_date       DATE NULL,
          status            ENUM('available','sold','expired','oversold') NOT NULL DEFAULT 'available',
          bill_item_id      INT NULL,
          created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (store_id)          REFERENCES stores(id)          ON DELETE CASCADE,
          FOREIGN KEY (product_id)        REFERENCES products(id)        ON DELETE CASCADE,
          FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE SET NULL,
          INDEX idx_stock_new_status (status),
          INDEX idx_stock_new_store_status (store_id, status)
        )
      `,
    },
    {
      name: 'bill_items',
      sql: `
        CREATE TABLE IF NOT EXISTS bill_items (
          id             INT AUTO_INCREMENT PRIMARY KEY,
          bill_id        INT           NOT NULL,
          product_id     INT           NOT NULL,
          variation_id   INT           NULL,
          vari_attribute LONGTEXT      NULL,
          quantity       INT           NOT NULL DEFAULT 1,
          unit_price     DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          subtotal       DECIMAL(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
          FOREIGN KEY (bill_id)    REFERENCES bills(id)    ON DELETE CASCADE,
          FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
        )
      `,
    },
    {
      name: 'product_tags',
      sql: `
        CREATE TABLE IF NOT EXISTS product_tags (
          id         INT AUTO_INCREMENT PRIMARY KEY,
          product_id INT          NOT NULL,
          tag        VARCHAR(100) NOT NULL,
          created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
          INDEX idx_product_tags (product_id)
        )
      `,
    },
    {
      name: 'product_images',
      sql: `
        CREATE TABLE IF NOT EXISTS product_images (
          id         INT AUTO_INCREMENT PRIMARY KEY,
          product_id INT          NOT NULL,
          image      TEXT         NOT NULL,
          sort_order INT          DEFAULT 0,
          created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
          INDEX idx_product_images (product_id)
        )
      `,
    },
    {
      name: 'product_variation_prices',
      sql: `
        CREATE TABLE IF NOT EXISTS product_variation_prices (
          id          INT AUTO_INCREMENT PRIMARY KEY,
          product_id  INT           NOT NULL,
          flavor_id   INT           NULL,
          unit_id     INT           NULL,
          unit_value  VARCHAR(50)   NULL,
          barcode     VARCHAR(100)  NULL,
          price       DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          sale_price  DECIMAL(10,2) NULL,
          created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
          updated_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
        )
      `,
    },
    {
      name: 'product_stock_type_logs',
      sql: `
        CREATE TABLE IF NOT EXISTS product_stock_type_logs (
          id           INT AUTO_INCREMENT PRIMARY KEY,
          product_id   INT NOT NULL,
          product_name VARCHAR(255) NULL,
          old_type     VARCHAR(50) NULL,
          new_type     VARCHAR(50) NULL,
          action       VARCHAR(100) NOT NULL,
          removed_qty  INT NOT NULL DEFAULT 0,
          details      TEXT NULL,
          created_by   INT NULL,
          created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_prod_logs (product_id)
        )
      `,
    },
    {
      name: 'customers',
      sql: `
        CREATE TABLE IF NOT EXISTS customers (
          id         INT AUTO_INCREMENT PRIMARY KEY,
          name       VARCHAR(150) NOT NULL,
          phone      VARCHAR(30)  NULL,
          created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `,
    },
    {
      name: 'fr_migrations',
      sql: `
        CREATE TABLE IF NOT EXISTS fr_migrations (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE,
          executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `,
    },
    {
      name: 'fr_customers',
      sql: `
        CREATE TABLE IF NOT EXISTS fr_customers (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(150) NOT NULL,
          email VARCHAR(150) NOT NULL UNIQUE,
          password VARCHAR(255) NOT NULL,
          phone VARCHAR(20) NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `,
    },
    {
      name: 'fr_customers_meta',
      sql: `
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
      `,
    },
    {
      name: 'fr_favorites',
      sql: `
        CREATE TABLE IF NOT EXISTS fr_favorites (
          id INT AUTO_INCREMENT PRIMARY KEY,
          customer_id INT NOT NULL,
          product_id INT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY customer_product_unique (customer_id, product_id),
          CONSTRAINT fk_fr_favorites_customer FOREIGN KEY (customer_id) REFERENCES fr_customers(id) ON DELETE CASCADE
        )
      `,
    },
    {
      name: 'fr_orders',
      sql: `
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
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          CONSTRAINT fk_fr_orders_customer FOREIGN KEY (customer_id) REFERENCES fr_customers(id) ON DELETE SET NULL
        )
      `,
    },
    {
      name: 'fr_order_items',
      sql: `
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
      `,
    },
  ];

  for (const table of tables) {
    try {
      await conn.execute(table.sql);
      console.log(`  ✅ Table "${table.name}" — OK`);
    } catch (err) {
      console.error(`  ❌ Table "${table.name}" — FAILED: ${err.message}`);
    }
  }

  // Seed default units if empty
  try {
    const defaultUnits = ['kg', 'g', 'ml', 'L', 'lbs', 'pcs'];
    for (const unit of defaultUnits) {
      await conn.execute('INSERT IGNORE INTO units (name) VALUES (?)', [unit]);
    }
    console.log('  ✅ Seeded standard units (kg, g, ml, L, lbs, pcs)');
  } catch (err) {}

  const patches = [
    {
      desc: 'Add store_id to bills',
      check: `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bills' AND COLUMN_NAME = 'store_id'`,
      sql: `ALTER TABLE bills ADD COLUMN store_id INT NULL AFTER bill_number, ADD CONSTRAINT fk_bills_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL`,
    },
    {
      desc: 'Add store_id to purchase_orders',
      check: `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchase_orders' AND COLUMN_NAME = 'store_id'`,
      sql: `ALTER TABLE purchase_orders ADD COLUMN store_id INT NULL AFTER supplier_id, ADD CONSTRAINT fk_po_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL`,
    },
    {
      desc: 'Add created_by to bills',
      check: `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bills' AND COLUMN_NAME = 'created_by'`,
      sql: `ALTER TABLE bills ADD COLUMN created_by INT NULL AFTER store_id, ADD CONSTRAINT fk_bills_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL`,
    },
    {
      desc: 'Add created_by to purchase_orders',
      check: `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchase_orders' AND COLUMN_NAME = 'created_by'`,
      sql: `ALTER TABLE purchase_orders ADD COLUMN created_by INT NULL AFTER store_id, ADD CONSTRAINT fk_po_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL`,
    },
    {
      desc: 'Add customer_id to bills',
      check: `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bills' AND COLUMN_NAME = 'customer_id'`,
      sql: `ALTER TABLE bills ADD COLUMN customer_id INT NULL AFTER created_by, ADD CONSTRAINT fk_bills_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL`,
    },
    {
      desc: 'Add payment_type to bills',
      check: `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bills' AND COLUMN_NAME = 'payment_type'`,
      sql: `ALTER TABLE bills ADD COLUMN payment_type ENUM('cash','card','upi') NOT NULL DEFAULT 'cash' AFTER customer_phone`,
    },
    {
      desc: 'Add expiry_date to bill_items',
      check: `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bill_items' AND COLUMN_NAME = 'expiry_date'`,
      sql: `ALTER TABLE bill_items ADD COLUMN expiry_date DATE NULL AFTER unit_price`,
    },
    {
      desc: 'Add expiry_date to purchase_order_items',
      check: `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchase_order_items' AND COLUMN_NAME = 'expiry_date'`,
      sql: `ALTER TABLE purchase_order_items ADD COLUMN expiry_date DATE NULL AFTER unit_cost`,
    },
    {
      desc: 'Add index on stock_items(status)',
      check: `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stock_items' AND INDEX_NAME = 'idx_stock_status'`,
      sql: `ALTER TABLE stock_items ADD INDEX idx_stock_status (status)`,
    },
    {
      desc: 'Add index on stock_items(store_id, status)',
      check: `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stock_items' AND INDEX_NAME = 'idx_stock_store_status'`,
      sql: `ALTER TABLE stock_items ADD INDEX idx_stock_store_status (store_id, status)`,
    },
    {
      desc: 'Add token_version to users for session invalidation on password change',
      check: `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'token_version'`,
      sql: `ALTER TABLE users ADD COLUMN token_version INT NOT NULL DEFAULT 1`,
    },
    {
      desc: 'Add image to products table',
      check: `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'image'`,
      sql: `ALTER TABLE products ADD COLUMN image TEXT NULL AFTER description`,
    },
    {
      desc: 'Add image to categories table',
      check: `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categories' AND COLUMN_NAME = 'image'`,
      sql: `ALTER TABLE categories ADD COLUMN image TEXT NULL AFTER name`,
    },
    {
      desc: 'Add slug to categories table',
      check: `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categories' AND COLUMN_NAME = 'slug'`,
      sql: `ALTER TABLE categories ADD COLUMN slug VARCHAR(150) NULL AFTER image, ADD UNIQUE INDEX idx_category_slug (slug)`,
    },
    {
      desc: 'Add slug to products table',
      check: `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'slug'`,
      sql: `ALTER TABLE products ADD COLUMN slug VARCHAR(150) NULL AFTER image, ADD UNIQUE INDEX idx_product_slug (slug)`,
    },
    {
      desc: 'Add sale_price to products table',
      check: `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'sale_price'`,
      sql: `ALTER TABLE products ADD COLUMN sale_price DECIMAL(10,2) NULL AFTER price`,
    },
    {
      desc: 'Add product_type to products table',
      check: `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'product_type'`,
      sql: `ALTER TABLE products ADD COLUMN product_type VARCHAR(50) NOT NULL DEFAULT 'simple_product' AFTER name`,
    },
    {
      desc: 'Add is_flavor to products table',
      check: `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'is_flavor'`,
      sql: `ALTER TABLE products ADD COLUMN is_flavor TINYINT(1) NOT NULL DEFAULT 0 AFTER product_type`,
    },
    {
      desc: 'Add is_size to products table',
      check: `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'is_size'`,
      sql: `ALTER TABLE products ADD COLUMN is_size TINYINT(1) NOT NULL DEFAULT 0 AFTER is_flavor`,
    },
    {
      desc: 'Add flavor_id to purchase_order_items',
      check: `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchase_order_items' AND COLUMN_NAME = 'flavor_id'`,
      sql: `ALTER TABLE purchase_order_items ADD COLUMN flavor_id INT NULL AFTER product_id`,
    },
    {
      desc: 'Add unit_id to purchase_order_items',
      check: `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchase_order_items' AND COLUMN_NAME = 'unit_id'`,
      sql: `ALTER TABLE purchase_order_items ADD COLUMN unit_id INT NULL AFTER flavor_id`,
    },
    {
      desc: 'Add unit_value to purchase_order_items',
      check: `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchase_order_items' AND COLUMN_NAME = 'unit_value'`,
      sql: `ALTER TABLE purchase_order_items ADD COLUMN unit_value VARCHAR(50) NULL AFTER unit_id`,
    },
    {
      desc: 'Add flavor_id to stock_items',
      check: `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stock_items' AND COLUMN_NAME = 'flavor_id'`,
      sql: `ALTER TABLE stock_items ADD COLUMN flavor_id INT NULL AFTER product_id`,
    },
    {
      desc: 'Add unit_id to stock_items',
      check: `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stock_items' AND COLUMN_NAME = 'unit_id'`,
      sql: `ALTER TABLE stock_items ADD COLUMN unit_id INT NULL AFTER flavor_id`,
    },
    {
      desc: 'Add unit_value to stock_items',
      check: `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stock_items' AND COLUMN_NAME = 'unit_value'`,
      sql: `ALTER TABLE stock_items ADD COLUMN unit_value VARCHAR(50) NULL AFTER unit_id`,
    },
    {
      desc: 'Add flavor_id to stock_items_new',
      check: `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stock_items_new' AND COLUMN_NAME = 'flavor_id'`,
      sql: `ALTER TABLE stock_items_new ADD COLUMN flavor_id INT NULL AFTER product_id`,
    },
    {
      desc: 'Add unit_id to stock_items_new',
      check: `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stock_items_new' AND COLUMN_NAME = 'unit_id'`,
      sql: `ALTER TABLE stock_items_new ADD COLUMN unit_id INT NULL AFTER flavor_id`,
    },
    {
      desc: 'Add unit_value to stock_items_new',
      check: `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stock_items_new' AND COLUMN_NAME = 'unit_value'`,
      sql: `ALTER TABLE stock_items_new ADD COLUMN unit_value VARCHAR(50) NULL AFTER unit_id`,
    },
    {
      desc: 'Add flavor_id to store_products',
      check: `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'store_products' AND COLUMN_NAME = 'flavor_id'`,
      sql: `ALTER TABLE store_products ADD COLUMN flavor_id INT NULL AFTER product_id`,
    },
    {
      desc: 'Add unit_id to store_products',
      check: `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'store_products' AND COLUMN_NAME = 'unit_id'`,
      sql: `ALTER TABLE store_products ADD COLUMN unit_id INT NULL AFTER flavor_id`,
    },
    {
      desc: 'Add unit_value to store_products',
      check: `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'store_products' AND COLUMN_NAME = 'unit_value'`,
      sql: `ALTER TABLE store_products ADD COLUMN unit_value VARCHAR(50) NULL AFTER unit_id`,
    },
    {
      desc: 'Add flavor_id to bill_items',
      check: `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bill_items' AND COLUMN_NAME = 'flavor_id'`,
      sql: `ALTER TABLE bill_items ADD COLUMN flavor_id INT NULL AFTER product_id`,
    },
    {
      desc: 'Add unit_id to bill_items',
      check: `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bill_items' AND COLUMN_NAME = 'unit_id'`,
      sql: `ALTER TABLE bill_items ADD COLUMN unit_id INT NULL AFTER flavor_id`,
    },
    {
      desc: 'Add unit_value to bill_items',
      check: `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bill_items' AND COLUMN_NAME = 'unit_value'`,
      sql: `ALTER TABLE bill_items ADD COLUMN unit_value VARCHAR(50) NULL AFTER unit_id`,
    },
    {
      desc: 'Add unit_id to product_variation_prices',
      check: `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product_variation_prices' AND COLUMN_NAME = 'unit_id'`,
      sql: `ALTER TABLE product_variation_prices ADD COLUMN unit_id INT NULL AFTER flavor_id`,
    },
    {
      desc: 'Add unit_value to product_variation_prices',
      check: `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'product_variation_prices' AND COLUMN_NAME = 'unit_value'`,
      sql: `ALTER TABLE product_variation_prices ADD COLUMN unit_value VARCHAR(50) NULL AFTER unit_id`,
    },
    {
      desc: 'Add flavor_id to stock_transfers',
      check: `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stock_transfers' AND COLUMN_NAME = 'flavor_id'`,
      sql: `ALTER TABLE stock_transfers ADD COLUMN flavor_id INT NULL AFTER product_id`,
    },
    {
      desc: 'Add unit_id to stock_transfers',
      check: `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stock_transfers' AND COLUMN_NAME = 'unit_id'`,
      sql: `ALTER TABLE stock_transfers ADD COLUMN unit_id INT NULL AFTER flavor_id`,
    },
    {
      desc: 'Add unit_value to stock_transfers',
      check: `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stock_transfers' AND COLUMN_NAME = 'unit_value'`,
      sql: `ALTER TABLE stock_transfers ADD COLUMN unit_value VARCHAR(50) NULL AFTER unit_id`,
    },
    {
      desc: 'Add sell_on_website to products',
      check: `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'sell_on_website'`,
      sql: `ALTER TABLE products ADD COLUMN sell_on_website TINYINT(1) NOT NULL DEFAULT 0 AFTER is_size`,
    },
    {
      desc: 'Remove billing_company from fr_orders',
      type: 'drop',
      check: `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fr_orders' AND COLUMN_NAME = 'billing_company'`,
      sql: `ALTER TABLE fr_orders DROP COLUMN billing_company`,
    },
    {
      desc: 'Remove shipping_company from fr_orders',
      type: 'drop',
      check: `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fr_orders' AND COLUMN_NAME = 'shipping_company'`,
      sql: `ALTER TABLE fr_orders DROP COLUMN shipping_company`,
    },
    {
      desc: 'Add image to brands table',
      check: `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'brands' AND COLUMN_NAME = 'image'`,
      sql: `ALTER TABLE brands ADD COLUMN image TEXT NULL AFTER name`,
    },
    {
      desc: 'Add delete_status to products table',
      check: `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'delete_status'`,
      sql: `ALTER TABLE products ADD COLUMN delete_status VARCHAR(20) NULL DEFAULT NULL AFTER updated_at`,
    },
    {
      desc: 'Add index on products(delete_status)',
      check: `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND INDEX_NAME = 'idx_products_delete_status'`,
      sql: `ALTER TABLE products ADD INDEX idx_products_delete_status (delete_status)`,
    },
    {
      desc: 'Allow oversold status in stock_items_new',
      check: `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stock_items_new' AND COLUMN_NAME = 'status' AND COLUMN_TYPE LIKE '%oversold%'`,
      sql: `ALTER TABLE stock_items_new MODIFY COLUMN status ENUM('available', 'sold', 'expired', 'oversold') NOT NULL DEFAULT 'available'`,
    },
  ];

  for (const patch of patches) {
    try {
      const [rows] = await conn.execute(patch.check);
      const shouldRun = patch.type === 'drop' ? rows.length > 0 : rows.length === 0;
      if (shouldRun) {
        await conn.execute(patch.sql);
        console.log(`  ✅ Patch "${patch.desc}" — Applied`);
      } else {
        console.log(`  ⏭️  Patch "${patch.desc}" — Already applied`);
      }
    } catch (err) {
      console.error(`  ❌ Patch "${patch.desc}" — FAILED: ${err.message}`);
    }
  }

  console.log('\n✅ Migration complete.');
  await conn.end();
}

migrate().catch(err => {
  console.error('\n❌ Migration failed:', err.message);
  process.exit(1);
});
