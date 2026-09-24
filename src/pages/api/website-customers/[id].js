import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { getCanViewOrdersCustomers } from '@/lib/userMeta';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  if (user.role === 'sales') {
    const allowed = await getCanViewOrdersCustomers(user.id);
    if (!allowed) return res.status(403).json({ message: 'Access denied.' });
  }

  const { id } = req.query;
  const customerId = parseInt(id, 10);
  if (!customerId) {
    return res.status(400).json({ message: 'Invalid customer ID.' });
  }

  // GET single customer with order history
  if (req.method === 'GET') {
    try {
      const customers = await query(
        'SELECT id, name, email, phone, created_at, updated_at FROM fr_customers WHERE id = ? LIMIT 1',
        [customerId]
      );
      if (!customers.length) {
        return res.status(404).json({ message: 'Customer not found.' });
      }
      const customer = customers[0];

      // Get customer orders
      const orders = await query(
        `SELECT o.*, 
          COALESCE(i.item_count, 0) AS item_count 
         FROM fr_orders o
         LEFT JOIN (
           SELECT order_id, COUNT(*) AS item_count
           FROM fr_order_items
           GROUP BY order_id
         ) i ON o.id = i.order_id
         WHERE o.customer_id = ? OR o.billing_email = ?
         ORDER BY o.id DESC`,
        [customerId, customer.email]
      );

      // Aggregates
      const totalSpent = orders.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);

      return res.status(200).json({
        ...customer,
        orders,
        total_orders: orders.length,
        total_spent: totalSpent.toFixed(2),
      });
    } catch (err) {
      console.error('Error fetching website customer detail:', err);
      return res.status(500).json({ message: 'Server error fetching customer detail.' });
    }
  }

  // PUT update customer
  if (req.method === 'PUT' || req.method === 'PATCH') {
    try {
      const { name, email, phone, password } = req.body;
      const updates = [];
      const params = [];

      if (name !== undefined && name.trim()) {
        updates.push('name = ?');
        params.push(name.trim());
      }
      if (email !== undefined && email.trim()) {
        // Check duplicate email
        const dup = await query(
          'SELECT id FROM fr_customers WHERE email = ? AND id != ? LIMIT 1',
          [email.trim().toLowerCase(), customerId]
        );
        if (dup.length) {
          return res.status(400).json({ message: 'Email is already used by another customer.' });
        }
        updates.push('email = ?');
        params.push(email.trim().toLowerCase());
      }
      if (phone !== undefined) {
        updates.push('phone = ?');
        params.push(phone?.trim() || null);
      }
      if (password && password.trim()) {
        const hashedPassword = await bcrypt.hash(password.trim(), 10);
        updates.push('password = ?');
        params.push(hashedPassword);
      }

      if (!updates.length) {
        return res.status(400).json({ message: 'No valid fields provided for update.' });
      }

      params.push(customerId);
      await query(
        `UPDATE fr_customers SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
        params
      );

      const updated = await query(
        'SELECT id, name, email, phone, created_at, updated_at FROM fr_customers WHERE id = ? LIMIT 1',
        [customerId]
      );
      return res.status(200).json(updated[0]);
    } catch (err) {
      console.error('Error updating website customer:', err);
      return res.status(500).json({ message: 'Server error updating customer.' });
    }
  }

  // DELETE customer
  if (req.method === 'DELETE') {
    try {
      // Unlink or keep customer_id in fr_orders as NULL
      await query('UPDATE fr_orders SET customer_id = NULL WHERE customer_id = ?', [customerId]);
      await query('DELETE FROM fr_favorites WHERE customer_id = ?', [customerId]);
      await query('DELETE FROM fr_customers WHERE id = ?', [customerId]);
      return res.status(200).json({ message: 'Customer deleted successfully.' });
    } catch (err) {
      console.error('Error deleting website customer:', err);
      return res.status(500).json({ message: 'Server error deleting customer.' });
    }
  }

  return res.status(405).end();
}
