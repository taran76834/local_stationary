require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '3306'),
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'store',
  });

  try {
    const [rows] = await conn.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bills' AND COLUMN_NAME = 'payment_type'`
    );
    if (rows.length === 0) {
      await conn.execute(
        `ALTER TABLE bills ADD COLUMN payment_type ENUM('cash','card','upi') NOT NULL DEFAULT 'cash' AFTER customer_phone`
      );
      console.log('✅ payment_type column added to bills.');
    } else {
      console.log('⏭️  payment_type column already exists.');
    }
  } catch (err) {
    console.error('❌ Failed:', err.message);
  }

  await conn.end();
})();
