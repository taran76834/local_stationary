// Run: node database/add-stock-transfers.js
require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '3306'),
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'store',
  });

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS stock_transfers (
      id               INT AUTO_INCREMENT PRIMARY KEY,
      transfer_number  VARCHAR(50)   NOT NULL UNIQUE,
      from_store_id    INT           NOT NULL,
      to_store_id      INT           NOT NULL,
      product_id       INT           NOT NULL,
      variation_id     INT           NULL,
      quantity         INT           NOT NULL DEFAULT 1,
      expiry_date      DATE          NULL,
      notes            TEXT,
      created_by       INT           NULL,
      created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (from_store_id) REFERENCES stores(id)   ON DELETE CASCADE,
      FOREIGN KEY (to_store_id)   REFERENCES stores(id)   ON DELETE CASCADE,
      FOREIGN KEY (product_id)    REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by)    REFERENCES users(id)    ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
  `);

  console.log('  ✅ stock_transfers table created (or already exists).');
  await conn.end();
}

main().catch(e => { console.error('❌ Migration failed:', e.message); process.exit(1); });
