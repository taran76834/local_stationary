import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Head from 'next/head';

function formatDate(dateStr) {
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

function statusLabel(val) {
  return (val || 'pending').charAt(0).toUpperCase() + (val || 'pending').slice(1);
}

export default function OrderPrintPage() {
  const router = useRouter();
  // router.query is empty on first render — wait until router is ready
  const id = router.isReady ? router.query.id : null;

  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/orders/${id}`)
      .then(r => r.json())
      .then(data => {
        if (!data || (data.message && !data.order_number)) throw new Error(data?.message || 'Order not found');
        setOrder(data);
        setReady(true);
      })
      .catch(e => setError(e.message));
  }, [id]);

  // Auto-print once page is ready
  useEffect(() => {
    if (ready) {
      const t = setTimeout(() => window.print(), 600);
      return () => clearTimeout(t);
    }
  }, [ready]);

  if (error) return (
    <div style={{ padding: 40, textAlign: 'center', fontFamily: 'sans-serif', color: '#dc2626' }}>
      Error: {error}
    </div>
  );

  if (!order) return (
    <div style={{ padding: 40, textAlign: 'center', fontFamily: 'sans-serif', color: '#64748b' }}>
      Loading…
    </div>
  );

  const subtotal    = parseFloat(order.subtotal    || 0);
  const shippingFee = parseFloat(order.shipping_fee || 0);
  const total       = parseFloat(order.total_amount || 0);

  const shippingAddr = order.ship_to_different_address
    ? [
        `${order.shipping_first_name || ''} ${order.shipping_last_name || ''}`.trim(),
        order.shipping_email,
        order.shipping_phone,
        order.shipping_address_1,
        order.shipping_address_2,
        `${order.shipping_city}, ${order.shipping_state} – ${order.shipping_postcode}`,
        order.shipping_country || 'India',
      ].filter(Boolean)
    : null;

  return (
    <>
      <Head>
        <title>Order {order.order_number} — Invincible Fitness</title>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }

          body {
            font-family: 'Segoe UI', Arial, sans-serif;
            background: #fff;
            color: #0f172a;
            font-size: 13px;
          }

          .page {
            width: 210mm;
            min-height: 297mm;
            margin: 0 auto;
            padding: 14mm 14mm 12mm 14mm;
          }

          /* ── header ── */
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            padding-bottom: 14px;
            border-bottom: 2px solid #0f172a;
            margin-bottom: 20px;
          }
          .brand-name {
            font-size: 22px;
            font-weight: 900;
            letter-spacing: -0.5px;
            color: #0f172a;
          }
          .brand-sub {
            font-size: 11px;
            color: #64748b;
            margin-top: 3px;
          }
          .invoice-title {
            text-align: right;
          }
          .invoice-title h1 {
            font-size: 28px;
            font-weight: 900;
            color: #ea580c;
            letter-spacing: -1px;
          }
          .invoice-title .order-num {
            font-size: 13px;
            font-weight: 700;
            color: #334155;
            margin-top: 2px;
          }

          /* ── meta row ── */
          .meta-row {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 16px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 14px 18px;
            margin-bottom: 22px;
          }
          .meta-item .label {
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            color: #94a3b8;
            margin-bottom: 3px;
          }
          .meta-item .value {
            font-size: 13px;
            font-weight: 700;
            color: #0f172a;
          }

          /* ── status badges ── */
          .badge {
            display: inline-block;
            padding: 3px 10px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 700;
          }
          .badge-pending    { background: #fef3c7; color: #d97706; }
          .badge-processing { background: #e0f2fe; color: #0284c7; }
          .badge-completed  { background: #dcfce7; color: #16a34a; }
          .badge-cancelled  { background: #fee2e2; color: #dc2626; }
          .badge-paid       { background: #dcfce7; color: #15803d; }
          .badge-failed     { background: #fee2e2; color: #b91c1c; }

          /* ── address grid ── */
          .address-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin-bottom: 22px;
          }
          .address-box {
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 14px 16px;
          }
          .address-box .addr-title {
            font-size: 9px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #ea580c;
            margin-bottom: 8px;
          }
          .address-box .name {
            font-weight: 700;
            font-size: 13px;
            margin-bottom: 4px;
          }
          .address-box .line {
            font-size: 12px;
            color: #475569;
            line-height: 1.6;
          }

          /* ── section heading ── */
          .section-heading {
            font-size: 9px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #94a3b8;
            margin-bottom: 8px;
          }

          /* ── items table ── */
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
          }
          .items-table thead tr {
            background: #0f172a;
            color: #fff;
          }
          .items-table thead th {
            padding: 9px 12px;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .items-table thead th:not(:first-child) { text-align: right; }
          .items-table tbody tr {
            border-bottom: 1px solid #e2e8f0;
          }
          .items-table tbody tr:last-child { border-bottom: none; }
          .items-table tbody td {
            padding: 11px 12px;
            font-size: 12.5px;
            vertical-align: middle;
          }
          .items-table tbody td:not(:first-child) { text-align: right; }
          .product-name { font-weight: 700; color: #0f172a; }
          .product-variant { font-size: 11px; color: #64748b; margin-top: 2px; }

          /* ── totals ── */
          .totals-wrap {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 22px;
          }
          .totals-box {
            width: 260px;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            overflow: hidden;
          }
          .totals-row {
            display: flex;
            justify-content: space-between;
            padding: 9px 14px;
            font-size: 12.5px;
            border-bottom: 1px solid #e2e8f0;
          }
          .totals-row:last-child { border-bottom: none; }
          .totals-row.grand {
            background: #0f172a;
            color: #fff;
            font-size: 15px;
            font-weight: 900;
          }
          .totals-row.grand .amt { color: #4ade80; }
          .totals-row .lbl { color: #64748b; }
          .totals-row .amt { font-weight: 700; }
          .free { color: #16a34a; font-weight: 700; }

          /* ── payment section ── */
          .payment-row {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 14px 18px;
            margin-bottom: 30px;
          }
          .payment-row .label {
            font-size: 9px; font-weight: 700;
            text-transform: uppercase; letter-spacing: 0.8px;
            color: #94a3b8; margin-bottom: 4px;
          }
          .payment-row .value {
            font-size: 12.5px; font-weight: 700; color: #0f172a;
          }
          .payment-row .mono {
            font-family: monospace; font-size: 11px;
          }

          /* ── notes ── */
          .notes-box {
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 12px 16px;
            font-size: 12.5px;
            color: #475569;
            line-height: 1.6;
            margin-bottom: 22px;
          }

          /* ── footer ── */
          .footer {
            border-top: 1px solid #e2e8f0;
            padding-top: 14px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 11px;
            color: #94a3b8;
          }

          /* ── print controls (screen only) ── */
          .print-bar {
            background: #0f172a;
            padding: 12px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
            position: sticky;
            top: 0;
            z-index: 100;
          }
          .print-bar span { color: #cbd5e1; font-size: 13px; }
          .print-bar button {
            padding: 8px 20px;
            border-radius: 8px;
            border: none;
            cursor: pointer;
            font-weight: 700;
            font-size: 13px;
          }
          .btn-print { background: #ea580c; color: #fff; }
          .btn-close { background: #27272a; color: #fff; }

          @media print {
            .print-bar { display: none !important; }
            .page { padding: 10mm 12mm; }
            @page { size: A4; margin: 0; }
          }
        `}</style>
      </Head>

      {/* Screen-only top bar */}
      <div className="print-bar">
        <span>Order {order.order_number} — Print Preview</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-close" onClick={() => window.close()}>✕ Close</button>
          <button className="btn-print" onClick={() => window.print()}>🖨 Print / Save PDF</button>
        </div>
      </div>

      <div className="page">

        {/* ── HEADER ── */}
        <div className="header">
          <div>
            <div className="brand-name">Invincible Fitness</div>
            <div className="brand-sub">Jalandhar, Punjab, India</div>
          </div>
          <div className="invoice-title">
            <h1>INVOICE</h1>
            <div className="order-num">{order.order_number}</div>
          </div>
        </div>

        {/* ── META ROW ── */}
        <div className="meta-row">
          <div className="meta-item">
            <div className="label">Order Date</div>
            <div className="value">{formatDate(order.created_at)}</div>
          </div>
          <div className="meta-item">
            <div className="label">Order Status</div>
            <div className="value">
              <span className={`badge badge-${(order.status || 'pending').toLowerCase()}`}>
                {statusLabel(order.status)}
              </span>
            </div>
          </div>
          <div className="meta-item">
            <div className="label">Payment Status</div>
            <div className="value">
              <span className={`badge badge-${(order.payment_status || 'pending').toLowerCase()}`}>
                {statusLabel(order.payment_status)}
              </span>
            </div>
          </div>
        </div>

        {/* ── ADDRESSES ── */}
        <div className="address-grid">
          <div className="address-box">
            <div className="addr-title">Bill To</div>
            <div className="name">{order.billing_first_name} {order.billing_last_name}</div>
            <div className="line">
              {order.billing_email && <div>{order.billing_email}</div>}
              {order.billing_phone && <div>{order.billing_phone}</div>}
              {order.billing_address_1 && <div style={{ marginTop: 4 }}>{order.billing_address_1}{order.billing_address_2 ? `, ${order.billing_address_2}` : ''}</div>}
              <div>{order.billing_city}, {order.billing_state} – {order.billing_postcode}</div>
              <div>{order.billing_country || 'India'}</div>
            </div>
          </div>
          <div className="address-box">
            <div className="addr-title">Ship To</div>
            {shippingAddr ? (
              <div className="line">
                {shippingAddr.map((l, i) => <div key={i}>{l}</div>)}
              </div>
            ) : (
              <>
                <div className="name">{order.billing_first_name} {order.billing_last_name}</div>
                <div className="line">
                  {order.billing_email && <div>{order.billing_email}</div>}
                  {order.billing_phone && <div>{order.billing_phone}</div>}
                  {order.billing_address_1 && <div style={{ marginTop: 4 }}>{order.billing_address_1}{order.billing_address_2 ? `, ${order.billing_address_2}` : ''}</div>}
                  <div>{order.billing_city}, {order.billing_state} – {order.billing_postcode}</div>
                  <div>{order.billing_country || 'India'}</div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── ITEMS TABLE ── */}
        <div className="section-heading">Order Items</div>
        <table className="items-table">
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Product</th>
              <th>Unit / Variant</th>
              <th>Price</th>
              <th>Qty</th>
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {(order.items || []).map((item, i) => (
              <tr key={item.id || i}>
                <td style={{ textAlign: 'left' }}>
                  <div className="product-name">{item.product_name}</div>
                  {item.flavor && <div className="product-variant">{item.flavor}</div>}
                </td>
                <td>{item.unit_display || 'Standard'}</td>
                <td>₹{parseFloat(item.price).toLocaleString('en-IN')}</td>
                <td>{item.quantity}</td>
                <td style={{ fontWeight: 800 }}>₹{parseFloat(item.subtotal).toLocaleString('en-IN')}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── TOTALS ── */}
        <div className="totals-wrap">
          <div className="totals-box">
            <div className="totals-row">
              <span className="lbl">Subtotal</span>
              <span className="amt">₹{subtotal.toLocaleString('en-IN')}</span>
            </div>
            <div className="totals-row">
              <span className="lbl">Shipping</span>
              <span className={shippingFee === 0 ? 'free' : 'amt'}>
                {shippingFee === 0 ? 'FREE' : `₹${shippingFee.toLocaleString('en-IN')}`}
              </span>
            </div>
            <div className="totals-row grand">
              <span>Total</span>
              <span className="amt">₹{total.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        {/* ── PAYMENT ── */}
        <div className="section-heading">Payment Details</div>
        <div className="payment-row">
          <div>
            <div className="label">Method</div>
            <div className="value" style={{ textTransform: 'capitalize' }}>
              {order.payment_method === 'razorpay' ? 'Razorpay' : order.payment_method || '—'}
            </div>
          </div>
          {order.razorpay_order_id && (
            <div>
              <div className="label">Payment Order ID</div>
              <div className="value mono">{order.razorpay_order_id}</div>
            </div>
          )}
          {order.razorpay_payment_id && (
            <div>
              <div className="label">Transaction ID</div>
              <div className="value mono">{order.razorpay_payment_id}</div>
            </div>
          )}
        </div>

        {/* ── NOTES ── */}
        {order.order_notes && (
          <>
            <div className="section-heading">Order Notes</div>
            <div className="notes-box">{order.order_notes}</div>
          </>
        )}

        {/* ── FOOTER ── */}
        <div className="footer">
          <span>Invincible Fitness · Jalandhar, Punjab, India</span>
          <span>Thank you for your order!</span>
          <span>Printed {new Date().toLocaleDateString('en-IN')}</span>
        </div>

      </div>
    </>
  );
}
