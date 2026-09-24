import { query } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  const authUser = await getAuthUser(req);
  if (!authUser) return res.status(401).json({ message: 'Unauthorized.' });

  if (req.method === 'PUT') {
    const { name, email, current_password, new_password } = req.body;
    if (!name || !email)
      return res.status(400).json({ message: 'Name and email are required.' });

    try {
      // Fetch current user from DB
      const rows = await query('SELECT * FROM users WHERE id = ? LIMIT 1', [authUser.id]);
      const dbUser = rows[0];
      if (!dbUser) return res.status(404).json({ message: 'User not found.' });

      // If changing password, verify current password first
      if (new_password) {
        if (!current_password)
          return res.status(400).json({ message: 'Current password is required to set a new password.' });
        if (new_password.length < 6)
          return res.status(400).json({ message: 'New password must be at least 6 characters.' });

        const valid = await bcrypt.compare(current_password, dbUser.password);
        if (!valid)
          return res.status(400).json({ message: 'Current password is incorrect.' });

        const hash = await bcrypt.hash(new_password, 10);
        // Increment token_version to invalidate all existing sessions for this user
        await query('UPDATE users SET name=?, email=?, password=?, token_version = token_version + 1 WHERE id=?', [name, email, hash, authUser.id]);
      } else {
        await query('UPDATE users SET name=?, email=? WHERE id=?', [name, email, authUser.id]);
      }

      return res.status(200).json({ message: 'Profile updated successfully.' });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY')
        return res.status(409).json({ message: 'Email already in use.' });
      console.error(err);
      return res.status(500).json({ message: 'Server error.' });
    }
  }

  return res.status(405).end();
}
