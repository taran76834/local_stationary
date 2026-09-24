import Layout from '@/components/Layout';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useAuth } from '@/context/AuthContext';
import { useRole } from '@/hooks/useRole';
import {
  IconBox, IconTruck, IconReceipt,
  IconTrendUp, IconChevronRight, IconStore,
  IconCalendar, IconShoppingBag, IconFactory,
  IconDroplet, IconBrand, IconTag, IconTransfer,
} from '@/components/Icons';

// Dynamic import for chart to avoid SSR issues
const SalesChart = dynamic(() => import('@/components/SalesChart'), { ssr: false });

const STATUS_BADGE = {
  draft: 'badge-gray',
  paid: 'badge-green',
  cancelled: 'badge-red',
};

const PAYMENT_META = {
  cash: { label: 'Cash', emoji: '💵', color: '#10b981', bg: 'rgba(16,185,129,.12)', barColor: '#10b981' },
  card: { label: 'Card', emoji: '💳', color: '#0ea5e9', bg: 'rgba(14,165,233,.12)', barColor: '#0ea5e9' },
  upi:  { label: 'UPI',  emoji: '📱', color: '#8b5cf6', bg: 'rgba(139,92,246,.12)', barColor: '#8b5cf6' },
};

function fmt(n) {
  return parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function MiniBar({ value, max, color = '#6366f1' }) {
  const pct = max > 0 ? Math.min(100, Math.max(8, Math.round((value / max) * 100))) : 0;
  return (
    <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 99, transition: 'width .6s cubic-bezier(.4,0,.2,1)' }} />
    </div>
  );
}

