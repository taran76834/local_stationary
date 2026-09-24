require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '3306'),
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'store',
  });

  const [tables] = await conn.query('SHOW TABLES');
  const tableNames = tables.map(t => Object.values(t)[0]);

  let sql = `-- Live DB Migration SQL\n-- Run this in phpMyAdmin on your live database\n\n`;
  sql += `SET FOREIGN_KEY_CHECKS = 0;\n\n`;

  for (const table of tableNames) {
    const [[{ 'Create Table': create }]] = await conn.query(`SHOW CREATE TABLE \`${table}\``);
    sql += `-- Table: ${table}\n`;
    sql += create.replace('CREATE TABLE', 'CREATE TABLE IF NOT EXISTS') + ';\n\n';
  }

  sql += `SET FOREIGN_KEY_CHECKS = 1;\n`;

  const fs = require('fs');
  fs.writeFileSync(__dirname + '/live-migration.sql', sql);
  console.log('Written to database/live-migration.sql');
  await conn.end();
}

run().catch(e => console.error(e.message));
