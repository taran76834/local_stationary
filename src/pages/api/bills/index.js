import { query, getPool } from '@/lib/db';
import { requireAdminOnly, getAuthUser, canAccessStore } from '@/lib/auth';
import { getUserStores, getStorePermissions } from '@/lib/userMeta';

function generateBillNumber() {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `BILL-${y}${m}${d}-${rand}`;
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    // GET: All authenticated users can view bills
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ message: 'Not authenticated.' });

    try {
      let sql = `
        SELECT b.*, s.name AS store_name, u.name AS created_by_name
        FROM bills b
        LEFT JOIN stores s ON b.store_id = s.id
        LEFT JOIN users  u ON b.created_by = u.id
      `;
      const params = [];

      if (user.role !== 'admin') {
        // Get stores based on user role
        let userStores = [];
        if (user.role === 'sales') {
          // Sales: stores come from store_permissions keys
          const storePerms = await getStorePermissions(user.id);
          userStores = Object.keys(storePerms).map(Number);
        } else if (user.role === 'manager') {
          // Manager: stores come from assigned_stores
          userStores = await getUserStores(user.id);
        } else {
          userStores = await getUserStores(user.id);
        }

        if (!userStores || userStores.length === 0) {
          return res.status(200).json([]);
        }
        const placeholders = userStores.map(() => '?').join(',');
        sql += ` WHERE b.store_id IN (${placeholders})`;
        params.push(...userStores);
      }

      sql += ' ORDER BY b.created_at DESC';
      const rows = await query(sql, params);
      return res.status(200).json(rows);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: 'Server error.' });
    }
  }

  // POST: Admin or authorized user
  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ message: 'Not authenticated.' });

  if (req.method === 'POST') {
    const { store_id, customer_name, customer_phone, items, discount, tax, notes, payment_type } = req.body;
    if (!items || items.length === 0)
      return res.status(400).json({ message: 'At least one item is required.' });

    if (store_id) {
      const hasAccess = await canAccessStore(user, store_id, async (uid) => {
        if (user.role === 'sales') {
          const storePerms = await getStorePermissions(uid);
          return Object.keys(storePerms).map(Number);
        }
        return getUserStores(uid);
      });
      if (!hasAccess) {
        return res.status(403).json({ message: 'You do not have permission to create bills for this store.' });
      }
    }

    const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
    const discountAmt = parseFloat(discount) || 0;
    const taxAmt = parseFloat(tax) || 0;
    const total = subtotal - discountAmt + taxAmt;
    const billNumber = generateBillNumber();
    const payType = ['cash', 'card', 'upi'].includes(payment_type) ? payment_type : 'cash';

    const pool = getPool();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // ── Auto-save / link customer ──────────────────────────────────────
      let customerId = null;
      const cName = customer_name?.trim() || null;
      const cPhone = customer_phone?.trim() || null;

      if (cName) {
        // Try to find existing customer by phone first, then by name
        let existing = null;
        if (cPhone) {
          const [rows] = await conn.execute(
            'SELECT id FROM customers WHERE phone = ? LIMIT 1', [cPhone]
          );
          if (rows.length > 0) existing = rows[0];
        }
        if (!existing) {
          const [rows] = await conn.execute(
            'SELECT id FROM customers WHERE name = ? LIMIT 1', [cName]
          );
          if (rows.length > 0) existing = rows[0];
        }

        if (existing) {
          customerId = existing.id;
          // Update name/phone if new info provided
          await conn.execute(
            `UPDATE customers SET
               name  = COALESCE(?, name),
               phone = COALESCE(?, phone)
             WHERE id = ?`,
            [cName, cPhone, customerId]
          );
        } else {
          const [result] = await conn.execute(
            'INSERT INTO customers (name, phone) VALUES (?, ?)',
            [cName, cPhone]
          );
          customerId = result.insertId;
        }
      }

      const [billResult] = await conn.execute(
        `INSERT INTO bills (bill_number, store_id, created_by, customer_id, customer_name, customer_phone, payment_type, total_amount, discount, tax, notes, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid')`,
        [billNumber, store_id || null, user.id, customerId, cName, cPhone, payType, total, discountAmt, taxAmt, notes || null]
      );
      const billId = billResult.insertId;

      for (const item of items) {
        const qty = parseInt(item.quantity) || 0;
        const unitPrice = parseFloat(item.unit_price) || 0;
        const variationId = item.variation_id ? parseInt(item.variation_id) : null;

        const [billItemResult] = await conn.execute(
          `INSERT INTO bill_items (bill_id, product_id, variation_id, quantity, unit_price) VALUES (?, ?, ?, ?, ?)`,
          [billId, item.product_id, variationId, qty, unitPrice]
        );
        const billItemId = billItemResult.insertId;

        if (store_id) {
          let available = [];
          const expVal = (item.expiry_date !== undefined && item.expiry_date) ? item.expiry_date.slice(0, 10) : null;

          // Helper query builder for stock_items_new
          const buildStockQuery = (withExpiry) => {
            let sql = `
              SELECT si.id, si.variation_id
              FROM stock_items_new si
              WHERE si.store_id = ? AND si.product_id = ? AND si.status = 'available'
            `;
            const p = [store_id, item.product_id];
            if (variationId) {
              sql += ` AND si.variation_id = ?`;
              p.push(variationId);
            } else {
              sql += ` AND (si.variation_id IS NULL OR si.variation_id = 0)`;
            }

            if (withExpiry) {
              if (expVal === null) {
                sql += ` AND si.expiry_date IS NULL`;
              } else {
                sql += ` AND si.expiry_date = ?`; p.push(expVal);
              }
              sql += ` ORDER BY (si.variation_id = ?) DESC, si.created_at ASC LIMIT ?`;
              p.push(variationId || 0, String(qty));
            } else {
              sql += ` ORDER BY (si.variation_id = ?) DESC, si.expiry_date IS NULL ASC, si.expiry_date ASC, si.created_at ASC LIMIT ?`;
              p.push(variationId || 0, String(qty));
            }
            return { sql, p };
          };

          // 1. Find available units in stock_items_new matching variation_id / attributes
          if (item.expiry_date !== undefined) {
            const { sql, p } = buildStockQuery(true);
            [available] = await conn.execute(sql, p);
          } else {
            const { sql, p } = buildStockQuery(false);
            [available] = await conn.execute(sql, p);
          }

          for (const si of available) {
            await conn.execute(
              `UPDATE stock_items_new SET status = 'sold', variation_id = COALESCE(?, variation_id), bill_item_id = ? WHERE id = ?`,
              [variationId, billItemId, si.id]
            );
          }

          // If bill quantity exceeds available stock units, record oversold shortfall so stock goes negative
          const oversoldQty = qty - available.length;
          if (oversoldQty > 0) {
            const oversoldVals = Array(oversoldQty).fill('(?, ?, ?, ?, ?, \'oversold\')').join(',');
            const oversoldParams = [];
            for (let i = 0; i < oversoldQty; i++) {
              oversoldParams.push(store_id, item.product_id, variationId, null, billItemId);
            }
            await conn.execute(
              `INSERT INTO stock_items_new (store_id, product_id, variation_id, expiry_date, bill_item_id, status) VALUES ${oversoldVals}`,
              oversoldParams
            );
          }
        }
      }

      await conn.commit();
      return res.status(201).json({ message: 'Bill created.', id: billId, bill_number: billNumber });
    } catch (err) {
      await conn.rollback();
      console.error('Bill create error:', err.message, err.sqlMessage || '');
      return res.status(500).json({ message: err.sqlMessage || err.message || 'Server error.' });
    } finally {
      conn.release();
    }
  }

  return res.status(405).end();
}
