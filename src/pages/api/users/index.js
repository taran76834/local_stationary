import { query } from '@/lib/db';
import { requireAdminOnly } from '@/lib/auth';
import { getUsersStoresMap, getUsersStorePermsMap, setUserStores, setStorePermissions, getCanManageProducts, setCanManageProducts, getCanViewOrdersCustomers, setCanViewOrdersCustomers } from '@/lib/userMeta';
import bcrypt from 'bcryptjs';

const VALID_ROLES = ['admin', 'manager', 'store_minus', 'store_plus', 'sales'];

export default async function handler(req, res) {
  const user = await requireAdminOnly(req, res);
  if (!user) return;

  if (req.method === 'GET') {
    try {
      const rows = await query(
        'SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC'
      );

      const userIds = rows.map(u => u.id);
      const [storesMap, permsMap, ...salesMetaArr] = await Promise.all([
        getUsersStoresMap(userIds),
        getUsersStorePermsMap(userIds),
        ...userIds.map(id => getCanManageProducts(id)),
        ...userIds.map(id => getCanViewOrdersCustomers(id)),
      ]);
      // salesMetaArr layout: [cmp_0, cmp_1, ..., cmp_n, cvc_0, cvc_1, ..., cvc_n]
      const half = userIds.length;
      const canManageArr         = salesMetaArr.slice(0, half);
      const canViewOrdersArr     = salesMetaArr.slice(half);

      const usersWithStores = rows.map((u, idx) => ({
        ...u,
        stores:                   storesMap[u.id] || [],
        storePerms:               permsMap[u.id]  || {},
        canManageProducts:        canManageArr[idx]     || false,
        canViewOrdersCustomers:   canViewOrdersArr[idx] || false,
      }));

      return res.status(200).json(usersWithStores);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: 'Server error.' });
    }
  }

  if (req.method === 'POST') {
    const { name, email, password, role, stores, storePerms, canManageProducts, canViewOrdersCustomers } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ message: 'Name, email and password are required.' });
    if (password.length < 6)
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    if (!VALID_ROLES.includes(role))
      return res.status(400).json({ message: 'Invalid role.' });

    // Manager: requires stores array
    if (role === 'manager' && (!Array.isArray(stores) || stores.length === 0))
      return res.status(400).json({ message: 'Assign at least one store for manager users.' });
    
    // Sales: requires storePerms object
    if (role === 'sales' && (!storePerms || Object.keys(storePerms).length === 0))
      return res.status(400).json({ message: 'Assign at least one store with permission for sales users.' });

    try {
      const hash   = await bcrypt.hash(password, 10);
      const result = await query(
        'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
        [name, email, hash, role]
      );
      const userId = result.insertId;

      if (role === 'manager') {
        // Manager uses stores array
        await setUserStores(userId, Array.isArray(stores) ? stores : []);
      } else if (role === 'sales') {
        // Sales uses storePerms object
        await setStorePermissions(userId, storePerms || {});
        await setCanManageProducts(userId, !!canManageProducts);
        await setCanViewOrdersCustomers(userId, !!canViewOrdersCustomers);
      } else if (role !== 'admin' && Array.isArray(stores)) {
        // Legacy roles use stores array
        await setUserStores(userId, stores);
      } else {
        await setUserStores(userId, []);
      }

      return res.status(201).json({ id: userId, name, email, role });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY')
        return res.status(409).json({ message: 'Email already exists.' });
      console.error(err);
      return res.status(500).json({ message: 'Server error.' });
    }
  }

  return res.status(405).end();
}
