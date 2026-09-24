import Layout from '@/components/Layout';
import { useRouter } from 'next/router';
import { useEffect, useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { Country, State, City } from 'country-state-city';
import {
  IconArrowLeft, IconPrinter, IconShoppingBag,
  IconMapPin, IconCreditCard, IconEdit, IconSave,
  IconTruck, IconUser, IconRefresh,
} from '@/components/Icons';

// ─── helpers ────────────────────────────────────────────────────────────────

function formatISTDateTime(dateStr) {
  if (!dateStr) return '—';
  let s = String(dateStr);
  if (!s.endsWith('Z') && !s.includes('+') && s.includes('T')) s += 'Z';
  else if (!s.includes('Z') && !s.includes('+') && s.includes(' ')) s = s.replace(' ', 'T') + 'Z';
  const d = new Date(s);
  if (isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

const ORDER_STATUSES = [
  { value: 'pending',    label: 'Pending',    color: '#d97706', bg: '#fef3c7', dot: '#f59e0b' },
  { value: 'processing', label: 'Processing', color: '#0284c7', bg: '#e0f2fe', dot: '#38bdf8' },
  { value: 'completed',  label: 'Completed',  color: '#16a34a', bg: '#dcfce7', dot: '#22c55e' },
  { value: 'cancelled',  label: 'Cancelled',  color: '#dc2626', bg: '#fee2e2', dot: '#f87171' },
];

const PAYMENT_STATUSES = [
  { value: 'pending', label: 'Pending', color: '#ea580c', bg: '#fff7ed' },
  { value: 'paid',    label: 'Paid',    color: '#15803d', bg: '#dcfce7' },
  { value: 'failed',  label: 'Failed',  color: '#b91c1c', bg: '#fee2e2' },
];

function StatusBadge({ value, map }) {
  const s = map.find(x => x.value === (value || '').toLowerCase()) || map[0];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '4px 11px', borderRadius: '20px', fontSize: '12px',
      fontWeight: 700, backgroundColor: s.bg, color: s.color,
    }}>
      {s.dot && (
        <span style={{
          width: 7, height: 7, borderRadius: '50%',
          backgroundColor: s.dot, display: 'inline-block',
        }} />
      )}
      {s.label}
    </span>
  );
}

// ─── StatusSelect ────────────────────────────────────────────────────────────

