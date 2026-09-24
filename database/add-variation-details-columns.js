/**
 * Migration script: Add title, image, and gallery columns to product_variation_prices table.
 * Usage: node database/add-variation-details-columns.js
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
  });

  console.log('Connected to MySQL database:', process.env.DB_NAME || 'store');
  console.log('Adding title, image, gallery columns to product_variation_prices table...\n');

  try {
    const dbName = process.env.DB_NAME || 'store';
    
    // Check target table name
    const [tables] = await conn.execute(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('product_variation_prices', 'product_flavor_prices')
    `, [dbName]);

    if (tables.length === 0) {
      console.log('No variation table found.');
      process.exit(0);
    }

    const tableName = tables.find(t => t.TABLE_NAME === 'product_variation_prices')?.TABLE_NAME || tables[0].TABLE_NAME;
    console.log(`Target variation table: ${tableName}`);

    // Add image column
    const [imageCol] = await conn.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = 'image'
    `, [dbName, tableName]);

    if (imageCol.length === 0) {
      await conn.execute(`ALTER TABLE ${tableName} ADD COLUMN image LONGTEXT NULL`);
      console.log(`Added "image" column to ${tableName}.`);
    } else {
      console.log(`Column "image" already exists in ${tableName}.`);
    }

    // Add gallery column
    const [galleryCol] = await conn.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = 'gallery'
    `, [dbName, tableName]);

    if (galleryCol.length === 0) {
      await conn.execute(`ALTER TABLE ${tableName} ADD COLUMN gallery JSON NULL`);
      console.log(`Added "gallery" column to ${tableName}.`);
    } else {
      console.log(`Column "gallery" already exists in ${tableName}.`);
    }

  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await conn.end();
  }

  console.log('\nVariation details columns migration complete.');
}

migrate();
