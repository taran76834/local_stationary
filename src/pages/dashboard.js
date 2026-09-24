import Layout from '@/components/Layout';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useRole } from '@/hooks/useRole';
import {
  IconBox, IconTruck, IconReceipt,
  IconTrendUp, IconChevronRight,
} from '@/components/Icons';

const STATUS_BADGE = { draft: 'badge-gray', paid: 'badge-green', cancelled: 'badge-red' };

function fmt(n) {
  return parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function MiniBar({ value, max }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: '#6366f1', borderRadius: 99, transition: 'width .5s' }} />
    </div>
  );
}

// ── Expiry alert with expandable product list ─────────────────────────────────
function ExpiryAlertSection({ expired, expiringSoon, expiringProducts }) {
  const [open, setOpen] = useState(true);

  return (
    <div style={{ marginBottom: 20 }}>
      {/* Expired banner */}
      {expired > 0 && (
        <div style={{ background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 10, padding: '12px 18px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, color: '#ef4444' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span style={{ flex: 1 }}><strong>{expired} unit{expired > 1 ? 's' : ''} EXPIRED</strong> — remove from stock immediately</span>
          <Link href="/stock-items?status=expired">
            <button className="btn btn-sm" style={{ background: '#dc2626', color: '#fff', border: 'none' }}>View in Stock →</button>
          </Link>
        </div>
      )}

      {/* Expiring soon collapsible card */}
      {expiringSoon > 0 && (
        <div style={{ background: 'rgba(245,158,11,.12)', border: '1px solid rgba(245,158,11,.35)', borderRadius: 10, overflow: 'hidden' }}>
          {/* Header row — click to expand/collapse */}
          <div
            onClick={() => setOpen(v => !v)}
            style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <span style={{ flex: 1, fontSize: 13.5, color: '#f59e0b', fontWeight: 600 }}>
              {expiringSoon} unit{expiringSoon > 1 ? 's' : ''} expiring within 30 days
            </span>
            <Link href="/stock-items?status=available&expiring_soon=1" onClick={e => e.stopPropagation()}>
              <button className="btn btn-sm" style={{ background: '#f59e0b', color: '#fff', border: 'none', marginRight: 8 }}>View All →</button>
            </Link>
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5"
              style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .2s', flexShrink: 0 }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>

          {/* Expandable product table */}
          {open && expiringProducts.length > 0 && (
            <div style={{ borderTop: '1px solid rgba(245,158,11,.3)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'rgba(245,158,11,.1)' }}>
                    <th style={{ padding: '8px 18px', textAlign: 'left', fontWeight: 600, color: '#f59e0b', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.4px' }}>Product</th>
                    <th className="hide-mobile" style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#f59e0b', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.4px' }}>Store</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, color: '#f59e0b', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.4px' }}>Units</th>
                    <th className="hide-mobile" style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#f59e0b', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.4px' }}>Earliest Expiry</th>
                    <th style={{ padding: '8px 18px', textAlign: 'center', fontWeight: 600, color: '#f59e0b', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.4px' }}>Days Left</th>
                  </tr>
                </thead>
                <tbody>
                  {expiringProducts.map((p, i) => {
                    const days = Number(p.days_left);
                    const urgentColor = days <= 7 ? '#dc2626' : days <= 15 ? '#ea580c' : '#d97706';
                    const urgentBg    = days <= 7 ? '#fee2e2' : days <= 15 ? '#fff7ed' : '#fefce8';
                    return (
                      <tr key={i} style={{ borderTop: '1px solid rgba(245,158,11,.2)', background: i % 2 === 0 ? 'transparent' : 'rgba(245,158,11,.04)' }}>
                        <td style={{ padding: '9px 18px', fontWeight: 600, color: 'var(--text-base)' }}>{p.product_name}</td>
                        <td className="hide-mobile" style={{ padding: '9px 12px' }}>
                          <span className="badge badge-indigo">{p.store_name}</span>
                        </td>
                        <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                          <span style={{ fontWeight: 700, color: '#f59e0b' }}>{p.units}</span>
                        </td>
                        <td className="hide-mobile" style={{ padding: '9px 12px', color: 'var(--text-muted)' }}>
                          {new Date(p.earliest_expiry).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td style={{ padding: '9px 18px', textAlign: 'center' }}>
                          <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, background: urgentBg, color: urgentColor, fontWeight: 700, fontSize: 12 }}>
                            {days === 0 ? 'Today' : `${days}d`}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { isStoreMinus, isStorePlus } = useRole();
  const hideStoreBreakdown = isStoreMinus || isStorePlus;
  const hideTopSelling = isStoreMinus || isStorePlus;
  const hidePendingAndSuppliers = isStoreMinus;

  const [data,     setData]     = useState({});
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);


  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      // Load counts first (fastest) — shows stat cards immediately
      const r1 = await fetch('/api/dashboard/stats?section=counts');
      if (!r1.ok) throw new Error(`Server error ${r1.status}`);
      const counts = await r1.json();
      setData(prev => ({
        ...prev,
        products:  { total: counts.total_products, low_stock: counts.low_stock, out_of_stock: counts.out_of_stock, expiring_soon: counts.expiring_soon, expired: counts.expired },
        suppliers: { total: counts.total_suppliers },
        orders:    { total: counts.total_orders, pending: counts.pending_orders },
        sales: { ...prev.sales, total_bills: counts.total_bills, paid_bills: counts.paid_bills, draft_bills: counts.draft_bills, cancelled_bills: counts.cancelled_bills, today_bills: counts.today_bills, today_paid_bills: counts.today_paid_bills, month_bills: counts.month_bills },
      }));
      setLoading(false); // show page with counts while rest loads

      // Load revenue amounts
      const r2 = await fetch('/api/dashboard/stats?section=revenue');
      if (r2.ok) {
        const revenue = await r2.json();
        setData(prev => ({
          ...prev,
          sales: { ...prev.sales, total_revenue: revenue.total_revenue, today_revenue: revenue.today_revenue, today_discount: revenue.today_discount, month_revenue: revenue.month_revenue },
        }));
      }

      // Load tables (heaviest — recent bills, top products, charts)
      const r3 = await fetch('/api/dashboard/stats?section=tables');
      if (r3.ok) {
        const tables = await r3.json();
        setData(prev => ({ ...prev, ...tables }));
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);



  const s       = data?.sales || {};
  const maxSold = data?.top_products?.[0]?.total_sold || 1;

  const topStats = [
    { label: 'Total Bills',    value: s.total_bills ?? '—',         sub: `${s.paid_bills || 0} paid`,                   icon: IconReceipt, color: 'green'  },
    { label: 'Total Products', value: data?.products?.total ?? '—', sub: `${data?.products?.low_stock || 0} low stock`, icon: IconBox,     color: 'amber'  },
    ...(!hidePendingAndSuppliers ? [
      { label: 'Pending Orders', value: data?.orders?.pending ?? '—', sub: `${data?.orders?.total || 0} total orders`,    icon: IconTruck,   color: 'blue'   },
      { label: 'Suppliers',      value: data?.suppliers?.total ?? '—', sub: 'registered',                                  icon: IconTrendUp, color: 'indigo' },
    ] : [])
  ];

  if (error) {
    return (
      <Layout title="Dashboard">
        <div style={{ background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 10, padding: '20px 24px', color: '#ef4444', fontSize: 14 }}>
          <strong>Failed to load dashboard data:</strong> {error}
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Dashboard" subtitle="Sales overview & store performance">

      {/* Expiry Alert — collapsed banner + expandable product table */}
      {!loading && (data?.products?.expiring_soon > 0 || data?.products?.expired > 0) && (
        <ExpiryAlertSection
          expired={data.products.expired}
          expiringSoon={data.products.expiring_soon}
          expiringProducts={data.expiring_soon_products || []}
        />
      )}

      {/* ── Today's Revenue Hero ── */}
      <div style={{
        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
        borderRadius: 16,
        padding: '24px 28px',
        marginBottom: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
        boxShadow: '0 8px 32px rgba(99,102,241,.35)',
      }}>
        <div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,.7)', fontWeight: 500, marginBottom: 6 }}>
            Today&apos;s Revenue
          </div>
          <div style={{ fontSize: 42, fontWeight: 800, color: '#fff', lineHeight: 1, letterSpacing: '-1px' }}>
            {loading ? '—' : `₹${fmt(s.today_revenue)}`}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,.65)', marginTop: 8 }}>
            {loading ? '' : `${s.today_bills || 0} bills today`}
          </div>
          {!loading && (s.today_discount > 0) && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              marginTop: 10,
              background: 'rgba(255,255,255,.15)',
              borderRadius: 8,
              padding: '5px 12px',
              fontSize: 13,
              color: '#fff',
              fontWeight: 500,
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
              </svg>
              Discount given today: <strong style={{ marginLeft: 2 }}>₹{fmt(s.today_discount)}</strong>
            </div>
          )}
        </div>


      </div>

      {/* ── Payment type + Store breakdown ── */}
      {!loading && (
        <div className="dash-payment-grid" style={{ display: 'grid', gridTemplateColumns: hideStoreBreakdown ? '1fr' : '1fr 1fr', gap: 16, marginBottom: 24 }}>

          {/* Payment type breakdown */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', padding: '16px 20px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 12 }}>Today by Payment Type</div>
            <div style={{ display: 'flex', gap: 10 }}>
              {[
                { key: 'cash', label: 'Cash',  emoji: '💵', color: '#10b981', bg: 'rgba(16,185,129,.15)'  },
                { key: 'card', label: 'Card',  emoji: '💳', color: '#3b82f6', bg: 'rgba(59,130,246,.15)'  },
                { key: 'upi',  label: 'UPI',   emoji: '📱', color: '#8b5cf6', bg: 'rgba(139,92,246,.15)'  },
              ].map(pt => {
                const row = (data?.today_by_payment || []).find(r => r.payment_type === pt.key);
                return (
                  <div key={pt.key} style={{ flex: 1, background: pt.bg, borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
                    <div style={{ fontSize: 18, marginBottom: 4 }}>{pt.emoji}</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: pt.color }}>₹{fmt(row?.revenue || 0)}</div>
                    <div style={{ fontSize: 11, color: pt.color, fontWeight: 600, marginTop: 2 }}>{pt.label}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-faint)', marginTop: 1 }}>{row?.bills || 0} bill{row?.bills !== 1 ? 's' : ''}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Store-wise breakdown */}
          {!hideStoreBreakdown && (
            <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', padding: '16px 20px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 12 }}>Today by Store</div>
              {!data?.today_by_store?.length ? (
                <div style={{ fontSize: 13, color: 'var(--text-faint)', textAlign: 'center', padding: '12px 0' }}>No store sales today</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {data.today_by_store.map((row, i) => {
                    const pct = s.today_revenue > 0 ? (parseFloat(row.revenue) / s.today_revenue) * 100 : 0;
                    return (
                      <div key={i}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-base)' }}>{row.store_name}</span>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#6366f1' }}>₹{fmt(row.revenue)}</span>
                            <span style={{ fontSize: 11, color: 'var(--text-faint)', marginLeft: 6 }}>{row.bills} bill{row.bills !== 1 ? 's' : ''}</span>
                          </div>
                        </div>
                        <div style={{ height: 5, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: '#6366f1', borderRadius: 99, transition: 'width .5s' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Stat cards ── */}
      <div className="dash-stats" style={{ marginBottom: 24, gridTemplateColumns: hidePendingAndSuppliers ? 'repeat(2, 1fr)' : undefined }}>
        {topStats.map((card, i) => {
          const Icon = card.icon;
          return (
            <div className="stat-card" key={i}>
              <div className="stat-card-top">
                <div className={`stat-icon-wrap ${card.color}`}><Icon size={20} /></div>
              </div>
              <div>
                <div className="stat-value" style={{ fontSize: 22 }}>
                  {loading ? <span style={{ color: '#e2e8f0' }}>—</span> : card.value}
                </div>
                <div className="stat-label">{card.label}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 2 }}>{card.sub}</div>
              </div>
            </div>
          );
        })}
      </div>



      {/* ── Bottom row ── */}
      <div className="dash-bottom-grid" style={{ display: 'grid', gridTemplateColumns: hideTopSelling ? '1fr' : '1fr 1fr', gap: 20 }}>

        {/* Recent bills */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Recent Bills</div>
              <div className="card-sub">Latest transactions</div>
            </div>
            <Link href="/bills">
              <button className="btn btn-secondary btn-sm">
                View All <IconChevronRight size={13} />
              </button>
            </Link>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Bill No.</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: 28, color: '#94a3b8' }}>Loading…</td></tr>
                ) : !data?.recent_bills?.length ? (
                  <tr>
                    <td colSpan={4}>
                      <div className="empty-state" style={{ padding: 28 }}>
                        <div className="empty-state-icon"><IconReceipt size={20} /></div>
                        <p>No bills yet</p>
                      </div>
                    </td>
                  </tr>
                ) : data.recent_bills.map(b => (
                  <tr key={b.id}>
                    <td><strong style={{ color: '#6366f1', fontSize: 12 }}>{b.bill_number}</strong></td>
                    <td style={{ fontSize: 13 }}>{b.customer_name || <span style={{ color: '#94a3b8' }}>Walk-in</span>}</td>
                    <td><span className={`badge ${STATUS_BADGE[b.status]}`}>{b.status}</span></td>
                    <td style={{ fontWeight: 700, fontSize: 13 }}>₹{fmt(b.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {!hideTopSelling && (
          /* Top selling products */
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Top Selling Products</div>
                <div className="card-sub">Based on paid bills</div>
              </div>
            </div>
            <div style={{ padding: '8px 22px 16px' }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: 28, color: '#94a3b8' }}>Loading…</div>
              ) : !data?.top_products?.length ? (
                <div className="empty-state" style={{ padding: 28 }}>
                  <div className="empty-state-icon"><IconBox size={20} /></div>
                  <p>No sales data yet</p>
                  <span>Mark bills as paid to see top products</span>
                </div>
              ) : data.top_products.map((p, i) => (
                <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(99,102,241,.15)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
                        {i + 1}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-base)' }}>{p.name}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-base)' }}>{p.total_sold} sold</div>
                      <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>₹{fmt(p.total_revenue)}</div>
                    </div>
                  </div>
                  <MiniBar value={p.total_sold} max={maxSold} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
