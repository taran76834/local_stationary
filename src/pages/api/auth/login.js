import bcrypt from 'bcryptjs';
import { serialize } from 'cookie';
import { query } from '@/lib/db';
import { signToken } from '@/lib/auth';
import { getUserStores, getStorePermissions } from '@/lib/userMeta';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    const rows = await query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
    const user = rows[0];

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    if (!['admin', 'manager', 'store_minus', 'store_plus', 'sales'].includes(user.role)) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    // Load store list and per-store permissions for non-admin users
    let stores = [];
    let storePerms = {};
    if (user.role !== 'admin') {
      if (user.role === 'manager') {
        // Manager: simple store list from assigned_stores
        stores = await getUserStores(user.id);
      } else if (user.role === 'sales') {
        // Sales: per-store Plus/Minus permissions
        storePerms = await getStorePermissions(user.id);
        stores = Object.keys(storePerms).map(Number);
      } else {
        stores = await getUserStores(user.id);
      }
    }

    const token = signToken({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      token_version: user.token_version ?? 1,
    });

    res.setHeader('Set-Cookie', serialize('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 8, // 8 hours
      path: '/',
    }));

    return res.status(200).json({
      message: 'Login successful.',
      user: { id: user.id, name: user.name, email: user.email, role: user.role, stores, storePerms }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error.' });
  }
}
