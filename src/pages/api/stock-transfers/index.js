import { query, getPool } from '@/lib/db';
import { getAuthUser, isRoleAllowed } from '@/lib/auth';
import { getStorePermissions } from '@/lib/userMeta';

/**
 * Get store IDs where user has 'transfers' permission.
 * Admin → null (means all stores).
 */
async function getTransferStores(user) {
  if (user.role === 'admin') return null;
  const perms = await getStorePermissions(user.id);
  const ids = [];
  for (const [sid, arr] of Object.entries(perms)) {
    const list = Array.isArray(arr) ? arr : [arr];
    if (list.includes('transfers')) ids.push(Number(sid));
  }
  return ids;
}

export default async function handler(req, res) {
  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ message: 'Unauthorized' });

  // Allow admin always; allow sales/manager if they have transfers permission
  const isAdmin = user.role === 'admin';
  let transferStores = null; // null = all stores access

  if (!isAdmin) {
    if (!['sales', 'manager'].includes(user.role)) {
      return res.status(403).json({ message: 'Forbidden.' });
    }
    transferStores = await getTransferStores(user);
    if (transferStores.length === 0) {
      return res.status(403).json({ message: 'No stock transfer permissions assigned.' });
    }
  }

  // ── GET — list transfers with filters ──────────────────────────────────────
  if (req.method === 'GET') {
    const { from_store, to_store, product_id, date_from, date_to, q } = req.query;

    let sql = `
      SELECT
        st.id, st.transfer_number,
        st.quantity, st.expiry_date, st.notes, st.created_at,
        st.variation_id, pvp.attributes AS variation_attributes,
        fs.name  AS from_store_name,
        ts.name  AS to_store_name,
        p.name   AS product_name,
        usr.name AS created_by_name
      FROM stock_transfers st
      JOIN stores   fs ON fs.id = st.from_store_id
      JOIN stores   ts ON ts.id = st.to_store_id
      JOIN products p  ON p.id  = st.product_id
      LEFT JOIN product_variation_prices pvp ON pvp.id = st.variation_id
      LEFT JOIN users usr  ON usr.id = st.created_by
      WHERE 1=1
    `;
    const params = [];

    // Scope to user's permitted stores (non-admin)
    if (transferStores !== null) {
      if (transferStores.length === 0) {
        return res.status(200).json([]);
      }
      const ph = transferStores.map(() => '?').join(',');
      sql += ` AND (st.from_store_id IN (${ph}) OR st.to_store_id IN (${ph}))`;
      params.push(...transferStores, ...transferStores);
    }

    if (from_store)  { sql += ' AND st.from_store_id = ?'; params.push(from_store); }
    if (to_store)    { sql += ' AND st.to_store_id = ?';   params.push(to_store); }
    if (product_id)  { sql += ' AND st.product_id = ?';    params.push(product_id); }
    if (date_from)   { sql += ' AND DATE(st.created_at) >= ?'; params.push(date_from); }
    if (date_to)     { sql += ' AND DATE(st.created_at) <= ?'; params.push(date_to); }
    if (q) {
      sql += ' AND (st.transfer_number LIKE ? OR p.name LIKE ? OR fs.name LIKE ? OR ts.name LIKE ?)';
      const like = `%${q}%`;
      params.push(like, like, like, like);
    }

    sql += ' ORDER BY st.created_at DESC LIMIT 500';

    try {
      const rows = await query(sql, params);
      return res.status(200).json(rows);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: 'Server error.' });
    }
  }

  // ── POST — create transfer ─────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { from_store_id, to_store_id, product_id, variation_id, quantity, expiry_date, notes } = req.body;

    if (!from_store_id || !to_store_id || !product_id || !quantity || quantity < 1)
      return res.status(400).json({ message: 'from_store_id, to_store_id, product_id and quantity are required.' });

    if (String(from_store_id) === String(to_store_id))
      return res.status(400).json({ message: 'Source and destination store must be different.' });

    // Verify non-admin user has access to the from_store
    if (transferStores !== null && !transferStores.includes(Number(from_store_id))) {
      return res.status(403).json({ message: 'No transfer permission for the source store.' });
    }

    const pool = getPool();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const expiry = expiry_date ? String(expiry_date).slice(0, 10) : null;
      const qty    = parseInt(quantity);
      const variationId = variation_id ? parseInt(variation_id) : null;

      // Check source store has enough stock for this exact variation & expiry
      let checkSql = `SELECT COUNT(*) AS n FROM stock_items_new WHERE store_id = ? AND product_id = ? AND status = 'available'`;
      const checkParams = [from_store_id, product_id];
      if (variationId) { checkSql += ` AND variation_id = ?`; checkParams.push(variationId); }

      if (expiry === null) {
        checkSql += ` AND expiry_date IS NULL`;
      } else {
        checkSql += ` AND expiry_date = ?`; checkParams.push(expiry);
      }

      const [[{ n: available }]] = await conn.execute(checkSql, checkParams);
      if (available < qty) {
        await conn.rollback();
        return res.status(400).json({
          message: `Not enough stock. Available: ${available}, requested: ${qty}.`
        });
      }

      // Delete stock_items_new rows from source store
      let delSql = `DELETE FROM stock_items_new WHERE id IN (
        SELECT id FROM (
          SELECT id FROM stock_items_new WHERE store_id = ? AND product_id = ? AND status = 'available'`;
      const delParams = [from_store_id, product_id];
      if (variationId) { delSql += ` AND variation_id = ?`; delParams.push(variationId); }

      if (expiry === null) {
        delSql += ` AND expiry_date IS NULL`;
      } else {
        delSql += ` AND expiry_date = ?`; delParams.push(expiry);
      }
      delSql += ` LIMIT ${qty} ) t )`;

      await conn.execute(delSql, delParams);

      // Insert into destination store
      const CHUNK = 100;
      for (let offset = 0; offset < qty; offset += CHUNK) {
        const chunkSize = Math.min(CHUNK, qty - offset);
        const vals   = Array(chunkSize).fill(`(?,?,?,'available',?)`).join(',');
        const insArr = [];
        for (let i = 0; i < chunkSize; i++) {
          insArr.push(to_store_id, product_id, variationId, expiry);
        }
        await conn.execute(`INSERT INTO stock_items_new (store_id, product_id, variation_id, status, expiry_date) VALUES ${vals}`, insArr);
      }


      // Generate transfer number
      const [[{ cnt }]] = await conn.execute(`SELECT COUNT(*) AS cnt FROM stock_transfers`);
      const transferNumber = `TRF-${String(cnt + 1).padStart(5, '0')}`;

      // Save transfer record with variation columns
      await conn.execute(`
        INSERT INTO stock_transfers (transfer_number, from_store_id, to_store_id, product_id, variation_id, quantity, expiry_date, notes, created_by)
        VALUES (?,?,?,?,?,?,?,?,?)
      `, [transferNumber, from_store_id, to_store_id, product_id, variationId, qty, expiry, notes || null, user.id]);

      await conn.commit();
      return res.status(201).json({ message: 'Transfer completed.', transfer_number: transferNumber });
    } catch (err) {
      await conn.rollback();
      console.error('[stock-transfer POST]', err.message, err.sqlMessage || '');
      return res.status(500).json({ message: err.sqlMessage || err.message || 'Server error.' });
    } finally {
      conn.release();
    }
  }

  return res.status(405).end();
}
