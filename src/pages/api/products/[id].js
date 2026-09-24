import { query } from '../../../lib/db';
import { getAuthUser, canManageProductsCheck, canEdit, getCanManageProducts } from '../../../lib/auth';
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

    // Primary upload path (fitness app)
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
  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ message: 'Unauthorized.' });
  const { id } = req.query;

  if (req.method === 'GET') {
    try {
      const rows = await query(`
        SELECT p.*,
               COALESCE((
                 SELECT SUM(CASE WHEN status = 'available' THEN 1 WHEN status = 'oversold' THEN -1 ELSE 0 END)
                 FROM stock_items_new
                 WHERE product_id = p.id AND status IN ('available', 'oversold')
               ), 0) AS stock
        FROM products p
        WHERE p.id = ?
      `, [id]);
      if (!rows[0]) return res.status(404).json({ message: 'Product not found.' });

      const [cats, brands, tagRows, galleryRows, fpRows] = await Promise.all([
        query(`SELECT c.id, c.name FROM product_categories pc JOIN categories c ON c.id = pc.category_id WHERE pc.product_id = ?`, [id]),
        query(`SELECT b.id, b.name FROM product_brands pb JOIN brands b ON b.id = pb.brand_id WHERE pb.product_id = ?`, [id]),
        query(`SELECT tag FROM product_tags WHERE product_id = ?`, [id]),
        query(`SELECT image FROM product_images WHERE product_id = ? ORDER BY sort_order ASC, id ASC`, [id]),
        query(`SELECT id, product_id, attributes, price, sale_price, barcode, image, gallery FROM product_variation_prices WHERE product_id = ?`, [id]),
      ]);

      const parsedFpRows = fpRows.map(r => {
        let gal = [];
        if (r.gallery) {
          try {
            gal = typeof r.gallery === 'string' ? JSON.parse(r.gallery) : (Array.isArray(r.gallery) ? r.gallery : []);
          } catch (e) {
            gal = [];
          }
        }
        return {
          id: r.id,
          attributes: parseAttributes(r.attributes),
          price: r.price,
          sale_price: r.sale_price,
          barcode: r.barcode,
          image: r.image || '',
          gallery: Array.isArray(gal) ? gal : [],
        };
      });

      return res.status(200).json({
        ...rows[0],
        product_attributes: parseAttributes(rows[0].product_attributes),
        categories: cats,
        brands,
        tags: tagRows.map(t => t.tag),
        gallery: galleryRows.map(g => g.image),
        flavor_prices: parsedFpRows,
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: 'Server error.' });
    }
  }

  if (req.method === 'PUT') {
    if (user.role === 'sales') {
      user.canManageProducts = await getCanManageProducts(user.id);
    }
    if (!canManageProductsCheck(user)) return res.status(403).json({ message: 'Admin access required.' });
    const { name, sell_on_website, product_type, category_ids, brand_ids, barcode, price, sale_price, description, image, slug, tags, gallery, flavor_prices, product_attributes, confirm_stock_reset } = req.body;
    if (!name) return res.status(400).json({ message: 'Product name is required.' });

    try {
      const pRows = await query(`SELECT name, product_type FROM products WHERE id = ?`, [id]);
      if (!pRows[0]) return res.status(404).json({ message: 'Product not found.' });
      const currentProd = pRows[0];

      const oldIsVar = Boolean(currentProd.product_type === 'variable_product');
      const newIsVar = (Array.isArray(flavor_prices) && flavor_prices.length > 0) || product_type === 'variable_product';
      const computedType = newIsVar ? 'variable_product' : 'simple_product';
      const sellOnWebsiteVal = (sell_on_website === false || sell_on_website === 0 || sell_on_website === '0') ? 0 : 1;

      if (oldIsVar !== newIsVar) {
        let countSql = '';
        if (!oldIsVar && newIsVar) {
          countSql = `SELECT COUNT(*) AS n FROM stock_items_new WHERE product_id = ?`;
        } else if (oldIsVar && !newIsVar) {
          countSql = `SELECT COUNT(*) AS n FROM stock_items_new WHERE product_id = ?`;
        }

        const countRows = await query(countSql, [id]);
        const oldStockCount = countRows[0]?.n || 0;

        if (oldStockCount > 0 && !confirm_stock_reset) {
          return res.status(409).json({
            requireConfirmation: true,
            message: `This product has ${oldStockCount} existing stock items. Changing product type will permanently reset stock records. Do you want to proceed?`,
            oldType: oldIsVar ? 'variable' : 'simple',
            newType: newIsVar ? 'variable' : 'simple',
            stockCount: oldStockCount
          });
        }
      }

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
  let prodSql = `SELECT id, name, barcode FROM products WHERE (${uniqueCodes.map(() => 'LOWER(barcode) = LOWER(?)').join(' OR ')}) AND id != ?`;
  const prodParams = [...uniqueCodes, excludeProductId];
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
    WHERE (${uniqueCodes.map(() => 'LOWER(pvp.barcode) = LOWER(?)').join(' OR ')}) AND pvp.product_id != ?
  `;
  const varParams = [...uniqueCodes, excludeProductId];
  const existingVars = await query(varSql, varParams);
  if (existingVars && existingVars.length > 0) {
    const dup = existingVars[0];
    return `Barcode "${dup.barcode}" is already in use by a variation of product "${dup.product_name}". Barcodes must be unique across all products and variations.`;
  }

  return null;
}

      const barcodeErr = await validateBarcodes(id, barcode, flavor_prices);
      if (barcodeErr) {
        return res.status(400).json({ message: barcodeErr });
      }

      const finalSlug = await generateUniqueSlug(slug, name, id);
      const imagePath = saveProductImage(image);
      const prodAttrJson = product_attributes ? (typeof product_attributes === 'string' ? product_attributes : JSON.stringify(product_attributes)) : null;

      await query(
        `UPDATE products SET name=?, product_type=?, sell_on_website=?, barcode=?, price=?, sale_price=?, description=?, image=COALESCE(?, image), slug=?, product_attributes=? WHERE id=?`,
        [name, computedType, sellOnWebsiteVal, barcode || null, price || 0, sale_price ? parseFloat(sale_price) : null, description || null, imagePath || null, finalSlug || null, prodAttrJson, id]
      );
      await saveRelations(id, category_ids, brand_ids, tags, gallery, flavor_prices);
      return res.status(200).json({ message: 'Product updated.' });
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

  if (req.method === 'DELETE') {
    if (!canEdit(user)) return res.status(403).json({ message: 'Admin access required.' });
    try {
      const product = await query('SELECT id, name FROM products WHERE id = ? LIMIT 1', [id]);
      if (!product.length) return res.status(404).json({ message: 'Product not found.' });

      // Always soft-delete — never hard delete products
      // Set delete_status = 'deleted', clear stock, hide from website
      await query(
        `UPDATE products SET delete_status = 'deleted', sell_on_website = 0 WHERE id = ?`,
        [id]
      );
      // Clear all stock so it doesn't appear in stock management
      await query('DELETE FROM stock_items_new WHERE product_id = ?', [id]);

      return res.status(200).json({ message: 'Product deleted.' });
    } catch (err) {
      console.error('Delete product error:', err);
      return res.status(500).json({ message: err.sqlMessage || 'Server error.' });
    }
  }

  return res.status(405).end();
}

async function saveRelations(productId, category_ids = [], brand_ids = [], tags = [], gallery = [], flavor_prices = []) {
  await query('DELETE FROM product_categories WHERE product_id = ?', [productId]);
  await query('DELETE FROM product_brands     WHERE product_id = ?', [productId]);
  await query('DELETE FROM product_tags       WHERE product_id = ?', [productId]);
  await query('DELETE FROM product_images     WHERE product_id = ?', [productId]);

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

  const existingVariations = await query('SELECT id, attributes FROM product_variation_prices WHERE product_id = ?', [productId]);
  const existingIds = new Set(existingVariations.map(r => Number(r.id)));
  const keptIds = new Set();

  for (const fp of (flavor_prices || [])) {
    if (fp && (fp.attributes || fp.price || fp.price === 0)) {
      const attrJson = typeof fp.attributes === 'string' ? fp.attributes : JSON.stringify(fp.attributes || {});
      const varImagePath = saveProductImage(fp.image);
      const varGalleryPaths = (fp.gallery || []).map(g => saveProductImage(g)).filter(Boolean);
      const varGalleryJson = varGalleryPaths.length > 0 ? JSON.stringify(varGalleryPaths) : null;
      const fpPrice = parseFloat(fp.price) || 0;
      const fpSalePrice = fp.sale_price !== null && fp.sale_price !== undefined && fp.sale_price !== '' ? parseFloat(fp.sale_price) : null;
      const fpBarcode = fp.barcode ? fp.barcode.trim() : null;

      let targetId = (fp.id && existingIds.has(Number(fp.id))) ? Number(fp.id) : null;
      if (!targetId) {
        const match = existingVariations.find(ev => {
          if (keptIds.has(Number(ev.id))) return false;
          try {
            const evAttr = typeof ev.attributes === 'string' ? JSON.parse(ev.attributes) : (ev.attributes || {});
            const fpAttr = typeof fp.attributes === 'string' ? JSON.parse(fp.attributes) : (fp.attributes || {});
            return JSON.stringify(evAttr) === JSON.stringify(fpAttr);
          } catch(e) { return false; }
        });
        if (match) targetId = Number(match.id);
      }

      if (targetId) {
        keptIds.add(targetId);
        await query(
          'UPDATE product_variation_prices SET attributes=?, price=?, sale_price=?, barcode=?, image=COALESCE(?, image), gallery=COALESCE(?, gallery) WHERE id=? AND product_id=?',
          [attrJson, fpPrice, fpSalePrice, fpBarcode, varImagePath || null, varGalleryJson || null, targetId, productId]
        );
      } else {
        const ins = await query(
          'INSERT INTO product_variation_prices (product_id, attributes, price, sale_price, barcode, image, gallery) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [productId, attrJson, fpPrice, fpSalePrice, fpBarcode, varImagePath || null, varGalleryJson || null]
        );
        if (ins.insertId) keptIds.add(Number(ins.insertId));
      }
    }
  }

  const idsToDelete = [...existingIds].filter(id => !keptIds.has(id));
  if (idsToDelete.length > 0) {
    const placeholders = idsToDelete.map(() => '?').join(',');
    await query(`DELETE FROM product_variation_prices WHERE product_id = ? AND id IN (${placeholders})`, [productId, ...idsToDelete]);
  }
}
