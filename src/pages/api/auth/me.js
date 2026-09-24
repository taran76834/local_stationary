import { getAuthUser } from '@/lib/auth';
import { getUserStores, getStorePermissions, getCanManageProducts, getCanViewOrdersCustomers } from '@/lib/userMeta';
import { query } from '@/lib/db';

export default async function handler(req, res) {
  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ message: 'Not authenticated.' });

  // Always fetch fresh user data from DB so role/name changes are reflected
  // without requiring logout. getAuthUser() already validates the token_version,
  // so by this point we know the session is valid — we just need fresh fields.
  const rows = await query(
    'SELECT id, name, email, role FROM users WHERE id = ? LIMIT 1',
    [user.id]
  );
  if (!rows.length) return res.status(401).json({ message: 'User not found.' });
  const freshUser = rows[0];

  let stores = [];
  let storePerms = {};
  let canManageProducts = false;
  let canViewOrdersCustomers = false;

  if (freshUser.role !== 'admin') {
    if (freshUser.role === 'manager') {
      stores = await getUserStores(freshUser.id);
    } else if (freshUser.role === 'sales') {
      [storePerms, canManageProducts, canViewOrdersCustomers] = await Promise.all([
        getStorePermissions(freshUser.id),
        getCanManageProducts(freshUser.id),
        getCanViewOrdersCustomers(freshUser.id),
      ]);
      stores = Object.keys(storePerms).map(Number);
    } else {
      stores = await getUserStores(freshUser.id);
    }
  }

  return res.status(200).json({
    user: {
      ...freshUser,
      stores,
      storePerms,
      canManageProducts,
      canViewOrdersCustomers,
    }
  });
}
