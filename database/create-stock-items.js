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

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS stock_items (
      id                INT AUTO_INCREMENT PRIMARY KEY,
      store_id          INT NOT NULL,
      product_id        INT NOT NULL,
      purchase_order_id INT NULL,
      expiry_date       DATE NULL,
      status            ENUM('available','sold','expired') NOT NULL DEFAULT 'available',
      bill_item_id      INT NULL,
      created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (store_id)          REFERENCES stores(id)          ON DELETE CASCADE,
      FOREIGN KEY (product_id)        REFERENCES products(id)        ON DELETE CASCADE,
      FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE SET NULL
    )
  `);
  console.log('✅ stock_items table created.');
  await conn.end();
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });
