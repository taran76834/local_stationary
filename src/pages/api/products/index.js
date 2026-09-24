import { query } from '../../../lib/db';
import { getAuthUser, canManageProductsCheck, getCanManageProducts } from '../../../lib/auth';
import fs from 'fs';
import path from 'path';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
};

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function generateUniqueSlug(requestedSlug, name, excludeProductId = null) {
  let base = slugify(requestedSlug || name);
  if (!base) base = 'product';

  let candidate = base;
  let counter = 1;

  while (true) {
    let sql = 'SELECT id FROM products WHERE slug = ?';
    let params = [candidate];
    if (excludeProductId) {
      sql += ' AND id != ?';
      params.push(excludeProductId);
    }
    const rows = await query(sql, params);
    if (!rows || rows.length === 0) {
      return candidate;
    }
    counter++;
    candidate = `${base}-${counter}`;
  }
}

function saveProductImage(base64OrPath) {
  if (!base64OrPath || typeof base64OrPath !== 'string') return null;
  const trimmed = base64OrPath.trim();
  if (!trimmed) return null;
  if (!trimmed.startsWith('data:image')) return trimmed;

  try {
    const match = trimmed.match(/^data:image\/(\w+);base64,/);
    const ext = match ? match[1] : 'jpg';
    const base64Data = trimmed.replace(/^data:image\/\w+;base64,/, '');
    const fileName = `product_${Date.now()}_${Math.random().toString(36).substr(2, 6)}.${ext}`;
    const buffer = Buffer.from(base64Data, 'base64');

    // Primary upload path (stationary app)
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    fs.writeFileSync(path.join(uploadDir, fileName), buffer);

    // Storefront website upload path
    try {
      const webUploadDir = path.join('/var/www/invincible-website', 'public', 'uploads');
      if (!fs.existsSync(webUploadDir)) fs.mkdirSync(webUploadDir, { recursive: true });
      fs.writeFileSync(path.join(webUploadDir, fileName), buffer);
    } catch (e) {
      console.warn('Web upload sync notice:', e.message);
    }

    return `/uploads/${fileName}`;
  } catch (err) {
    console.error('Error saving product image:', err);
    return null;
  }
}

function parseAttributes(attrStr) {
  if (!attrStr) return {};
  if (typeof attrStr === 'object') return attrStr;
  try {
    return JSON.parse(attrStr);
  } catch (e) {
    return {};
  }
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      if (req.query.slim === '1') {
        const rows = await query(`SELECT id, name, product_type, barcode, price, sale_price, image, slug FROM products WHERE delete_status IS NULL ORDER BY name ASC`);
        if (rows.length === 0) return res.status(200).json([]);
        const ids = rows.map(p => p.id);
        const placeholders = ids.map(() => '?').join(',');
        const fpRows = await query(`SELECT id, product_id, attributes, price, sale_price, barcode FROM product_variation_prices WHERE product_id IN (${placeholders})`, ids);
        
        const fpMap = {};
        fpRows.forEach(r => {
          if (!fpMap[r.product_id]) fpMap[r.product_id] = [];
          fpMap[r.product_id].push({
            id: r.id,
            attributes: parseAttributes(r.attributes),
            price: r.price,
            sale_price: r.sale_price,
            barcode: r.barcode
          });
        });

        const result = rows.map(p => ({
          ...p,
          flavor_prices: fpMap[p.id] || [],
        }));
        return res.status(200).json(result);
      }

      const products = await query(`
        SELECT p.*,
               COALESCE((
                 SELECT SUM(CASE WHEN status = 'available' THEN 1 WHEN status = 'oversold' THEN -1 ELSE 0 END)
                 FROM stock_items_new
                 WHERE product_id = p.id AND status IN ('available', 'oversold')
               ), 0) AS stock
        FROM products p
        WHERE p.delete_status IS NULL
        ORDER BY p.created_at DESC
      `);

      if (products.length === 0) return res.status(200).json([]);

      const ids = products.map(p => p.id);
      const placeholders = ids.map(() => '?').join(',');

      const [cats, brands, tagRows, galleryRows, fpRows] = await Promise.all([
        query(`SELECT pc.product_id, c.id, c.name FROM product_categories pc JOIN categories c ON c.id = pc.category_id WHERE pc.product_id IN (${placeholders})`, ids),
        query(`SELECT pb.product_id, b.id, b.name FROM product_brands pb JOIN brands b ON b.id = pb.brand_id WHERE pb.product_id IN (${placeholders})`, ids),
        query(`SELECT product_id, tag FROM product_tags WHERE product_id IN (${placeholders})`, ids),
        query(`SELECT product_id, image FROM product_images WHERE product_id IN (${placeholders}) ORDER BY sort_order ASC, id ASC`, ids),
        query(`SELECT id, product_id, attributes, price, sale_price, barcode, image, gallery FROM product_variation_prices WHERE product_id IN (${placeholders})`, ids),
      ]);

      const catMap     = {};
      const brandMap   = {};
      const tagMap     = {};
      const galleryMap = {};
      const fpMap      = {};

      cats.forEach(r   => { if (!catMap[r.product_id])   catMap[r.product_id]   = []; catMap[r.product_id].push({ id: r.id, name: r.name }); });
      brands.forEach(r => { if (!brandMap[r.product_id]) brandMap[r.product_id] = []; brandMap[r.product_id].push({ id: r.id, name: r.name }); });
      tagRows.forEach(r=> { if (!tagMap[r.product_id])   tagMap[r.product_id]   = []; tagMap[r.product_id].push(r.tag); });
      galleryRows.forEach(r => { if (!galleryMap[r.product_id]) galleryMap[r.product_id] = []; galleryMap[r.product_id].push(r.image); });
      fpRows.forEach(r => {
        if (!fpMap[r.product_id]) fpMap[r.product_id] = [];
        let gal = [];
        if (r.gallery) {
          try {
            gal = typeof r.gallery === 'string' ? JSON.parse(r.gallery) : (Array.isArray(r.gallery) ? r.gallery : []);
          } catch (e) {
            gal = [];
          }
        }
        fpMap[r.product_id].push({
          id: r.id,
          attributes: parseAttributes(r.attributes),
          price: r.price,
          sale_price: r.sale_price,
          barcode: r.barcode,
          image: r.image || '',
          gallery: Array.isArray(gal) ? gal : []
        });
      });

      const result = products.map(p => ({
        ...p,
        product_attributes: parseAttributes(p.product_attributes),
        categories:    catMap[p.id]     || [],
        brands:        brandMap[p.id]    || [],
        tags:          tagMap[p.id]      || [],
        gallery:       galleryMap[p.id]  || [],
        flavor_prices: fpMap[p.id]       || [],
      }));

      return res.status(200).json(result);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: 'Server error.' });
    }
  }

  if (req.method === 'POST') {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ message: 'Not authenticated.' });

    if (user.role === 'sales') {
      user.canManageProducts = await getCanManageProducts(user.id);
    }
    if (!canManageProductsCheck(user)) {
      return res.status(403).json({ message: 'Admin access required.' });
    }

    const { name, sell_on_website, product_type, category_ids, brand_ids, barcode, price, sale_price, description, image, slug, tags, gallery, flavor_prices, product_attributes } = req.body;
    if (!name) return res.status(400).json({ message: 'Product name is required.' });

async function validateBarcodes(excludeProductId, mainBarcode, flavorPrices = []) {
  const barcodeItems = [];

  if (mainBarcode && String(mainBarcode).trim() !== '') {
    barcodeItems.push({ source: 'Main Product Barcode', code: String(mainBarcode).trim() });
  }

  (flavorPrices || []).forEach((fp, idx) => {
    if (fp && fp.barcode && String(fp.barcode).trim() !== '') {
      const code = String(fp.barcode).trim();
      let label = 'Variation #' + (idx + 1);
      if (fp.attributes) {
        if (typeof fp.attributes === 'object') {
          label = Object.entries(fp.attributes).map(([k, v]) => `${k}: ${v}`).join(', ');
        } else {
          label = String(fp.attributes);
        }
      }
      barcodeItems.push({ source: `Variation (${label})`, code });
    }
  });

  if (barcodeItems.length === 0) return null;

  const seenMap = {};
  for (const item of barcodeItems) {
    const lower = item.code.toLowerCase();
    if (seenMap[lower]) {
      return `Duplicate barcode "${item.code}" found in product data (${seenMap[lower]} and ${item.source}).`;
    }
    seenMap[lower] = item.source;
  }

  const uniqueCodes = [...new Set(barcodeItems.map(b => b.code))];

  // Check against products table
  let prodSql = `SELECT id, name, barcode FROM products WHERE ${uniqueCodes.map(() => 'LOWER(barcode) = LOWER(?)').join(' OR ')}`;
  const prodParams = [...uniqueCodes];
  if (excludeProductId) {
    prodSql = `SELECT id, name, barcode FROM products WHERE (${uniqueCodes.map(() => 'LOWER(barcode) = LOWER(?)').join(' OR ')}) AND id != ?`;
    prodParams.push(excludeProductId);
  }
  const existingProds = await query(prodSql, prodParams);
  if (existingProds && existingProds.length > 0) {
    const dup = existingProds[0];
    return `Barcode "${dup.barcode}" is already in use by product "${dup.name}". Barcodes must be unique across all products and variations.`;
  }

  // Check against product_variation_prices table
  let varSql = `
    SELECT pvp.barcode, p.name AS product_name 
    FROM product_variation_prices pvp
    JOIN products p ON pvp.product_id = p.id
    WHERE ${uniqueCodes.map(() => 'LOWER(pvp.barcode) = LOWER(?)').join(' OR ')}
  `;
  const varParams = [...uniqueCodes];
  if (excludeProductId) {
    varSql += ` AND pvp.product_id != ?`;
    varParams.push(excludeProductId);
  }
  const existingVars = await query(varSql, varParams);
  if (existingVars && existingVars.length > 0) {
    const dup = existingVars[0];
    return `Barcode "${dup.barcode}" is already in use by a variation of product "${dup.product_name}". Barcodes must be unique across all products and variations.`;
  }

  return null;
}

    try {
      const barcodeErr = await validateBarcodes(null, barcode, flavor_prices);
      if (barcodeErr) {
        return res.status(400).json({ message: barcodeErr });
      }

      const sellOnWebsiteVal = (sell_on_website === true || sell_on_website === 1 || sell_on_website === '1') ? 1 : 0;
      const isVariable = (Array.isArray(flavor_prices) && flavor_prices.length > 0) || product_type === 'variable_product';
      const computedType = isVariable ? 'variable_product' : 'simple_product';
      const finalSlug = await generateUniqueSlug(slug, name);
      const imagePath = saveProductImage(image);
      const prodAttrJson = product_attributes ? (typeof product_attributes === 'string' ? product_attributes : JSON.stringify(product_attributes)) : null;

      const result = await query(
        `INSERT INTO products (name, product_type, sell_on_website, barcode, price, sale_price, description, image, slug, product_attributes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [name, computedType, sellOnWebsiteVal, barcode || null, price || 0, sale_price ? parseFloat(sale_price) : null, description || null, imagePath || null, finalSlug || null, prodAttrJson]
      );
      const productId = result.insertId;

      await saveRelations(productId, category_ids, brand_ids, tags, gallery, flavor_prices);

      return res.status(201).json({ message: 'Product created.', id: productId });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        const errMsg = String(err.sqlMessage || err.message || '').toLowerCase();
        if (errMsg.includes('barcode')) {
          return res.status(409).json({ message: 'Barcode already exists.' });
        } else if (errMsg.includes('slug')) {
          return res.status(409).json({ message: 'Product slug already exists.' });
        }
        return res.status(409).json({ message: 'A duplicate entry already exists in database.' });
      }
      console.error(err);
      return res.status(500).json({ message: 'Server error.' });
    }
  }

  return res.status(405).end();
}

async function saveRelations(productId, category_ids = [], brand_ids = [], tags = [], gallery = [], flavor_prices = []) {
  await query('DELETE FROM product_categories WHERE product_id = ?', [productId]);
  await query('DELETE FROM product_brands     WHERE product_id = ?', [productId]);
  await query('DELETE FROM product_tags       WHERE product_id = ?', [productId]);
  await query('DELETE FROM product_images     WHERE product_id = ?', [productId]);
  await query('DELETE FROM product_variation_prices WHERE product_id = ?', [productId]);

  for (const id of (category_ids || [])) {
    await query('INSERT IGNORE INTO product_categories (product_id, category_id) VALUES (?, ?)', [productId, id]);
  }
  for (const id of (brand_ids || [])) {
    await query('INSERT IGNORE INTO product_brands (product_id, brand_id) VALUES (?, ?)', [productId, id]);
  }
  for (const tag of (tags || [])) {
    const t = String(tag || '').trim();
    if (t) {
      await query('INSERT INTO product_tags (product_id, tag) VALUES (?, ?)', [productId, t]);
    }
  }
  for (let i = 0; i < (gallery || []).length; i++) {
    const imgData = gallery[i];
    const imagePath = saveProductImage(imgData);
    if (imagePath) {
      await query('INSERT INTO product_images (product_id, image, sort_order) VALUES (?, ?, ?)', [productId, imagePath, i]);
    }
  }
  for (const fp of (flavor_prices || [])) {
    if (fp && (fp.attributes || fp.price || fp.price === 0)) {
      const attrJson = typeof fp.attributes === 'string' ? fp.attributes : JSON.stringify(fp.attributes || {});
      const varImagePath = saveProductImage(fp.image);
      const varGalleryPaths = (fp.gallery || []).map(g => saveProductImage(g)).filter(Boolean);
      const varGalleryJson = varGalleryPaths.length > 0 ? JSON.stringify(varGalleryPaths) : null;

      await query(
        'INSERT INTO product_variation_prices (product_id, attributes, price, sale_price, barcode, image, gallery) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          productId,
          attrJson,
          parseFloat(fp.price) || 0,
          fp.sale_price !== null && fp.sale_price !== undefined && fp.sale_price !== '' ? parseFloat(fp.sale_price) : null,
          fp.barcode ? fp.barcode.trim() : null,
          varImagePath || null,
          varGalleryJson
        ]
      );
    }
  }
}
