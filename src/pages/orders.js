import Layout from '@/components/Layout';
import { useEffect, useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { useRole } from '@/hooks/useRole';
import Pagination from '@/components/Pagination';
import TableLoader from '@/components/TableLoader';
import { IconRefresh, IconEye, IconSettings, IconShoppingBag, IconSave, IconUser, IconTruck, IconCreditCard } from '@/components/Icons';

const PAGE_SIZE = 10;

function formatISTDateTime(dateStr) {
  if (!dateStr) return '—';
  let s = String(dateStr);
  if (!s.endsWith('Z') && !s.includes('+') && s.includes('T')) {
    s += 'Z';
  } else if (!s.includes('Z') && !s.includes('+') && s.includes(' ')) {
    s = s.replace(' ', 'T') + 'Z';
  }
  const d = new Date(s);
  if (isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}


export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [page, setPage] = useState(1);

  // Detail Modal
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  // Status editing in modal
  const [editStatus, setEditStatus] = useState('pending');
  const [editPaymentStatus, setEditPaymentStatus] = useState('pending');
  const [editNotes, setEditNotes] = useState('');
  const [updating, setUpdating] = useState(false);

  const { isAdmin } = useRole();

  async function loadOrders() {
    setLoading(true);
    try {
      const res = await fetch('/api/orders');
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load orders.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();
  }, []);

  async function openOrderDetail(orderId) {
    setDetailLoading(true);
    setModalOpen(true);
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load order details.');
      setSelectedOrder(data);
      setEditStatus(data.status || 'pending');
      setEditPaymentStatus(data.payment_status || 'pending');
      setEditNotes(data.order_notes || '');
    } catch (err) {
      toast.error(err.message);
      setModalOpen(false);
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleUpdateStatus(e) {
    e.preventDefault();
    if (!selectedOrder) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/orders/${selectedOrder.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: editStatus,
          payment_status: editPaymentStatus,
          order_notes: editNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success('Order status updated successfully.');
      setSelectedOrder(prev => ({
        ...prev,
        status: editStatus,
        payment_status: editPaymentStatus,
        order_notes: editNotes,
      }));
      loadOrders();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUpdating(false);
    }
  }

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const matchSearch =
        search === '' ||
        (o.order_number || '').toLowerCase().includes(search.toLowerCase()) ||
        (o.billing_first_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (o.billing_last_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (o.billing_email || '').toLowerCase().includes(search.toLowerCase()) ||
        (o.billing_phone || '').includes(search);

      const matchStatus = statusFilter === 'all' || o.status === statusFilter;
      const matchPayment = paymentFilter === 'all' || o.payment_status === paymentFilter;

      return matchSearch && matchStatus && matchPayment;
    });
  }, [orders, search, statusFilter, paymentFilter]);

  const pagedOrders = useMemo(() => {
    return filteredOrders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [filteredOrders, page]);

  // Statistics
  // Helper Badge Renderers
  function renderStatusBadge(status) {
    const s = (status || 'pending').toLowerCase();
    let bg = '#fef3c7', color = '#d97706', label = 'Pending';
    if (s === 'processing') { bg = '#e0f2fe'; color = '#0284c7'; label = 'Processing'; }
    if (s === 'completed') { bg = '#dcfce7'; color = '#16a34a'; label = 'Completed'; }
    if (s === 'cancelled') { bg = '#fee2e2'; color = '#dc2626'; label = 'Cancelled'; }

    return (
      <span style={{
        padding: '3px 9px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
        backgroundColor: bg, color: color, display: 'inline-block', textTransform: 'capitalize'
      }}>
        {label}
      </span>
    );
  }

  function renderPaymentBadge(status) {
    const s = (status || 'pending').toLowerCase();
    let bg = '#fff7ed', color = '#ea580c', label = 'Pending';
    if (s === 'paid') { bg = '#dcfce7'; color = '#15803d'; label = 'Paid'; }
    if (s === 'failed') { bg = '#fee2e2'; color = '#b91c1c'; label = 'Failed'; }

    return (
      <span style={{
        padding: '2px 7px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
        backgroundColor: bg, color: color, display: 'inline-block', textTransform: 'capitalize'
      }}>
        {label}
      </span>
    );
  }

  return (
    <Layout title="Orders" subtitle="Manage e-commerce orders placed on your website">

      {/* Main Table Card */}
      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div className="card-title">Orders ({filteredOrders.length})</div>
            <div className="card-sub">View and process orders from website customers</div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={loadOrders} title="Refresh" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <IconRefresh size={14} /> Refresh List
          </button>
        </div>

        {/* Filter Bar */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', padding: '12px 16px', background: 'var(--bg-card-subtle, rgba(0,0,0,0.02))', borderBottom: '1px solid var(--border)' }}>
          <div style={{ flex: 1, minWidth: '220px' }}>
            <input
              type="text"
              placeholder="Search by Order #, Name, Email or Phone…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-base)' }}
            />
          </div>
          <div style={{ minWidth: '150px' }}>
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-base)' }}
            >
              <option value="all">All Order Statuses</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div style={{ minWidth: '150px' }}>
            <select
              value={paymentFilter}
              onChange={e => { setPaymentFilter(e.target.value); setPage(1); }}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-base)' }}
            >
              <option value="all">All Payment Statuses</option>
              <option value="pending">Pending Payment</option>
              <option value="paid">Paid</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>

        {/* Orders Table */}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Order #</th>
                <th>Customer Name</th>
                <th>Email & Phone</th>
                <th>Items</th>
                <th>Total Amount</th>
                <th>Payment</th>
                <th>Order Status</th>
                <th>Date</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableLoader cols={10} />
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={10}>
                    <div className="empty-state" style={{ padding: '40px 20px', textAlign: 'center' }}>
                      <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'center' }}>
                        <IconShoppingBag size={36} color="var(--text-muted)" />
                      </div>
                      <p style={{ fontWeight: 600, margin: 0, color: 'var(--text-base)' }}>No orders found.</p>
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        {search || statusFilter !== 'all' || paymentFilter !== 'all'
                          ? 'Try adjusting your search or filters.'
                          : 'Orders placed on the website will appear here automatically.'}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                pagedOrders.map((o, index) => (
                  <tr key={o.id}>
                    <td style={{ color: '#94a3b8', fontSize: '12px' }}>
                      {(page - 1) * PAGE_SIZE + index + 1}
                    </td>
                    <td>
                      <Link
                        href={`/orders/${o.id}`}
                        style={{
                          fontWeight: 700,
                          fontSize: '13px',
                          color: '#6366f1',
                          textDecoration: 'underline'
                        }}
                      >
                        {o.order_number}
                      </Link>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--text-base)' }}>
                        {o.billing_first_name} {o.billing_last_name}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '12.5px', color: 'var(--text-base)' }}>{o.billing_email}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Ph: {o.billing_phone}</div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, fontSize: '13px' }}>{o.item_count || 1} items</span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-base)' }}>
                        ₹{parseFloat(o.total_amount).toFixed(2)}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: 'var(--text-muted)' }}>
                        </span>
                        {renderPaymentBadge(o.payment_status)}
                      </div>
                    </td>
                    <td>
                      {renderStatusBadge(o.status)}
                    </td>
                    <td style={{ fontSize: '12px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                      {formatISTDateTime(o.created_at)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <Link
                          href={`/orders/${o.id}`}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '4px 8px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          <IconEye size={13} /> View Details
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination page={page} total={filteredOrders.length} pageSize={PAGE_SIZE} onChange={p => setPage(p)} />
      </div>

      {/* Order Detail Modal */}
      {modalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)',
          zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            background: 'var(--bg-card, #fff)', borderRadius: '12px',
            maxWidth: '900px', width: '100%', maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)', border: '1px solid var(--border)'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 24px', borderBottom: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', sticky: 'top', background: 'var(--bg-card)'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-base)' }}>
                  Order Details #{selectedOrder?.order_number || '...'}
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Placed on {selectedOrder ? formatISTDateTime(selectedOrder.created_at) : ''}
                </span>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            {detailLoading || !selectedOrder ? (
              <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
                Loading order details…
              </div>
            ) : (
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

                {/* Section 1: Order Status Update Controls */}
                <form onSubmit={handleUpdateStatus} style={{
                  background: 'var(--bg-card-subtle, #f8fafc)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '14px', marginBottom: '12px', color: 'var(--text-base)' }}>
                    <IconSettings size={16} color="#6366f1" /> Manage Order Status
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                        Order Status
                      </label>
                      <select
                        value={editStatus}
                        onChange={e => setEditStatus(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-base)' }}
                      >
                        <option value="pending">Pending</option>
                        <option value="processing">Processing</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                        Payment Status
                      </label>
                      <select
                        value={editPaymentStatus}
                        onChange={e => setEditPaymentStatus(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-base)' }}
                      >
                        <option value="pending">Pending</option>
                        <option value="paid">Paid</option>
                        <option value="failed">Failed</option>
                      </select>
                    </div>

                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                        Admin Order Notes
                      </label>
                      <textarea
                        rows={2}
                        value={editNotes}
                        onChange={e => setEditNotes(e.target.value)}
                        placeholder="Add notes about shipping, tracking info, or status updates…"
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-base)' }}
                      />
                    </div>
                  </div>
                  <div style={{ marginTop: '12px', textAlign: 'right' }}>
                    <button type="submit" className="btn btn-primary btn-sm" disabled={updating} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <IconSave size={14} /> {updating ? 'Updating...' : 'Save Status Changes'}
                    </button>
                  </div>
                </form>

                {/* Section 2: Ordered Items Table (Placed directly after Order Status) */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '14px', marginBottom: '8px', color: 'var(--text-base)' }}>
                    <IconShoppingBag size={16} color="#6366f1" /> Order Items ({selectedOrder.items?.length || 0})
                  </div>
                  <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', fontSize: '13px' }}>
                      <thead style={{ background: 'var(--bg-card-subtle, #f8fafc)' }}>
                        <tr>
                          <th style={{ padding: '8px 12px', textAlign: 'left' }}>Product</th>
                          <th style={{ padding: '8px 12px', textAlign: 'left' }}>Variant / Flavor / Unit</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right' }}>Price</th>
                          <th style={{ padding: '8px 12px', textAlign: 'center' }}>Qty</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right' }}>Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedOrder.items || []).map((item, idx) => (
                          <tr key={item.id || idx} style={{ borderTop: '1px solid var(--border)' }}>
                            <td style={{ padding: '10px 12px' }}>
                              <div style={{ fontWeight: 600, color: 'var(--text-base)' }}>{item.product_name}</div>
                            </td>
                            <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
                              {[item.flavor, item.unit_display].filter(Boolean).join(' • ') || 'Standard'}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                              ₹{parseFloat(item.price).toFixed(2)}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600 }}>
                              {item.quantity}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>
                              ₹{parseFloat(item.subtotal).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Section 3: Addresses & Contact Info */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>

                  {/* Billing Card */}
                  <div style={{ padding: '16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '14px', marginBottom: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '6px', color: 'var(--text-base)' }}>
                      <IconUser size={16} color="#6366f1" /> Billing Details
                    </div>
                    <div style={{ fontSize: '13px', lineHeight: '1.6', color: 'var(--text-base)' }}>
                      <div><strong>Name:</strong> {selectedOrder.billing_first_name} {selectedOrder.billing_last_name}</div>
                      <div><strong>Email:</strong> {selectedOrder.billing_email}</div>
                      <div><strong>Phone:</strong> {selectedOrder.billing_phone}</div>
                      <div><strong>Address:</strong> {selectedOrder.billing_address_1} {selectedOrder.billing_address_2 || ''}</div>
                      <div><strong>City/State:</strong> {selectedOrder.billing_city}, {selectedOrder.billing_state} - {selectedOrder.billing_postcode}</div>
                      <div><strong>Country:</strong> {selectedOrder.billing_country || 'India'}</div>
                    </div>
                  </div>

                  {/* Shipping Card */}
                  <div style={{ padding: '16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '14px', marginBottom: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '6px', color: 'var(--text-base)' }}>
                      <IconTruck size={16} color="#6366f1" /> Shipping Address
                    </div>
                    {selectedOrder.ship_to_different_address ? (
                      <div style={{ fontSize: '13px', lineHeight: '1.6', color: 'var(--text-base)' }}>
                        <div><strong>Recipient:</strong> {selectedOrder.shipping_first_name} {selectedOrder.shipping_last_name}</div>
                        <div><strong>Address:</strong> {selectedOrder.shipping_address_1} {selectedOrder.shipping_address_2 || ''}</div>
                        <div><strong>City/State:</strong> {selectedOrder.shipping_city}, {selectedOrder.shipping_state} - {selectedOrder.shipping_postcode}</div>
                        <div><strong>Country:</strong> {selectedOrder.shipping_country || 'India'}</div>
                      </div>
                    ) : (
                      <div style={{ fontSize: '13px', color: 'var(--text-muted)', paddingTop: '8px' }}>
                        ✓ Shipping address is identical to Billing address.
                      </div>
                    )}
                  </div>
                </div>

                {/* Section 4: Payment Details */}
                {(selectedOrder.razorpay_order_id || selectedOrder.razorpay_payment_id) && (
                  <div style={{ padding: '12px 16px', borderRadius: '8px', background: 'var(--bg-card-subtle, #f8fafc)', border: '1px solid var(--border)', fontSize: '12.5px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-base)' }}>
                      <IconCreditCard size={16} color="#6366f1" /> Payment Details
                    </div>
                    <div>Order ID: <code>{selectedOrder.razorpay_order_id || 'N/A'}</code> | Transaction ID: <code>{selectedOrder.razorpay_payment_id || 'N/A'}</code></div>
                  </div>
                )}

                {/* Section 3: Ordered Items Table */}
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '8px', color: 'var(--text-base)' }}>
                    📦 Order Items ({selectedOrder.items?.length || 0})
                  </div>
                  <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', fontSize: '13px' }}>
                      <thead style={{ background: 'var(--bg-card-subtle, #f8fafc)' }}>
                        <tr>
                          <th style={{ padding: '8px 12px', textAlign: 'left' }}>Product</th>
                          <th style={{ padding: '8px 12px', textAlign: 'left' }}>Variant / Flavor / Unit</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right' }}>Price</th>
                          <th style={{ padding: '8px 12px', textAlign: 'center' }}>Qty</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right' }}>Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedOrder.items || []).map((item, idx) => (
                          <tr key={item.id || idx} style={{ borderTop: '1px solid var(--border)' }}>
                            <td style={{ padding: '10px 12px' }}>
                              <div style={{ fontWeight: 600, color: 'var(--text-base)' }}>{item.product_name}</div>
                            </td>
                            <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
                              {[item.flavor, item.unit_display].filter(Boolean).join(' • ') || 'Standard'}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                              ₹{parseFloat(item.price).toFixed(2)}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600 }}>
                              {item.quantity}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>
                              ₹{parseFloat(item.subtotal).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Section 4: Totals Summary */}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{ width: '280px', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-card-subtle, #f8fafc)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                      <span>Subtotal:</span>
                      <span>₹{parseFloat(selectedOrder.subtotal).toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                      <span>Shipping Fee:</span>
                      <span>₹{parseFloat(selectedOrder.shipping_fee || 0).toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 700, paddingTop: '6px', borderTop: '1px solid var(--border)', color: 'var(--text-base)' }}>
                      <span>Total Amount:</span>
                      <span style={{ color: '#16a34a' }}>₹{parseFloat(selectedOrder.total_amount).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* Modal Footer */}
            <div style={{ padding: '12px 24px', borderTop: '1px solid var(--border)', textAlign: 'right' }}>
              <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>
                Close Window
              </button>
            </div>

          </div>
        </div>
      )}

    </Layout>
  );
}