function StatusSelect({ value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const current = options.find(o => o.value === value) || options[0];

  return (
    <div style={{ position: 'relative' }}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%',
          padding: '9px 12px',
          borderRadius: 9,
          border: `1.5px solid ${current.dot || current.color}`,
          background: current.bg,
          color: current.color,
          fontWeight: 700,
          fontSize: 13,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          gap: 8,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 9, height: 9, borderRadius: '50%',
            backgroundColor: current.dot || current.color,
            flexShrink: 0,
          }} />
          {current.label}
        </span>
        {/* chevron */}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}>
          <path d="M2 4l4 4 4-4" stroke={current.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <>
          {/* backdrop to close */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 10 }}
            onClick={() => setOpen(false)}
          />
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
            background: 'var(--bg-card, #fff)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
            zIndex: 20,
            overflow: 'hidden',
          }}>
            {options.map(o => (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false); }}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: 'none',
                  background: value === o.value ? o.bg : 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  textAlign: 'left',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <span style={{
                  width: 9, height: 9, borderRadius: '50%',
                  backgroundColor: o.dot || o.color,
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: 13, fontWeight: value === o.value ? 700 : 500, color: o.color }}>
                  {o.label}
                </span>
                {value === o.value && (
                  <span style={{ marginLeft: 'auto', color: o.color, fontSize: 14, fontWeight: 900 }}>✓</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

export default function OrderDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  const [order, setOrder]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [isEditingAddress, setIsEditingAddress] = useState(false);

  const [status, setStatus]           = useState('pending');
  const [paymentStatus, setPaymentStatus] = useState('pending');
  const [orderNotes, setOrderNotes]   = useState('');

  const [billing, setBilling] = useState({
    billing_first_name: '', billing_last_name: '',
    billing_email: '', billing_phone: '',
    billing_address_1: '', billing_address_2: '',
    billing_city: '', billing_state: '',
    billing_postcode: '', billing_country: 'India',
  });

  const [shipping, setShipping] = useState({
    ship_to_different_address: 0,
    shipping_first_name: '', shipping_last_name: '',
    shipping_email: '', shipping_phone: '',
    shipping_address_1: '', shipping_address_2: '',
    shipping_city: '', shipping_state: '',
    shipping_postcode: '', shipping_country: 'India',
  });

  // All countries list (India prioritized)
  const allCountries = useMemo(() => {
    const list = Country.getAllCountries();
    const india = list.find(c => c.isoCode === 'IN');
    const others = list.filter(c => c.isoCode !== 'IN');
    return india ? [india, ...others] : list;
  }, []);

  // Billing location lookups
  const billingCountryCode = useMemo(() => {
    const found = allCountries.find(c => c.name.toLowerCase() === (billing.billing_country || 'India').toLowerCase()) || allCountries.find(c => c.isoCode === 'IN');
    return found ? found.isoCode : 'IN';
  }, [allCountries, billing.billing_country]);

  const billingStates = useMemo(() => {
    return State.getStatesOfCountry(billingCountryCode) || [];
  }, [billingCountryCode]);

  const billingStateCode = useMemo(() => {
    const found = billingStates.find(s => s.name.toLowerCase() === (billing.billing_state || '').toLowerCase());
    return found ? found.isoCode : '';
  }, [billingStates, billing.billing_state]);

  const billingCities = useMemo(() => {
    if (billingStateCode) {
      return City.getCitiesOfState(billingCountryCode, billingStateCode) || [];
    }
    return City.getCitiesOfCountry(billingCountryCode) || [];
  }, [billingCountryCode, billingStateCode]);

  // Shipping location lookups
  const shippingCountryCode = useMemo(() => {
    const found = allCountries.find(c => c.name.toLowerCase() === (shipping.shipping_country || 'India').toLowerCase()) || allCountries.find(c => c.isoCode === 'IN');
    return found ? found.isoCode : 'IN';
  }, [allCountries, shipping.shipping_country]);

  const shippingStates = useMemo(() => {
    return State.getStatesOfCountry(shippingCountryCode) || [];
  }, [shippingCountryCode]);

  const shippingStateCode = useMemo(() => {
    const found = shippingStates.find(s => s.name.toLowerCase() === (shipping.shipping_state || '').toLowerCase());
    return found ? found.isoCode : '';
  }, [shippingStates, shipping.shipping_state]);

  const shippingCities = useMemo(() => {
    if (shippingStateCode) {
      return City.getCitiesOfState(shippingCountryCode, shippingStateCode) || [];
    }
    return City.getCitiesOfCountry(shippingCountryCode) || [];
  }, [shippingCountryCode, shippingStateCode]);

  async function loadOrder() {
    if (!id) return;
    setLoading(true);
    try {
      const res  = await fetch(`/api/orders/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load order');
      setOrder(data);
      setStatus(data.status || 'pending');
      setPaymentStatus(data.payment_status || 'pending');
      setOrderNotes(data.order_notes || '');
      setBilling({
        billing_first_name: data.billing_first_name || '',
        billing_last_name:  data.billing_last_name  || '',
        billing_email:      data.billing_email      || '',
        billing_phone:      data.billing_phone      || '',
        billing_address_1:  data.billing_address_1  || '',
        billing_address_2:  data.billing_address_2  || '',
        billing_city:       data.billing_city       || '',
        billing_state:      data.billing_state      || '',
        billing_postcode:   data.billing_postcode   || '',
        billing_country:    data.billing_country    || 'India',
      });
      setShipping({
        ship_to_different_address: data.ship_to_different_address ? 1 : 0,
        shipping_first_name: data.shipping_first_name || '',
        shipping_last_name:  data.shipping_last_name  || '',
        shipping_email:      data.shipping_email      || '',
        shipping_phone:      data.shipping_phone      || '',
        shipping_address_1:  data.shipping_address_1  || '',
        shipping_address_2:  data.shipping_address_2  || '',
        shipping_city:       data.shipping_city       || '',
        shipping_state:      data.shipping_state      || '',
        shipping_postcode:   data.shipping_postcode   || '',
        shipping_country:    data.shipping_country    || 'India',
      });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (id) loadOrder(); }, [id]);

  // Quick status change via sidebar button
  async function quickSetStatus(newStatus) {
    if (newStatus === status) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          payment_status: paymentStatus,
          order_notes: orderNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setStatus(newStatus);
      setOrder(prev => ({ ...prev, ...data }));
      toast.success(`Order marked as ${newStatus}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveStatus(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          payment_status: paymentStatus,
          order_notes: orderNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success('Order updated successfully');
      setOrder(prev => ({ ...prev, ...data }));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAddresses(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...billing, ...shipping }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success('Addresses updated');
      setOrder(prev => ({ ...prev, ...data }));
      setIsEditingAddress(false);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  // ── loading / not found ────────────────────────────────────────────────────

  if (loading) {
    return (
      <Layout title="Order Details">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: 'var(--text-muted)', gap: 10 }}>
          <IconRefresh size={20} /> Loading order…
        </div>
      </Layout>
    );
  }

  if (!order) {
    return (
      <Layout title="Order Not Found">
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <h3>Order not found</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>Order #{id} does not exist.</p>
          <Link href="/orders" className="btn btn-primary">Back to Orders</Link>
        </div>
      </Layout>
    );
  }

  const currentStatusMeta = ORDER_STATUSES.find(s => s.value === status) || ORDER_STATUSES[0];

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <Layout title={`Order ${order.order_number}`} subtitle="Order details & management">

      {/* ── top bar ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
        <Link href="/orders" className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <IconArrowLeft size={15} /> Back to Orders
        </Link>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => window.open(`/orders/print/${id}`, '_blank')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <IconPrinter size={15} /> Print
          </button>
        </div>
      </div>

      {/* ── order header card ── */}
      <div style={{
        background: 'var(--bg-card, #fff)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '20px 24px',
        marginBottom: 20,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: 16,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text-base)' }}>
              {order.order_number}
            </h2>
            <StatusBadge value={order.status} map={ORDER_STATUSES} />
            <StatusBadge value={order.payment_status} map={PAYMENT_STATUSES} />
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Placed {formatISTDateTime(order.created_at)}
            {order.customer_id && (
              <Link
                href={`/website-customers?customer=${order.customer_id}`}
                style={{ marginLeft: 10, color: '#6366f1', fontWeight: 600, textDecoration: 'none' }}
              >
                · {order.customer?.name || `${order.billing_first_name} ${order.billing_last_name}`.trim() || `Customer #${order.customer_id}`}
              </Link>
            )}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Total Amount</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#16a34a', letterSpacing: '-0.5px' }}>
            ₹{parseFloat(order.total_amount).toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      {/* ── two-column layout: main + sidebar ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>

        {/* ══ LEFT: main content ══════════════════════════════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Order Items */}
          <div style={{ background: 'var(--bg-card, #fff)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconShoppingBag size={17} color="#6366f1" />
              <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-base)' }}>
                Order Items
              </span>
              <span style={{ marginLeft: 4, fontSize: 12, fontWeight: 700, color: '#6366f1', background: '#ede9fe', borderRadius: 20, padding: '1px 9px' }}>
                {order.items?.length || 0}
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-subtle, #f8fafc)' }}>
                    {['Product', 'Variant / Flavor', 'Unit', 'Price', 'Qty', 'Subtotal'].map(h => (
                      <th key={h} style={{
                        padding: '10px 16px', fontSize: 11, fontWeight: 700,
                        color: 'var(--text-muted)', textTransform: 'uppercase',
                        letterSpacing: '0.5px', textAlign: h === 'Product' || h === 'Variant / Flavor' || h === 'Unit' ? 'left' : 'right',
                        whiteSpace: 'nowrap',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(order.items || []).map((item, idx) => (
                    <tr key={item.id || idx} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {item.product_image && (
                            <img src={item.product_image} alt=""
                              style={{ width: 38, height: 38, objectFit: 'contain', borderRadius: 7, border: '1px solid var(--border)', background: '#fff' }} />
                          )}
                          <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text-base)' }}>
                            {item.product_name}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: 13, color: 'var(--text-muted)' }}>
                        {item.flavor || '—'}
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: 13, color: 'var(--text-muted)' }}>
                        {item.unit_display || 'Standard'}
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: 13, textAlign: 'right', color: 'var(--text-base)' }}>
                        ₹{parseFloat(item.price).toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 700, fontSize: 14 }}>
                        {item.quantity}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 800, fontSize: 14, color: 'var(--text-base)' }}>
                        ₹{parseFloat(item.subtotal).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ width: 260 }}>
                {[
                  { label: 'Items Subtotal', value: `₹${parseFloat(order.subtotal).toLocaleString('en-IN')}`, muted: true },
                  { label: 'Shipping Fee', value: parseFloat(order.shipping_fee || 0) === 0 ? 'FREE' : `₹${parseFloat(order.shipping_fee).toLocaleString('en-IN')}`, green: true },
                ].map(r => (
                  <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
                    <span style={{ color: 'var(--text-muted)' }}>{r.label}</span>
                    <span style={{ fontWeight: 600, color: r.green ? '#16a34a' : 'var(--text-base)' }}>{r.value}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 900, paddingTop: 10, borderTop: '2px solid var(--border)', color: 'var(--text-base)' }}>
                  <span>Total</span>
                  <span style={{ color: '#16a34a' }}>₹{parseFloat(order.total_amount).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Address & Contact */}
          <div style={{ background: 'var(--bg-card, #fff)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <IconMapPin size={17} color="#6366f1" />
                <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-base)' }}>Address & Contact</span>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingAddress(!isEditingAddress)}
                className="btn btn-secondary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
              >
                <IconEdit size={13} /> {isEditingAddress ? 'Cancel' : 'Edit'}
              </button>
            </div>

            {isEditingAddress ? (
              <form onSubmit={handleSaveAddresses} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* Billing fields */}
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-base)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <IconUser size={14} color="#6366f1" /> Billing Details
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                    {[
                      { label: 'First Name', key: 'billing_first_name', required: true },
                      { label: 'Last Name',  key: 'billing_last_name',  required: true },
                      { label: 'Email',      key: 'billing_email',      type: 'email', required: true },
                      { label: 'Phone',      key: 'billing_phone',      required: true },
                    ].map(f => (
                      <div key={f.key}>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4, color: 'var(--text-muted)' }}>{f.label}{f.required ? ' *' : ''}</label>
                        <input
                          type={f.type || 'text'}
                          required={f.required}
                          value={billing[f.key]}
                          onChange={e => setBilling({ ...billing, [f.key]: e.target.value })}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-base)', fontSize: 13, boxSizing: 'border-box' }}
                        />
                      </div>
                    ))}
                    <div style={{ gridColumn: '1/-1' }}>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4, color: 'var(--text-muted)' }}>Address Line 1 *</label>
                      <input required value={billing.billing_address_1} onChange={e => setBilling({ ...billing, billing_address_1: e.target.value })}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-base)', fontSize: 13, boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ gridColumn: '1/-1' }}>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4, color: 'var(--text-muted)' }}>Address Line 2</label>
                      <input value={billing.billing_address_2} onChange={e => setBilling({ ...billing, billing_address_2: e.target.value })}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-base)', fontSize: 13, boxSizing: 'border-box' }} />
                    </div>
                    {/* Country Select */}
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4, color: 'var(--text-muted)' }}>Country *</label>
                      <select
                        value={billing.billing_country || 'India'}
                        onChange={e => setBilling({ ...billing, billing_country: e.target.value, billing_state: '', billing_city: '' })}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-base)', fontSize: 13, boxSizing: 'border-box' }}
                        required
                      >
                        <option value="">— Select Country —</option>
                        {allCountries.map(c => (
                          <option key={c.isoCode} value={c.name}>
                            {c.flag ? `${c.flag} ` : ''}{c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* State Select */}
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4, color: 'var(--text-muted)' }}>State *</label>
                      <select
                        value={billing.billing_state || ''}
                        onChange={e => setBilling({ ...billing, billing_state: e.target.value, billing_city: '' })}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-base)', fontSize: 13, boxSizing: 'border-box' }}
                        required
                      >
                        <option value="">— Select State —</option>
                        {billing.billing_state && !billingStates.some(s => s.name.toLowerCase() === (billing.billing_state || '').toLowerCase()) && (
                          <option value={billing.billing_state}>{billing.billing_state}</option>
                        )}
                        {billingStates.map(s => (
                          <option key={s.isoCode} value={s.name}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* City Select */}
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4, color: 'var(--text-muted)' }}>City *</label>
                      <select
                        value={billing.billing_city || ''}
                        onChange={e => setBilling({ ...billing, billing_city: e.target.value })}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-base)', fontSize: 13, boxSizing: 'border-box' }}
                        required
                      >
                        <option value="">— Select City —</option>
                        {billing.billing_city && !billingCities.some(ci => ci.name.toLowerCase() === (billing.billing_city || '').toLowerCase()) && (
                          <option value={billing.billing_city}>{billing.billing_city}</option>
                        )}
                        {billingCities.map(ci => (
                          <option key={ci.name} value={ci.name}>
                            {ci.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Postcode */}
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4, color: 'var(--text-muted)' }}>Postcode *</label>
                      <input
                        required
                        value={billing.billing_postcode}
                        onChange={e => setBilling({ ...billing, billing_postcode: e.target.value })}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-base)', fontSize: 13, boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Shipping fields */}
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-base)', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><IconTruck size={14} color="#6366f1" /> Shipping Address</span>
                    <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontWeight: 600 }}>
                      <input type="checkbox" checked={shipping.ship_to_different_address === 1}
                        onChange={e => setShipping({ ...shipping, ship_to_different_address: e.target.checked ? 1 : 0 })} />
                      Ship to different address
                    </label>
                  </div>
                  {shipping.ship_to_different_address === 1 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                      {[
                        { label: 'First Name', key: 'shipping_first_name' },
                        { label: 'Last Name',  key: 'shipping_last_name'  },
                        { label: 'Email',      key: 'shipping_email', type: 'email' },
                        { label: 'Phone',      key: 'shipping_phone' },
                      ].map(f => (
                        <div key={f.key}>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4, color: 'var(--text-muted)' }}>{f.label}</label>
                          <input
                            type={f.type || 'text'}
                            value={shipping[f.key]}
                            onChange={e => setShipping({ ...shipping, [f.key]: e.target.value })}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-base)', fontSize: 13, boxSizing: 'border-box' }}
                          />
                        </div>
                      ))}
                      <div style={{ gridColumn: '1/-1' }}>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4, color: 'var(--text-muted)' }}>Address Line 1</label>
                        <input value={shipping.shipping_address_1} onChange={e => setShipping({ ...shipping, shipping_address_1: e.target.value })}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-base)', fontSize: 13, boxSizing: 'border-box' }} />
                      </div>
                      <div style={{ gridColumn: '1/-1' }}>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4, color: 'var(--text-muted)' }}>Address Line 2</label>
                        <input value={shipping.shipping_address_2} onChange={e => setShipping({ ...shipping, shipping_address_2: e.target.value })}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-base)', fontSize: 13, boxSizing: 'border-box' }} />
                      </div>

                      {/* Shipping Country Select */}
                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4, color: 'var(--text-muted)' }}>Country</label>
                        <select
                          value={shipping.shipping_country || 'India'}
                          onChange={e => setShipping({ ...shipping, shipping_country: e.target.value, shipping_state: '', shipping_city: '' })}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-base)', fontSize: 13, boxSizing: 'border-box' }}
                        >
                          <option value="">— Select Country —</option>
                          {allCountries.map(c => (
                            <option key={c.isoCode} value={c.name}>
                              {c.flag ? `${c.flag} ` : ''}{c.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Shipping State Select */}
                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4, color: 'var(--text-muted)' }}>State</label>
                        <select
                          value={shipping.shipping_state || ''}
                          onChange={e => setShipping({ ...shipping, shipping_state: e.target.value, shipping_city: '' })}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-base)', fontSize: 13, boxSizing: 'border-box' }}
                        >
                          <option value="">— Select State —</option>
                          {shipping.shipping_state && !shippingStates.some(s => s.name.toLowerCase() === (shipping.shipping_state || '').toLowerCase()) && (
                            <option value={shipping.shipping_state}>{shipping.shipping_state}</option>
                          )}
                          {shippingStates.map(s => (
                            <option key={s.isoCode} value={s.name}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Shipping City Select */}
                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4, color: 'var(--text-muted)' }}>City</label>
                        <select
                          value={shipping.shipping_city || ''}
                          onChange={e => setShipping({ ...shipping, shipping_city: e.target.value })}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-base)', fontSize: 13, boxSizing: 'border-box' }}
                        >
                          <option value="">— Select City —</option>
                          {shipping.shipping_city && !shippingCities.some(ci => ci.name.toLowerCase() === (shipping.shipping_city || '').toLowerCase()) && (
                            <option value={shipping.shipping_city}>{shipping.shipping_city}</option>
                          )}
                          {shippingCities.map(ci => (
                            <option key={ci.name} value={ci.name}>
                              {ci.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Shipping Postcode */}
                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4, color: 'var(--text-muted)' }}>Postcode</label>
                        <input
                          value={shipping.shipping_postcode}
                          onChange={e => setShipping({ ...shipping, shipping_postcode: e.target.value })}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-base)', fontSize: 13, boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>
                  ) : (
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
                      Same as billing address.
                    </p>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setIsEditingAddress(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <IconSave size={15} /> {saving ? 'Saving…' : 'Save Addresses'}
                  </button>
                </div>
              </form>
            ) : (
              <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
                {/* Billing display */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>
                    Billing
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--text-base)' }}>
                    <div style={{ fontWeight: 700 }}>{order.billing_first_name} {order.billing_last_name}</div>
                    <div>{order.billing_email}</div>
                    <div>{order.billing_phone}</div>
                    <div style={{ marginTop: 4, color: 'var(--text-muted)' }}>
                      {order.billing_address_1}{order.billing_address_2 ? `, ${order.billing_address_2}` : ''}<br />
                      {order.billing_city}, {order.billing_state} – {order.billing_postcode}<br />
                      {order.billing_country || 'India'}
                    </div>
                  </div>
                </div>
                {/* Shipping display */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>
                    Shipping
                  </div>
                  {order.ship_to_different_address ? (
                    <div style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--text-base)' }}>
                      <div style={{ fontWeight: 700 }}>{order.shipping_first_name} {order.shipping_last_name}</div>
                      {order.shipping_email && <div>{order.shipping_email}</div>}
                      {order.shipping_phone && <div>{order.shipping_phone}</div>}
                      <div style={{ color: 'var(--text-muted)', marginTop: (order.shipping_email || order.shipping_phone) ? 4 : 0 }}>
                        {order.shipping_address_1}{order.shipping_address_2 ? `, ${order.shipping_address_2}` : ''}<br />
                        {order.shipping_city}, {order.shipping_state} – {order.shipping_postcode}<br />
                        {order.shipping_country || 'India'}
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: '#16a34a', fontWeight: 700 }}>✓</span> Same as billing address
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Payment Details */}
          <div style={{ background: 'var(--bg-card, #fff)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconCreditCard size={17} color="#6366f1" />
              <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-base)' }}>Payment Details</span>
            </div>
            <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>Method</div>
                <div style={{ fontWeight: 700, fontSize: 14, textTransform: 'capitalize' }}>
                  {order.payment_method === 'razorpay' ? 'Razorpay' : order.payment_method || 'Razorpay'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>Status</div>
                <StatusBadge value={order.payment_status} map={PAYMENT_STATUSES} />
              </div>
              {order.razorpay_order_id && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>Order ID</div>
                  <div style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: 12 }}>{order.razorpay_order_id}</div>
                </div>
              )}
              {order.razorpay_payment_id && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>Transaction ID</div>
                  <div style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: 12 }}>{order.razorpay_payment_id}</div>
                </div>
              )}
            </div>
          </div>

        </div>
        {/* ══ end LEFT ══════════════════════════════════════════════════════ */}


        {/* ══ RIGHT: sidebar ══════════════════════════════════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Order Status Form */}
          <div style={{ background: 'var(--bg-card, #fff)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-base)' }}>Order Status</span>
            </div>
            <form onSubmit={handleSaveStatus} style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* Order status — custom styled select */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Order Status
                </label>
                <StatusSelect
                  value={status}
                  onChange={setStatus}
                  options={ORDER_STATUSES}
                />
              </div>

              {/* Payment status — custom styled select */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Payment Status
                </label>
                <StatusSelect
                  value={paymentStatus}
                  onChange={setPaymentStatus}
                  options={PAYMENT_STATUSES}
                />
              </div>

              {/* Notes */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Order Notes
                </label>
                <textarea
                  rows={3}
                  value={orderNotes}
                  onChange={e => setOrderNotes(e.target.value)}
                  placeholder="Tracking info, special notes…"
                  style={{ width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-base)', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px' }}
              >
                <IconSave size={15} /> {saving ? 'Saving…' : 'Save Changes'}
              </button>

            </form>
          </div>

          {/* Order Summary card */}
          <div style={{ background: 'var(--bg-card, #fff)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-base)' }}>Summary</span>
            </div>
            <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Order #', value: order.order_number },
                { label: 'Items',   value: order.items?.length || 0 },
                { label: 'Placed',  value: formatISTDateTime(order.created_at) },
                { label: 'Phone',   value: order.billing_phone || '—' },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, gap: 8 }}>
                  <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{row.label}</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-base)', textAlign: 'right' }}>{row.value}</span>
                </div>
              ))}

              {/* Customer row — clickable if linked */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, gap: 8 }}>
                <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>Customer</span>
                {order.customer_id ? (
                  <Link
                    href={`/website-customers?customer=${order.customer_id}`}
                    style={{ fontWeight: 600, color: '#6366f1', textAlign: 'right', textDecoration: 'none' }}
                  >
                    {order.customer?.name || `${order.billing_first_name} ${order.billing_last_name}`.trim() || `#${order.customer_id}`}
                  </Link>
                ) : (
                  <span style={{ fontWeight: 600, color: 'var(--text-base)', textAlign: 'right' }}>
                    {order.billing_first_name ? `${order.billing_first_name} ${order.billing_last_name}`.trim() : '—'}
                  </span>
                )}
              </div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 900 }}>
                <span style={{ color: 'var(--text-muted)' }}>Total</span>
                <span style={{ color: '#16a34a' }}>₹{parseFloat(order.total_amount).toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

        </div>
        {/* ══ end RIGHT sidebar ══════════════════════════════════════════════ */}

      </div>
      {/* end two-col grid */}

    </Layout>
  );
}
