/**
 * Add 'slug' column to categories table and backfill existing categories.
 * Usage: node database/add-category-slug.js
 */

require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');

function slugify(text) {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

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
  console.log('⏳ Adding "slug" column to categories table...\n');

  try {
    const [cols] = await conn.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categories' AND COLUMN_NAME = 'slug'
    `);

    if (cols.length === 0) {
      await conn.execute(`ALTER TABLE categories ADD COLUMN slug VARCHAR(150) NULL AFTER image, ADD UNIQUE INDEX idx_category_slug (slug)`);
      console.log('  ✅ Column "slug" added to categories table');
    } else {
      console.log('  ⏭️  Column "slug" already exists in categories table');
    }

    // Backfill empty/null slugs for existing categories
    const [categories] = await conn.execute(`SELECT id, name, slug FROM categories WHERE slug IS NULL OR slug = ''`);
    for (const cat of categories) {
      let baseSlug = slugify(cat.name) || `category-${cat.id}`;
      let finalSlug = baseSlug;
      let counter = 1;

      while (true) {
        const [existing] = await conn.execute(`SELECT id FROM categories WHERE slug = ? AND id != ?`, [finalSlug, cat.id]);
        if (existing.length === 0) break;
        finalSlug = `${baseSlug}-${counter++}`;
      }

      await conn.execute(`UPDATE categories SET slug = ? WHERE id = ?`, [finalSlug, cat.id]);
      console.log(`  📌 Generated slug "${finalSlug}" for category "${cat.name}"`);
    }

  } catch (err) {
    console.error('  ❌ Migration FAILED:', err.message);
    process.exit(1);
  }

  await conn.end();
  console.log('\n✅ Category slug migration complete.');
}

migrate().catch(err => {
  console.error('\n❌ Migration failed:', err.message);
  process.exit(1);
});
