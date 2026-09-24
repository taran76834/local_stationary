import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { sendOrderCompletedEmail } from '@/lib/email';
import { getCanViewOrdersCustomers } from '@/lib/userMeta';

export default async function handler(req, res) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  // Sales users need the "View Orders & Website Customers" toggle enabled
  if (user.role === 'sales') {
    const allowed = await getCanViewOrdersCustomers(user.id);
    if (!allowed) return res.status(403).json({ message: 'Access denied.' });
  }

  const { id } = req.query;
  const orderId = parseInt(id, 10);
  if (!orderId) {
    return res.status(400).json({ message: 'Invalid order ID.' });
  }

  // GET single order with line items & customer profile
  if (req.method === 'GET') {
    try {
      const orders = await query('SELECT * FROM fr_orders WHERE id = ? LIMIT 1', [orderId]);
      if (!orders.length) {
        return res.status(404).json({ message: 'Order not found.' });
      }
      const order = orders[0];

      // Get line items
      const items = await query(
        `SELECT i.*, p.image AS product_image
         FROM fr_order_items i
         LEFT JOIN products p ON i.product_id = p.id
         WHERE i.order_id = ?
         ORDER BY i.id ASC`,
        [orderId]
      );

      // Get customer profile if linked
      let customer = null;
      if (order.customer_id) {
        const custs = await query(
          'SELECT id, name, email, phone, created_at FROM fr_customers WHERE id = ? LIMIT 1',
          [order.customer_id]
        );
        if (custs.length) customer = custs[0];
      }

      return res.status(200).json({
        ...order,
        items,
        customer,
      });
    } catch (err) {
      console.error('Error fetching order detail:', err);
      return res.status(500).json({ message: 'Server error fetching order detail.' });
    }
  }

  // PUT / PATCH update order status, address, notes, payment info
  if (req.method === 'PUT' || req.method === 'PATCH') {
    try {
      // Snapshot current status before applying changes
      const [currentOrder] = await query(
        'SELECT status, billing_email, billing_first_name, billing_last_name, billing_address_1, billing_address_2, billing_city, billing_state, billing_postcode, billing_phone, payment_method, subtotal, shipping_fee, total_amount, order_number, created_at FROM fr_orders WHERE id = ? LIMIT 1',
        [orderId]
      );
      if (!currentOrder) {
        return res.status(404).json({ message: 'Order not found.' });
      }

      const allowedFields = [
        'status', 'payment_status', 'payment_method', 'order_notes',
        'billing_first_name', 'billing_last_name', 'billing_country',
        'billing_address_1', 'billing_address_2', 'billing_city',
        'billing_state', 'billing_postcode', 'billing_phone', 'billing_email',
        'ship_to_different_address', 'shipping_first_name', 'shipping_last_name',
        'shipping_country', 'shipping_address_1', 'shipping_address_2',
        'shipping_city', 'shipping_state', 'shipping_postcode',
        'shipping_phone', 'shipping_email',
        'shipping_fee', 'subtotal', 'total_amount',
        'razorpay_order_id', 'razorpay_payment_id'
      ];

      const updates = [];
      const params = [];

      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updates.push(`${field} = ?`);
          params.push(req.body[field]);
        }
      }

      if (updates.length === 0) {
        return res.status(400).json({ message: 'No fields provided for update.' });
      }

      params.push(orderId);
      await query(
        `UPDATE fr_orders SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
        params
      );

      const updated = await query('SELECT * FROM fr_orders WHERE id = ? LIMIT 1', [orderId]);

      // Fetch updated items
      const items = await query(
        `SELECT i.*, p.image AS product_image
         FROM fr_order_items i
         LEFT JOIN products p ON i.product_id = p.id
         WHERE i.order_id = ?
         ORDER BY i.id ASC`,
        [orderId]
      );

      // Send order completed email when status transitions to "completed"
      const newStatus = req.body.status;
      if (newStatus === 'completed' && currentOrder.status !== 'completed') {
        const order = updated[0];
        const emailData = {
          orderNumber: order.order_number,
          billing: {
            firstName:  order.billing_first_name  || '',
            lastName:   order.billing_last_name   || '',
            address1:   order.billing_address_1   || '',
            address2:   order.billing_address_2   || '',
            city:       order.billing_city        || '',
            state:      order.billing_state       || '',
            postcode:   order.billing_postcode    || '',
            phone:      order.billing_phone       || '',
            email:      order.billing_email       || '',
          },
          items: items.map((item) => ({
            productName: item.product_name || '',
            flavor:      item.flavor       || '',
            unitDisplay: item.unit_display || '',
            price:       parseFloat(item.price)    || 0,
            quantity:    parseInt(item.quantity, 10) || 0,
            subtotal:    parseFloat(item.subtotal)  || 0,
          })),
          subtotal:      parseFloat(order.subtotal)      || 0,
          shippingFee:   parseFloat(order.shipping_fee)  || 0,
          totalAmount:   parseFloat(order.total_amount)  || 0,
          paymentMethod: order.payment_method || '',
          createdAt:     order.created_at,
        };

        // Fire-and-forget — does not block the response
        sendOrderCompletedEmail(emailData).catch((err) =>
          console.error('sendOrderCompletedEmail error:', err?.message || err)
        );
      }

      return res.status(200).json({
        ...updated[0],
        items
      });
    } catch (err) {
      console.error('Error updating order:', err);
      return res.status(500).json({ message: 'Server error updating order.' });
    }
  }

  // DELETE order — disabled as per policy
  if (req.method === 'DELETE') {
    return res.status(405).json({ message: 'Order deletion is disabled.' });
  }

  return res.status(405).end();
}
