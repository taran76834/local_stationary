/**
 * Run all migrations in sequence and track completion in `migrations` table.
 * Skipping any migrations that have already been executed.
 * Usage: npm run migrate
 * Or: node database/run-all-migrations.js
 */

require('dotenv').config({ path: '.env.local' });
const { execSync } = require('child_process');
const mysql = require('mysql2/promise');

const migrations = [
  { name: 'add-token-version', desc: 'Add JWT token version column' },
  { name: 'add-sales-role', desc: 'Add sales role to users' },
  { name: 'add-user-meta', desc: 'Create user_meta table' },
  { name: 'add-direct-stock-receipts', desc: 'Add direct receipt support' },
  { name: 'add-po-link-to-stock', desc: 'Link stock items to purchase orders' },
  { name: 'add-product-image', desc: 'Add image column to products table' },
  { name: 'add-category-image', desc: 'Add image column to categories table' },
  { name: 'add-category-slug', desc: 'Add slug column to categories table' },
  { name: 'add-product-slug', desc: 'Add slug column to products table' },
  { name: 'add-product-tags', desc: 'Create product_tags table' },
  { name: 'add-product-sale-price', desc: 'Add sale_price column to products table' },
  { name: 'add-product-images', desc: 'Create product_images gallery table' },
  { name: 'add-product-flavor-prices', desc: 'Create product_variation_prices table' },
  { name: 'rename-flavor-prices-to-variation-prices', desc: 'Rename product_flavor_prices to product_variation_prices' },
  { name: 'cleanup-legacy-flavor-unit-tables', desc: 'Cleanup legacy tables and setup variation_types' },
  { name: 'add-product-type', desc: 'Add product_type column to products table' },
  { name: 'add-flavor-to-stock', desc: 'Add flavor_id to stock and receipt tables' },
  { name: 'create-fr-tables', desc: 'Create and sync frontend (fr_) tables' },
  { name: 'add-variation-barcode', desc: 'Add barcode column to product_variation_prices table' },
  { name: 'add-fr-customers-meta', desc: 'Create fr_customers_meta table for customer metadata' },
  { name: 'add-variation-details-columns', desc: 'Add image, gallery columns to product_variation_prices' },
  { name: 'remove-title-from-product-variation-prices', desc: 'Drop title column from product_variation_prices' },
  { name: 'remove-slug-flavor-unit-from-fr-order-items', desc: 'Drop legacy columns from fr_order_items' },
  { name: 'add-vari-attribute-to-fr-order-items', desc: 'Add vari_attribute column to fr_order_items' },
  { name: 'add-vari-attribute-to-purchase-order-items', desc: 'Add vari_attribute column to purchase_order_items, store_products, and stock_items_new' },
  { name: 'remove-flavor-unit-add-variation-id-to-purchase-order-items', desc: 'Drop legacy columns and add variation_id to purchase_order_items' },
  { name: 'remove-flavor-unit-vari-attr-from-stock-items', desc: 'Drop legacy columns from stock_items_new and ensure variation_id' },
  { name: 'add-product-attributes-to-products', desc: 'Add product_attributes JSON column to products table' },
  { name: 'remove-legacy-variation-columns', desc: 'Remove legacy columns (flavor_id, unit_id, unit_value, vari_attribute)' },
  { name: 'drop-store-products-table', desc: 'Drop store_products table and add performance index to stock_items_new' },
  { name: 'drop-legacy-stock-items-table', desc: 'Drop legacy stock_items table' },
  { name: 'add-delete-status-to-products', desc: 'Add delete_status column to products table' },
  { name: 'add-sell-on-website-to-products', desc: 'Add sell_on_website TINYINT column to products table' },
  { name: 'remove-flavor-unit-add-variation-id-to-bill-items', desc: 'Add variation_id to bill_items and drop legacy columns' },
  { name: 'add-brand-image', desc: 'Add image column to brands table' },
  { name: 'add-stock-transfers', desc: 'Create stock_transfers table' },
  { name: 'add-brands', desc: 'Create brands table and add brand_id column to products' },
  { name: 'add-payment-type', desc: 'Add payment_type column to bills table' },
  { name: 'add-expiry-to-bill-items', desc: 'Add expiry_date column to bill_items' },
  { name: 'add-expiry-to-po-items', desc: 'Add expiry_date column to purchase_order_items' },
  { name: 'add-stock-reduced-to-fr-orders', desc: 'Add stock_reduced to fr_orders and variation columns to fr_order_items' },
  { name: 'drop-brand-id-from-products', desc: 'Drop legacy brand_id column from products table' },
  { name: 'drop-legacy-product-flavor-prices-table', desc: 'Drop legacy product_flavor_prices table' },
  { name: 'allow-oversold-stock-status', desc: 'Allow oversold status in stock_items_new' },
  { name: 'add-shipping-table', desc: 'Create shipping_rates table' },
  { name: 'create-geo-and-shipping-tables', desc: 'Create countries, states, cities relational tables and update shipping_rates' },
  { name: 'add-shipping-phone-email-to-orders', desc: 'Add shipping_phone and shipping_email columns to fr_orders table' },
];

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('  DATABASE MIGRATIONS');
  console.log('='.repeat(60) + '\n');

  let conn;
  let executedSet = new Set();

  try {
    conn = await mysql.createConnection({
      host:     process.env.DB_HOST     || 'localhost',
      port:     parseInt(process.env.DB_PORT || '3306'),
      user:     process.env.DB_USER     || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME     || 'store',
    });

    console.log('✅ Connected to MySQL database:', process.env.DB_NAME || 'store');

    // Create migrations tracking table if not exists
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const [rows] = await conn.execute('SELECT name FROM migrations');
    executedSet = new Set(rows.map(r => r.name));
    console.log(`📋 Found ${executedSet.size} previously recorded migration(s) in "migrations" table.\n`);

  } catch (err) {
    console.error('⚠️ Warning: Could not connect to DB to check migrations table:', err.message, '\n');
  }

  let completed = 0;
  let skipped = 0;
  let failed = 0;

  for (const mig of migrations) {
    const migFile = `database/${mig.name}.js`;
    const stepNum = completed + skipped + failed + 1;

    if (executedSet.has(mig.name)) {
      console.log(`⏭️  [${stepNum}/${migrations.length}] ${mig.desc} — Already executed (Skipping)\n`);
      skipped++;
      continue;
    }

    console.log(`⏳ [${stepNum}/${migrations.length}] ${mig.desc}...`);

    try {
      execSync(`node "${migFile}"`, { stdio: 'inherit' });
      
      if (conn) {
        await conn.execute('INSERT IGNORE INTO migrations (name) VALUES (?)', [mig.name]);
      }
      
      completed++;
      console.log(`✅ Completed and saved in "migrations" table.\n`);
    } catch (err) {
      failed++;
      console.error(`❌ Failed\n`);
    }
  }

  if (conn) {
    await conn.end();
  }

  console.log('='.repeat(60));
  console.log(`\n📊 Results: ${completed} newly executed, ${skipped} skipped, ${failed} failed\n`);

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('🎉 All migrations are up to date!\n');
    process.exit(0);
  }
}

main();
