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

  console.log('✅ Connected\n');

  // 1. Create junction tables
  const junctions = [
    {
      name: 'product_categories',
      sql: `CREATE TABLE IF NOT EXISTS product_categories (
              product_id  INT NOT NULL,
              category_id INT NOT NULL,
              PRIMARY KEY (product_id, category_id),
              FOREIGN KEY (product_id)  REFERENCES products(id)    ON DELETE CASCADE,
              FOREIGN KEY (category_id) REFERENCES categories(id)  ON DELETE CASCADE
            )`,
    },
    {
      name: 'product_flavors',
      sql: `CREATE TABLE IF NOT EXISTS product_flavors (
              product_id INT NOT NULL,
              flavor_id  INT NOT NULL,
              PRIMARY KEY (product_id, flavor_id),
              FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
              FOREIGN KEY (flavor_id)  REFERENCES flavors(id)  ON DELETE CASCADE
            )`,
    },
    {
      name: 'product_brands',
      sql: `CREATE TABLE IF NOT EXISTS product_brands (
              product_id INT NOT NULL,
              brand_id   INT NOT NULL,
              PRIMARY KEY (product_id, brand_id),
              FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
              FOREIGN KEY (brand_id)   REFERENCES brands(id)   ON DELETE CASCADE
            )`,
    },
  ];

  for (const j of junctions) {
    await conn.execute(j.sql);
    console.log(`  ✅ ${j.name} — OK`);
  }

  // 2. Migrate existing single-value data into junction tables
  const [products] = await conn.execute('SELECT id, category_id, flavor_id, brand_id FROM products');
  for (const p of products) {
    if (p.category_id) await conn.execute('INSERT IGNORE INTO product_categories (product_id, category_id) VALUES (?, ?)', [p.id, p.category_id]);
    if (p.flavor_id)   await conn.execute('INSERT IGNORE INTO product_flavors   (product_id, flavor_id)   VALUES (?, ?)', [p.id, p.flavor_id]);
    if (p.brand_id)    await conn.execute('INSERT IGNORE INTO product_brands    (product_id, brand_id)    VALUES (?, ?)', [p.id, p.brand_id]);
  }
  console.log(`  ✅ Migrated existing data for ${products.length} products`);

  // 3. Drop old FK columns from products
  const colsToDrop = [
    { col: 'category_id', constraint: 'fk_products_category' },
    { col: 'flavor_id',   constraint: 'fk_products_flavor' },
    { col: 'brand_id',    constraint: 'fk_products_brand' },
  ];

  // Get actual FK constraint names from information_schema
  const [fks] = await conn.execute(`
    SELECT CONSTRAINT_NAME, COLUMN_NAME
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'products'
      AND REFERENCED_TABLE_NAME IS NOT NULL
      AND COLUMN_NAME IN ('category_id','flavor_id','brand_id')
  `);

  for (const fk of fks) {
    try {
      await conn.execute(`ALTER TABLE products DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\``);
      console.log(`  ✅ Dropped FK ${fk.CONSTRAINT_NAME}`);
    } catch (e) {
      console.log(`  ⏭️  FK ${fk.CONSTRAINT_NAME} already dropped`);
    }
  }

  for (const { col } of colsToDrop) {
    const [cols] = await conn.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = ?
    `, [col]);
    if (cols.length > 0) {
      await conn.execute(`ALTER TABLE products DROP COLUMN \`${col}\``);
      console.log(`  ✅ Dropped column products.${col}`);
    } else {
      console.log(`  ⏭️  Column ${col} already gone`);
    }
  }

  console.log('\n✅ Migration complete.');
  await conn.end();
}

migrate().catch(err => { console.error('❌ Failed:', err.message); process.exit(1); });
