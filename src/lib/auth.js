import jwt from 'jsonwebtoken';
import { parse } from 'cookie';
import { query } from '@/lib/db';
import { getCanManageProducts } from '@/lib/userMeta';
export { getCanManageProducts };

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey_changeme_2024';

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

/**
 * Decodes + validates the JWT, then confirms token_version still matches
 * the value stored in the DB. Returns null if the token is missing, invalid,
 * or has been invalidated by a password change.
 */
export async function getAuthUser(req) {
  const cookieHeader = req.headers.cookie || '';
  const cookies = parse(cookieHeader);
  const token = cookies.token;
  if (!token) return null;

  const decoded = verifyToken(token);
  if (!decoded) return null;

  if (decoded.token_version === undefined) return null;

  try {
    const rows = await query(
      'SELECT token_version FROM users WHERE id = ? LIMIT 1',
      [decoded.id]
    );
    if (!rows.length) return null;
    if (rows[0].token_version !== decoded.token_version) return null;
  } catch {
    return null;
  }

  return decoded;
}

export function isRoleAllowed(role, url, method) {
  if (role === 'admin') return true;

  const path = url.split('?')[0];

  // Common paths for sales/store roles
  const commonPaths = [
    '/api/dashboard/stats',
    '/api/products',
    '/api/store-products',
    '/api/stock-items',
    '/api/bills',
    '/api/customers',
    '/api/orders',
    '/api/website-customers',
    '/api/auth/me',
    '/api/auth/logout',
    '/api/users/profile',
  ];

  // manager + sales
  if (role === 'manager' || role === 'sales') {
    const allowedPaths = [
      ...commonPaths,
      '/api/stores',
      '/api/purchase-orders',
      '/api/suppliers',
      '/api/categories',
      '/api/flavors',
      '/api/brands',
      '/api/stock-transfers',
      '/api/shipping',
    ];
    const isAllowedPath = allowedPaths.some(p => path === p || path.startsWith(p + '/'));
    if (!isAllowedPath) return false;
    
    // Manager can view and create categories/flavors/brands, but NOT delete
    if (role === 'manager') {
      if ((path === '/api/categories' || path === '/api/flavors' || path === '/api/brands') && method === 'DELETE') {
        return false;
      }
      // For these endpoints, allow GET and POST but not DELETE
      if ((path.startsWith('/api/categories/') || path.startsWith('/api/flavors/') || path.startsWith('/api/brands/')) && method === 'DELETE') {
        return false;
      }
    }
    return true;
  }
  // Legacy store_minus — needs categories/flavors/brands/stores
  if (role === 'store_minus') {
    const storeminusPaths = [
      ...commonPaths,
      '/api/categories',
      '/api/flavors',
      '/api/brands',
      '/api/stores',
    ];
    const isAllowedPath = storeminusPaths.some(p => path === p || path.startsWith(p + '/'));
    if (!isAllowedPath) return false;
    if (method === 'DELETE' && !path.startsWith('/api/stock-items')) return false;
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const isAllowedMutation =
        path.startsWith('/api/bills') ||
        path.startsWith('/api/store-products') ||
        path.startsWith('/api/stock-items') ||
        path.startsWith('/api/auth') ||
        path.startsWith('/api/users/profile');
      if (!isAllowedMutation) return false;
    }
    return true;
  }

  // Legacy store_plus
  if (role === 'store_plus') {
    const plusPaths = [
      ...commonPaths,
      '/api/categories',
      '/api/flavors',
      '/api/brands',
      '/api/stores',
      '/api/purchase-orders',
      '/api/suppliers',
    ];
    const isAllowedPath = plusPaths.some(p => path === p || path.startsWith(p + '/'));
    if (!isAllowedPath) return false;
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      if (
        path === '/api/store-products' ||
        path.startsWith('/api/stock-items') ||
        path.startsWith('/api/purchase-orders') ||
        path.startsWith('/api/bills')
      ) {
        return true;
      }
      return false;
    }
    return true;
  }

  return false;
}

/**
 * Requires admin, manager, store_minus, store_plus, OR sales role.
 */
export async function requireAdmin(req, res) {
  const user = await getAuthUser(req);
  if (!user) {
    res.status(401).json({ message: 'Unauthorized' });
    return null;
  }
  if (!['admin', 'manager', 'store_minus', 'store_plus', 'sales'].includes(user.role)) {
    res.status(401).json({ message: 'Unauthorized' });
    return null;
  }
  if (!isRoleAllowed(user.role, req.url, req.method)) {
    res.status(403).json({ message: 'Forbidden: Access denied for this role.' });
    return null;
  }
  return user;
}

/**
 * Requires admin role only.
 */
export async function requireAdminOnly(req, res) {
  const user = await getAuthUser(req);
  if (!user || user.role !== 'admin') {
    res.status(403).json({ message: 'Admin access required.' });
    return null;
  }
  return user;
}

/**
 * canEdit — true for admin or legacy store_minus only.
 * Managers can't edit categories, flavors, brands, stores.
 * For per-store write checks, use canEditStore() instead.
 */
export function canEdit(user) {
  return ['admin', 'store_minus'].includes(user?.role);
}

/**
 * Check if user can manage (add/edit) products.
 * True for admin, or sales users with can_manage_products meta enabled.
 * The canManageProducts flag must be pre-loaded onto the user object.
 */
export function canManageProductsCheck(user) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'sales' && user.canManageProducts === true) return true;
  return false;
}

/**
 * Check if user can access a specific store.
 * Admin: all stores. sales/store_minus/store_plus: only assigned stores.
 */
export async function canAccessStore(user, storeId, getUserStoresFn) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (!storeId) return true;
  if (!getUserStoresFn) return true;
  const stores = await getUserStoresFn(user.id);
  if (!stores || !stores.length) return false;
  return stores.map(Number).includes(Number(storeId));
}

/**
 * For 'sales' and 'manager' roles: check if user has 'minus' (edit) permission for a store.
 */
export async function canEditStore(user, storeId) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'store_minus') return true;  // legacy
  if (user.role === 'sales' || user.role === 'manager') {
    const { getStorePermission } = await import('@/lib/userMeta');
    const perm = await getStorePermission(user.id, storeId);
    return perm === 'minus';
  }
  return false;
}
