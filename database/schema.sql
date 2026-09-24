-- ============================================================
-- Store Management System - MySQL Schema
-- ============================================================

CREATE DATABASE IF NOT EXISTS store;
USE store;

-- ------------------------------------------------------------
-- Users (admin only)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100)  NOT NULL,
  email       VARCHAR(150)  NOT NULL UNIQUE,
  password    VARCHAR(255)  NOT NULL,
  role        ENUM('admin') NOT NULL DEFAULT 'admin',
  created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

-- Default admin user  (password: admin123)
INSERT INTO users (name, email, password, role) VALUES
('Admin', 'admin@store.com', '$2a$10$Wd./jFGKMnFqFGKMnFqFGOQKMnFqFGKMnFqFGKMnFqFGKMnFqFGKM', 'admin')
ON DUPLICATE KEY UPDATE id = id;

-- ------------------------------------------------------------
-- Categories
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL UNIQUE,
  image       TEXT,
  slug        VARCHAR(150) UNIQUE,
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- Flavors
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS flavors (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL UNIQUE,
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- Products
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(150)   NOT NULL,
  product_type  VARCHAR(50)    NOT NULL DEFAULT 'simple_product',
  category_id   INT            NULL,
  sell_on_website TINYINT(1)   NOT NULL DEFAULT 0,
  barcode       VARCHAR(100)   UNIQUE,
  stock         INT            NOT NULL DEFAULT 0,
  price         DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  sale_price    DECIMAL(10,2)  NULL,
  description   TEXT,
  image         TEXT,
  slug          VARCHAR(150)   UNIQUE,
  product_attributes JSON        NULL,
  created_at    TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- ------------------------------------------------------------
-- Suppliers
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS suppliers (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(150) NOT NULL,
  contact     VARCHAR(100),
  phone       VARCHAR(30),
  email       VARCHAR(150),
  address     TEXT,
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- Purchase Orders
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchase_orders (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  order_number    VARCHAR(50)    NOT NULL UNIQUE,
  supplier_id     INT            NULL,
  status          ENUM('pending','received','cancelled') NOT NULL DEFAULT 'pending',
  total_amount    DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  notes           TEXT,
  ordered_at      TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
);

-- ------------------------------------------------------------
-- Purchase Order Items
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  purchase_order_id   INT            NOT NULL,
  product_id          INT            NOT NULL,
  variation_id        INT            NULL,
  vari_attribute      LONGTEXT       NULL,
  quantity            INT            NOT NULL DEFAULT 1,
  unit_cost           DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  subtotal            DECIMAL(10,2)  GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id)        REFERENCES products(id)        ON DELETE CASCADE,
  FOREIGN KEY (variation_id)      REFERENCES product_variation_prices(id) ON DELETE SET NULL
);

-- ------------------------------------------------------------
-- Bills (Sales)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bills (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  bill_number     VARCHAR(50)    NOT NULL UNIQUE,
  customer_name   VARCHAR(150),
  customer_phone  VARCHAR(30),
  status          ENUM('draft','paid','cancelled') NOT NULL DEFAULT 'draft',
  total_amount    DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  discount        DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  tax             DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  notes           TEXT,
  created_at      TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- Bill Items
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bill_items (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  bill_id     INT            NOT NULL,
  product_id  INT            NOT NULL,
  flavor_id   INT            NULL,
  quantity    INT            NOT NULL DEFAULT 1,
  unit_price  DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  subtotal    DECIMAL(10,2)  GENERATED ALWAYS AS (quantity * unit_price) STORED,
  FOREIGN KEY (bill_id)    REFERENCES bills(id)    ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (flavor_id)  REFERENCES flavors(id)  ON DELETE SET NULL
);

-- ------------------------------------------------------------
-- Product Tags
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_tags (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  product_id  INT          NOT NULL,
  tag         VARCHAR(100) NOT NULL,
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_product_tags (product_id)
);

-- ------------------------------------------------------------
-- Product Images (Gallery)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_images (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  product_id  INT          NOT NULL,
  image       TEXT         NOT NULL,
  sort_order  INT          DEFAULT 0,
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_product_images (product_id)
);

-- ------------------------------------------------------------
-- Master Variation Types
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS variation_types (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- Product Variation Prices
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_variation_prices (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  product_id  INT           NOT NULL,
  attributes  JSON          NOT NULL,
  price       DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  sale_price  DECIMAL(10,2) NULL,
  barcode     VARCHAR(100)  NULL,
  created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_pvp_product (product_id)
);

-- ------------------------------------------------------------
-- Frontend Migrations Tracker
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fr_migrations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- Frontend Customers
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fr_customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- Frontend Customers Metadata
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fr_customers_meta (
  id INT AUTO_INCREMENT PRIMARY KEY,
  fr_customer_id INT NOT NULL,
  meta_key VARCHAR(150) NOT NULL,
  meta_value TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_fr_customers_meta_customer FOREIGN KEY (fr_customer_id) REFERENCES fr_customers(id) ON DELETE CASCADE,
  UNIQUE KEY uq_fr_customer_meta_key (fr_customer_id, meta_key)
);

-- ------------------------------------------------------------
-- Frontend Favorites / Wishlist
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fr_favorites (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  product_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY customer_product_unique (customer_id, product_id),
  CONSTRAINT fk_fr_favorites_customer FOREIGN KEY (customer_id) REFERENCES fr_customers(id) ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- Frontend Orders
-- ------------------------------------------------------------
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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_fr_orders_customer FOREIGN KEY (customer_id) REFERENCES fr_customers(id) ON DELETE SET NULL
);

-- ------------------------------------------------------------
-- Frontend Order Items
-- ------------------------------------------------------------
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
);

-- ------------------------------------------------------------
-- Geographic Tables (Countries, States, Cities)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS countries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  iso_code VARCHAR(10) NOT NULL UNIQUE,
  phone_code VARCHAR(20) NULL,
  currency VARCHAR(10) NULL,
  flag VARCHAR(10) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_name (name)
);

CREATE TABLE IF NOT EXISTS states (
  id INT AUTO_INCREMENT PRIMARY KEY,
  country_id INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  state_code VARCHAR(20) NULL,
  country_code VARCHAR(10) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_states_country FOREIGN KEY (country_id) REFERENCES countries(id) ON DELETE CASCADE,
  INDEX idx_country_id (country_id),
  INDEX idx_name (name)
);

CREATE TABLE IF NOT EXISTS cities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  state_id INT NOT NULL,
  country_id INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  state_code VARCHAR(20) NULL,
  country_code VARCHAR(10) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cities_state FOREIGN KEY (state_id) REFERENCES states(id) ON DELETE CASCADE,
  CONSTRAINT fk_cities_country FOREIGN KEY (country_id) REFERENCES countries(id) ON DELETE CASCADE,
  INDEX idx_state_id (state_id),
  INDEX idx_country_id (country_id),
  INDEX idx_name (name)
);

-- ------------------------------------------------------------
-- Shipping Rates (Relational Geographic Rates)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shipping_rates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  country_id INT NULL,
  state_id INT NULL,
  city_id INT NULL,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  estimated_days VARCHAR(50) NULL DEFAULT '3-5 business days',
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_shipping_country FOREIGN KEY (country_id) REFERENCES countries(id) ON DELETE SET NULL,
  CONSTRAINT fk_shipping_state FOREIGN KEY (state_id) REFERENCES states(id) ON DELETE SET NULL,
  CONSTRAINT fk_shipping_city FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE SET NULL,
  INDEX idx_geo_rate (country_id, state_id, city_id)
);
