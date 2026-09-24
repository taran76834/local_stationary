import { query } from '@/lib/db';

/**
 * Fetch a specific meta value for a user.
 */
export async function getUserMeta(userId, key) {
  if (!userId || !key) return null;
  const rows = await query(
    'SELECT `value` FROM user_meta WHERE user_id = ? AND `key` = ? LIMIT 1',
    [userId, key]
  );
  return rows[0] ? rows[0].value : null;
}

/**
 * Set a specific meta key/value for a user.
 */
export async function setUserMeta(userId, key, value) {
  if (!userId || !key) return;
  const strValue = value === null || value === undefined ? null : String(value);
  await query(
    `INSERT INTO user_meta (user_id, \`key\`, \`value\`)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`)`,
    [userId, key, strValue]
  );
}

// ─── Per-store permissions ────────────────────────────────────────────────────
//
// Stored in user_meta key 'store_permissions' as JSON:
//   { "3": ["minus", "transfers"], "7": ["plus", "minus"], "12": ["transfers"] }
//
// Each store maps to an array of granted permissions:
// "minus"     → can create bills
// "plus"      → can edit stock & receipts
// "transfers" → can manage stock transfers
//
// Backward-compat: old string values "plus"|"minus" are treated as [value]

const VALID_PERMS = new Set(['plus', 'minus', 'transfers']);

/**
 * Get the full store-permissions map for a user.
 * Returns { [storeId: string]: string[] }
 */
export async function getStorePermissions(userId) {
  const val = await getUserMeta(userId, 'store_permissions');
  if (!val) return {};
  try {
    const parsed = JSON.parse(val);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      // Normalize: convert legacy string values to arrays
      const normalized = {};
      for (const [sid, v] of Object.entries(parsed)) {
        if (Array.isArray(v)) {
          normalized[sid] = v.filter(p => VALID_PERMS.has(p));
        } else if (typeof v === 'string' && VALID_PERMS.has(v)) {
          normalized[sid] = [v];
        }
      }
      return normalized;
    }
  } catch { /* fall through */ }
  return {};
}

/**
 * Check if user has a specific permission for one store.
 * Returns true/false.
 */
export async function getStorePermission(userId, storeId) {
  const perms = await getStorePermissions(userId);
  const arr = perms[String(storeId)];
  // Backward-compat: return 'minus'|'plus' if only one perm, else the array
  if (!arr || arr.length === 0) return null;
  if (arr.length === 1) return arr[0];
  return arr;
}

/**
 * Check if user has a specific named permission for a store.
 */
export async function hasStorePerm(userId, storeId, permKey) {
  const perms = await getStorePermissions(userId);
  const arr = perms[String(storeId)];
  if (!arr) return false;
  return Array.isArray(arr) ? arr.includes(permKey) : arr === permKey;
}

/**
 * Save the full store-permissions map for a user.
 * @param {number|string} userId
 * @param {Object} perms  e.g. { "3": ["minus","transfers"], "7": ["plus"] }
 */
export async function setStorePermissions(userId, perms) {
  const clean = {};
  for (const [storeId, level] of Object.entries(perms || {})) {
    const id = Number(storeId);
    if (isNaN(id) || id <= 0) continue;
    // Accept array or legacy string
    const arr = Array.isArray(level)
      ? level.filter(p => VALID_PERMS.has(p))
      : (typeof level === 'string' && VALID_PERMS.has(level) ? [level] : []);
    if (arr.length > 0) clean[String(id)] = arr;
  }
  await setUserMeta(userId, 'store_permissions', JSON.stringify(clean));
}

// ─── Manage Products permission ──────────────────────────────────────────────
//
// Stored in user_meta key 'can_manage_products' as '1' (enabled) or '0' / null (disabled).
// Only meaningful for 'sales' role users.

/**
 * Returns true if the user has been granted product management access.
 */
export async function getCanManageProducts(userId) {
  const val = await getUserMeta(userId, 'can_manage_products');
  return val === '1';
}

/**
 * Save product management permission for a user.
 * @param {number|string} userId
 * @param {boolean} enabled
 */
export async function setCanManageProducts(userId, enabled) {
  await setUserMeta(userId, 'can_manage_products', enabled ? '1' : '0');
}

// ─── Can View Orders & Website Customers ─────────────────────────────────────
//
// Stored in user_meta key 'can_view_orders_customers' as '1' or '0' / null.
// Only meaningful for 'sales' role users.
// When enabled, the sales user can access /orders and /website-customers pages.

/**
 * Returns true if the sales user has been granted access to orders & website customers.
 */
export async function getCanViewOrdersCustomers(userId) {
  const val = await getUserMeta(userId, 'can_view_orders_customers');
  return val === '1';
}

/**
 * Save orders & website customers view permission for a user.
 * @param {number|string} userId
 * @param {boolean} enabled
 */
export async function setCanViewOrdersCustomers(userId, enabled) {
  await setUserMeta(userId, 'can_view_orders_customers', enabled ? '1' : '0');
}

// ─── Legacy helpers (kept for backward-compat with existing routes) ───────────

/**
 * Get assigned store IDs for a user as an array of numbers.
 * For 'sales' role: derived from store_permissions keys.
 * For legacy store_minus/store_plus: reads 'assigned_stores' meta.
 */
export async function getUserStores(userId) {
  // Read assigned_stores directly
  const val = await getUserMeta(userId, 'assigned_stores');
  if (val) {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) {
        return parsed.map(id => Number(id)).filter(id => !isNaN(id));
      }
    } catch {
      return val.split(',').map(s => Number(s.trim())).filter(id => !isNaN(id));
    }
  }
  return [];
}

/**
 * Set assigned store IDs for a user (legacy, used for admin/manager).
 */
export async function setUserStores(userId, storeIds) {
  const arr = Array.isArray(storeIds) ? storeIds.map(id => Number(id)).filter(id => !isNaN(id)) : [];
  await setUserMeta(userId, 'assigned_stores', JSON.stringify(arr));
}

/**
 * Get assigned stores map for a list of user IDs.
 * Returns { [userId]: [storeId, ...] }
 */
export async function getUsersStoresMap(userIds = []) {
  if (!userIds.length) return {};
  const placeholders = userIds.map(() => '?').join(',');

  // Load both keys in one query
  const rows = await query(
    `SELECT user_id, \`key\`, \`value\` FROM user_meta
     WHERE \`key\` IN ('assigned_stores','store_permissions')
       AND user_id IN (${placeholders})`,
    userIds
  );

  // Also need to fetch user roles to know which data to prefer
  const userRows = await query(
    `SELECT id, role FROM users WHERE id IN (${placeholders})`,
    userIds
  );
  
  const roleMap = {};
  for (const u of userRows) {
    roleMap[u.id] = u.role;
  }

  // Group by user
  const byUser = {};
  for (const r of rows) {
    if (!byUser[r.user_id]) byUser[r.user_id] = {};
    byUser[r.user_id][r.key] = r.value;
  }

  const map = {};
  for (const uid of userIds) {
    const data = byUser[uid] || {};
    const role = roleMap[uid];

    // Manager users use assigned_stores
    if (role === 'manager' && data.assigned_stores) {
      try {
        const parsed = JSON.parse(data.assigned_stores);
        if (Array.isArray(parsed)) {
          map[uid] = parsed.map(Number).filter(n => !isNaN(n));
          continue;
        }
      } catch { /* fall through */ }
    }

    // Manager users also check store_permissions as fallback (for data saved before fix)
    if (role === 'manager' && data.store_permissions) {
      try {
        const perms = JSON.parse(data.store_permissions);
        if (perms && typeof perms === 'object') {
          // Extract store IDs from permissions object
          map[uid] = Object.keys(perms).map(Number).filter(n => !isNaN(n));
          continue;
        }
      } catch { /* fall through */ }
    }

    // Sales users prefer store_permissions
    if (role === 'sales' && data.store_permissions) {
      try {
        const perms = JSON.parse(data.store_permissions);
        if (perms && typeof perms === 'object') {
          map[uid] = Object.keys(perms).map(Number).filter(n => !isNaN(n));
          continue;
        }
      } catch { /* fall through */ }
    }

    // Legacy assigned_stores fallback
    if (data.assigned_stores) {
      try {
        const parsed = JSON.parse(data.assigned_stores);
        if (Array.isArray(parsed)) {
          map[uid] = parsed.map(Number).filter(n => !isNaN(n));
          continue;
        }
      } catch {
        map[uid] = (data.assigned_stores || '').split(',').map(s => Number(s.trim())).filter(n => !isNaN(n));
        continue;
      }
    }

    map[uid] = [];
  }

  return map;
}

/**
 * Get store_permissions map for multiple user IDs.
 * Returns { [userId]: { storeId: 'plus'|'minus' } }
 */
export async function getUsersStorePermsMap(userIds = []) {
  if (!userIds.length) return {};
  const placeholders = userIds.map(() => '?').join(',');
  const rows = await query(
    `SELECT user_id, \`value\` FROM user_meta
     WHERE \`key\` = 'store_permissions' AND user_id IN (${placeholders})`,
    userIds
  );

  const map = {};
  for (const r of rows) {
    try {
      const parsed = JSON.parse(r.value);
      if (parsed && typeof parsed === 'object') {
        // Normalize legacy string values to arrays
        const normalized = {};
        for (const [sid, v] of Object.entries(parsed)) {
          if (Array.isArray(v)) {
            normalized[sid] = v;
          } else if (typeof v === 'string') {
            normalized[sid] = [v];
          }
        }
        map[r.user_id] = normalized;
      }
    } catch { /* skip */ }
  }
  return map;
}