// ── Expiry alert with expandable product list ─────────────────────────────────
function ExpiryAlertSection({ expired, expiringSoon, expiringProducts }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Expired banner */}
      {expired > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(239,68,68,.14) 0%, rgba(220,38,38,.08) 100%)',
          border: '1px solid rgba(239,68,68,.35)',
          borderRadius: 14,
          padding: '14px 20px',
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontSize: 13.5,
          color: '#ef4444',
          boxShadow: '0 2px 10px rgba(239,68,68,.08)'
        }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#ef4444', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <span style={{ flex: 1 }}>
            <strong>{expired} item{expired > 1 ? 's' : ''} have EXPIRED</strong> — please inspect and remove from available stationery inventory.
          </span>
          <Link href="/stock-items?status=expired">
            <button className="btn btn-sm btn-danger">View Expired Stock →</button>
          </Link>
        </div>
      )}

      {/* Expiring soon collapsible card */}
      {expiringSoon > 0 && (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid rgba(245,158,11,.35)',
          borderRadius: 14,
          overflow: 'hidden',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div
            onClick={() => setOpen(v => !v)}
            style={{
              padding: '14px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              cursor: 'pointer',
              userSelect: 'none',
              background: 'linear-gradient(135deg, rgba(245,158,11,.1) 0%, rgba(245,158,11,.04) 100%)'
            }}
          >
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f59e0b', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <span style={{ flex: 1, fontSize: 13.5, color: 'var(--text-base)', fontWeight: 600 }}>
              <span style={{ color: '#d97706', fontWeight: 800 }}>{expiringSoon} unit{expiringSoon > 1 ? 's' : ''}</span> expiring within 30 days
            </span>
            <Link href="/stock-items?status=available&expiring_soon=1" onClick={e => e.stopPropagation()}>
              <button className="btn btn-sm btn-secondary" style={{ marginRight: 8, borderColor: 'rgba(245,158,11,.4)' }}>View All</button>
            </Link>
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5"
              style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .2s', flexShrink: 0 }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>

          {open && expiringProducts.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--thead-bg)' }}>
                    <th style={{ padding: '10px 18px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase' }}>Product</th>
                    <th className="hide-mobile" style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase' }}>Store</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase' }}>Units</th>
                    <th className="hide-mobile" style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase' }}>Earliest Expiry</th>
                    <th style={{ padding: '10px 18px', textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase' }}>Days Left</th>
                  </tr>
                </thead>
                <tbody>
                  {expiringProducts.map((p, i) => {
                    const days = Number(p.days_left);
                    const urgentColor = days <= 7 ? '#dc2626' : days <= 15 ? '#ea580c' : '#d97706';
                    const urgentBg    = days <= 7 ? '#fee2e2' : days <= 15 ? '#fff7ed' : '#fefce8';
                    return (
                      <tr key={i} style={{ borderTop: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '11px 18px', fontWeight: 600, color: 'var(--text-base)' }}>{p.product_name}</td>
                        <td className="hide-mobile" style={{ padding: '11px 12px' }}>
                          <span className="badge badge-indigo">{p.store_name}</span>
                        </td>
                        <td style={{ padding: '11px 12px', textAlign: 'center' }}>
                          <span style={{ fontWeight: 800, color: '#f59e0b' }}>{p.units}</span>
                        </td>
                        <td className="hide-mobile" style={{ padding: '11px 12px', color: 'var(--text-muted)' }}>
                          {new Date(p.earliest_expiry).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td style={{ padding: '11px 18px', textAlign: 'center' }}>
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
  const { user } = useAuth();
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
      setLoading(false);

      const r2 = await fetch('/api/dashboard/stats?section=revenue');
      if (r2.ok) {
        const revenue = await r2.json();
        setData(prev => ({
          ...prev,
          sales: { ...prev.sales, total_revenue: revenue.total_revenue, today_revenue: revenue.today_revenue, today_discount: revenue.today_discount, month_revenue: revenue.month_revenue },
        }));
      }

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

  const s = data?.sales || {};
  const maxSold = data?.top_products?.[0]?.total_sold || 1;
  const todayRev = parseFloat(s.today_revenue || 0);

  const topStats = [
    {
      label: 'Total Invoices',
      value: s.total_bills ?? '—',
      sub: `${s.paid_bills || 0} completed · ${s.draft_bills || 0} draft`,
      icon: IconReceipt,
      color: 'indigo',
      href: '/bills',
    },
    {
      label: 'Stationery Catalog',
      value: data?.products?.total ?? '—',
      sub: `${data?.products?.low_stock || 0} low stock · ${data?.products?.out_of_stock || 0} out`,
      icon: IconBox,
      color: 'green',
      href: '/products',
    },
    ...(!hidePendingAndSuppliers ? [
      {
        label: 'Purchase Receipts',
        value: data?.orders?.total ?? '—',
        sub: `${data?.orders?.pending || 0} pending verification`,
        icon: IconTruck,
        color: 'blue',
        href: '/purchase-orders',
      },
      {
        label: 'Active Suppliers',
        value: data?.suppliers?.total ?? '—',
        sub: 'Registered vendors',
        icon: IconFactory,
        color: 'amber',
        href: '/suppliers',
      },
    ] : [])
  ];

  // Chart data format
  const chartData = (data?.sales_last_7_days || []).map(d => ({
    label: new Date(d.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' }),
    revenue: parseFloat(d.revenue || 0),
    bills: parseInt(d.bills || 0),
  }));

  if (error) {
    return (
      <Layout title="Dashboard">
        <div style={{ background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 14, padding: '24px', color: '#ef4444', fontSize: 14 }}>
          <strong>Failed to load dashboard data:</strong> {error}
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Dashboard" subtitle="Stationery Store Analytics &amp; Inventory Overview">

      {/* ── Welcome Greeting & Action Bar ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
        marginBottom: 24,
      }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-base)', margin: 0 }}>
            Welcome back, {user?.name || 'Admin'} 👋
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Here is what is happening across your stationery branches today.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/bills">
            <button className="btn btn-primary btn-sm" style={{ boxShadow: '0 4px 14px var(--primary-glow)' }}>
              <IconReceipt size={15} /> + Create New Bill
            </button>
          </Link>
          <Link href="/products/create">
            <button className="btn btn-secondary btn-sm">
              <IconBox size={15} /> + Add Product
            </button>
          </Link>
          <Link href="/stock-transfers">
            <button className="btn btn-secondary btn-sm hide-mobile">
              <IconTransfer size={15} /> Transfer Stock
            </button>
          </Link>
        </div>
      </div>

      {/* ── Expiry / Stock Alert ── */}
      {!loading && (data?.products?.expiring_soon > 0 || data?.products?.expired > 0) && (
        <ExpiryAlertSection
          expired={data.products.expired}
          expiringSoon={data.products.expiring_soon}
          expiringProducts={data.expiring_soon_products || []}
        />
      )}

      {/* ── Top Bento Row: Revenue Hero + Payment Types + Store Breakdown ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: hideStoreBreakdown ? '1fr 1fr' : '1.2fr 1fr 1fr',
        gap: 20,
        marginBottom: 26,
      }}>

        {/* Card 1: Today's Revenue Performance Card */}
        <div style={{
          background: 'linear-gradient(135deg, #1e1b4b 0%, #2e287a 50%, #4338ca 100%)',
          borderRadius: 20,
          padding: '24px 26px',
          color: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 10px 30px -5px rgba(67, 56, 202, 0.45)',
          border: '1px solid rgba(255, 255, 255, 0.12)'
        }}>
          {/* Subtle ambient decorative circle */}
          <div style={{
            position: 'absolute',
            top: -40,
            right: -40,
            width: 140,
            height: 140,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99,102,241,0.35) 0%, transparent 70%)',
            pointerEvents: 'none'
          }} />

          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 10px #34d399' }} />
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: '#c7d2fe' }}>
                  Today&apos;s Store Revenue
                </span>
              </div>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,.6)', fontWeight: 600 }}>
                {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </span>
            </div>

            <div style={{
              fontFamily: 'Outfit, sans-serif',
              fontSize: 38,
              fontWeight: 800,
              letterSpacing: '-0.03em',
              lineHeight: 1.1,
              color: '#ffffff'
            }}>
              {loading ? '—' : `₹${fmt(s.today_revenue)}`}
            </div>

            <div style={{ fontSize: 13, color: '#e0e7ff', marginTop: 8, fontWeight: 500 }}>
              {loading ? 'Loading...' : `${s.today_bills || 0} bill${s.today_bills !== 1 ? 's' : ''} generated today`}
            </div>
          </div>

          <div style={{
            marginTop: 20,
            paddingTop: 16,
            borderTop: '1px solid rgba(255,255,255,.14)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            flexWrap: 'wrap'
          }}>
            <div>
              <div style={{ fontSize: 11, color: '#c7d2fe', fontWeight: 600 }}>This Month</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#ffffff', marginTop: 1 }}>
                ₹{fmt(s.month_revenue)}
              </div>
            </div>

            {s.today_discount > 0 && (
              <div style={{
                background: 'rgba(255,255,255,.12)',
                padding: '4px 10px',
                borderRadius: 8,
                fontSize: 11.5,
                fontWeight: 600,
                color: '#fef08a'
              }}>
                Discount: ₹{fmt(s.today_discount)}
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Payment Method Breakdown */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '22px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span className="card-title" style={{ fontSize: 14 }}>Payment Methods</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>TODAY</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {['cash', 'upi', 'card'].map(key => {
                const meta = PAYMENT_META[key];
                const row = (data?.today_by_payment || []).find(r => r.payment_type === key);
                const rev = parseFloat(row?.revenue || 0);
                const pct = todayRev > 0 ? Math.round((rev / todayRev) * 100) : 0;

                return (
                  <div key={key} style={{ background: 'var(--bg-base)', padding: '10px 14px', borderRadius: 12, border: '1px solid var(--border-light)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 16 }}>{meta.emoji}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-base)' }}>{meta.label}</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: 13.5, fontWeight: 800, color: meta.color }}>₹{fmt(rev)}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-faint)', marginLeft: 6 }}>({pct}%)</span>
                      </div>
                    </div>
                    <MiniBar value={rev} max={todayRev} color={meta.barColor} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Card 3: Store Sales Performance */}
        {!hideStoreBreakdown && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '22px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <span className="card-title" style={{ fontSize: 14 }}>Branch Performance</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>TODAY</span>
              </div>

              {!data?.today_by_store?.length ? (
                <div className="empty-state" style={{ padding: '28px 0' }}>
                  <div className="empty-state-icon" style={{ width: 44, height: 44 }}><IconStore size={18} /></div>
                  <p style={{ fontSize: 13 }}>No store sales recorded today</p>
                  <span>Transactions will display in real time</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {data.today_by_store.map((row, i) => {
                    const rev = parseFloat(row.revenue || 0);
                    const pct = todayRev > 0 ? (rev / todayRev) * 100 : 0;
                    return (
                      <div key={i} style={{ background: 'var(--bg-base)', padding: '10px 14px', borderRadius: 12, border: '1px solid var(--border-light)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-base)' }}>{row.store_name}</span>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--primary)' }}>₹{fmt(rev)}</span>
                            <span style={{ fontSize: 11, color: 'var(--text-faint)', marginLeft: 6 }}>{row.bills} bill{row.bills !== 1 ? 's' : ''}</span>
                          </div>
                        </div>
                        <MiniBar value={rev} max={todayRev} color="#4f46e5" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* ── Core KPI Stats Grid ── */}
      <div className="dash-stats">
        {topStats.map((card, i) => {
          const Icon = card.icon;
          return (
            <Link key={i} href={card.href} style={{ textDecoration: 'none' }}>
              <div className="stat-card" style={{ cursor: 'pointer' }}>
                <div className="stat-card-top">
                  <div className={`stat-icon-wrap ${card.color}`}>
                    <Icon size={22} />
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-faint)', display: 'flex', alignItems: 'center' }}>
                    <IconChevronRight size={14} />
                  </span>
                </div>
                <div>
                  <div className="stat-value">
                    {loading ? <span style={{ color: 'var(--text-faint)' }}>—</span> : card.value}
                  </div>
                  <div className="stat-label">{card.label}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 3 }}>
                    {card.sub}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* ── Middle: 7-Day Revenue Trend Chart (if data exists) ── */}
      {chartData.length > 0 && (
        <div className="card" style={{ marginBottom: 26 }}>
          <div className="card-header">
            <div>
              <div className="card-title">7-Day Sales Trend</div>
              <div className="card-sub">Daily revenue and transaction volumes</div>
            </div>
            <div className="badge badge-indigo">Last 7 Days</div>
          </div>
          <div style={{ padding: '20px 24px 12px' }}>
            <SalesChart data={chartData} />
          </div>
        </div>
      )}

      {/* ── Bottom Row: Recent Bills & Top Selling Products ── */}
      <div className="dash-bottom-grid" style={{ display: 'grid', gridTemplateColumns: hideTopSelling ? '1fr' : '1.2fr 1fr', gap: 24 }}>

        {/* Recent Bills Card */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Recent Bills</div>
              <div className="card-sub">Latest customer checkout transactions</div>
            </div>
            <Link href="/bills">
              <button className="btn btn-secondary btn-sm">
                View All Bills <IconChevronRight size={13} />
              </button>
            </Link>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Bill No.</th>
                  <th>Customer</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Loading bills...</td></tr>
                ) : !data?.recent_bills?.length ? (
                  <tr>
                    <td colSpan={5}>
                      <div className="empty-state" style={{ padding: 36 }}>
                        <div className="empty-state-icon"><IconReceipt size={22} /></div>
                        <p>No transactions recorded yet</p>
                        <span>Create a new bill to begin selling</span>
                      </div>
                    </td>
                  </tr>
                ) : data.recent_bills.slice(0, 6).map(b => {
                  const pt = PAYMENT_META[b.payment_type] || { emoji: '💰', label: b.payment_type || 'Cash' };
                  return (
                    <tr key={b.id}>
                      <td>
                        <Link href={`/bills?search=${b.bill_number}`} style={{ fontWeight: 800, color: 'var(--primary)', fontSize: 13 }}>
                          {b.bill_number}
                        </Link>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            width: 26,
                            height: 26,
                            borderRadius: '50%',
                            background: 'var(--primary-light)',
                            color: 'var(--primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 11,
                            fontWeight: 700
                          }}>
                            {(b.customer_name?.[0] || 'C').toUpperCase()}
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>
                            {b.customer_name || <span style={{ color: 'var(--text-faint)' }}>Walk-in Customer</span>}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <span>{pt.emoji}</span>
                          <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>{pt.label}</span>
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${STATUS_BADGE[b.status] || 'badge-gray'}`}>
                          {b.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, fontSize: 13.5, color: 'var(--text-base)' }}>
                        ₹{fmt(b.total_amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Selling Products */}
        {!hideTopSelling && (
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Top Selling Stationery</div>
                <div className="card-sub">Ranked by units sold from paid invoices</div>
              </div>
            </div>
            <div style={{ padding: '12px 24px 20px' }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Loading top products...</div>
              ) : !data?.top_products?.length ? (
                <div className="empty-state" style={{ padding: 36 }}>
                  <div className="empty-state-icon"><IconBox size={22} /></div>
                  <p>No sales analytics yet</p>
                  <span>Completed bill sales will rank top items here</span>
                </div>
              ) : data.top_products.slice(0, 6).map((p, i) => {
                const rankColor = i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#b45309' : '#6366f1';
                const rankBg = i === 0 ? '#fef3c7' : i === 1 ? '#f1f5f9' : i === 2 ? '#fef3c7' : 'var(--primary-light)';

                return (
                  <div key={i} style={{ padding: '12px 0', borderBottom: i === data.top_products.length - 1 ? 'none' : '1px solid var(--border-light)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <div style={{
                          width: 24,
                          height: 24,
                          borderRadius: 6,
                          background: rankBg,
                          color: rankColor,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 11.5,
                          fontWeight: 800,
                          flexShrink: 0
                        }}>
                          {i + 1}
                        </div>
                        <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-base)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.name}
                        </span>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-base)' }}>
                          {p.total_sold} sold
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                          ₹{fmt(p.total_revenue)}
                        </div>
                      </div>
                    </div>
                    <MiniBar value={p.total_sold} max={maxSold} color={rankColor} />
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}
