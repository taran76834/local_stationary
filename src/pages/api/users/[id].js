import { query } from '@/lib/db';
import { requireAdminOnly } from '@/lib/auth';
import { getUserStores, getStorePermissions, setUserStores, setStorePermissions, getCanManageProducts, setCanManageProducts, getCanViewOrdersCustomers, setCanViewOrdersCustomers } from '@/lib/userMeta';
import bcrypt from 'bcryptjs';

const VALID_ROLES = ['admin', 'manager', 'store_minus', 'store_plus', 'sales'];

export default async function handler(req, res) {
  const user = await requireAdminOnly(req, res);
  if (!user) return;

  const { id } = req.query;

  if (req.method === 'GET') {
    try {
      const rows = await query('SELECT id, name, email, role, created_at FROM users WHERE id = ?', [id]);
      if (!rows.length) return res.status(404).json({ message: 'User not found.' });
      const targetUser = rows[0];

      const [stores, storePerms, canManageProducts, canViewOrdersCustomers] = await Promise.all([
        getUserStores(id),
        getStorePermissions(id),
        getCanManageProducts(id),
        getCanViewOrdersCustomers(id),
      ]);

      return res.status(200).json({ ...targetUser, stores, storePerms, canManageProducts, canViewOrdersCustomers });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: 'Server error.' });
    }
  }

  if (req.method === 'PUT') {
    const { name, email, password, role, stores, storePerms, canManageProducts, canViewOrdersCustomers } = req.body;

    if (!name || !email)
      return res.status(400).json({ message: 'Name and email are required.' });
    if (role && !VALID_ROLES.includes(role))
      return res.status(400).json({ message: 'Invalid role.' });

    // Manager: requires stores array
    if (role === 'manager' && (!Array.isArray(stores) || stores.length === 0))
      return res.status(400).json({ message: 'Assign at least one store for manager users.' });
    
    // Sales: requires storePerms object
    if (role === 'sales' && (!storePerms || Object.keys(storePerms).length === 0))
      return res.status(400).json({ message: 'Assign at least one store with permission for sales users.' });

    try {
      // Fetch current role to detect a role change
      const currentRows = await query('SELECT role FROM users WHERE id = ? LIMIT 1', [id]);
      const currentRole = currentRows[0]?.role;
      const roleChanged = role && role !== currentRole;

      if (password) {
        if (password.length < 6)
          return res.status(400).json({ message: 'Password must be at least 6 characters.' });
        const hash = await bcrypt.hash(password, 10);
        // Always bump token_version on password change; also bump on role change
        await query(
          'UPDATE users SET name=?, email=?, password=?, role=?, token_version = token_version + 1 WHERE id=?',
          [name, email, hash, role || 'admin', id]
        );
      } else {
        // Bump token_version on role change so the old JWT is invalidated immediately
        if (roleChanged) {
          await query(
            'UPDATE users SET name=?, email=?, role=?, token_version = token_version + 1 WHERE id=?',
            [name, email, role, id]
          );
        } else {
          await query(
            'UPDATE users SET name=?, email=?, role=? WHERE id=?',
            [name, email, role || 'admin', id]
          );
        }
      }

      // Always clear both meta keys first to prevent stale data conflicts
      // when switching between roles (e.g. sales → manager or manager → sales)
      await setUserStores(id, []);
      await setStorePermissions(id, {});

      // Then save only what the new role needs
      if (role === 'manager') {
        await setUserStores(id, Array.isArray(stores) ? stores : []);
      } else if (role === 'sales') {
        await setStorePermissions(id, storePerms || {});
        await setCanManageProducts(id, !!canManageProducts);
        await setCanViewOrdersCustomers(id, !!canViewOrdersCustomers);
      } else if (role !== 'admin' && Array.isArray(stores)) {
        // Legacy store_minus / store_plus roles
        await setUserStores(id, stores);
      }
      // admin: both already cleared above — no store assignment needed

      return res.status(200).json({ message: 'User updated.' });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY')
        return res.status(409).json({ message: 'Email already in use.' });
      console.error(err);
      return res.status(500).json({ message: 'Server error.' });
    }
  }

  if (req.method === 'DELETE') {
    if (String(id) === String(user.id))
      return res.status(400).json({ message: 'You cannot delete your own account.' });

    try {
      await query('DELETE FROM users WHERE id = ?', [id]);
      return res.status(200).json({ message: 'User deleted.' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: 'Server error.' });
    }
  }

  return res.status(405).end();
}
