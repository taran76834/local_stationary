import Layout from '@/components/Layout';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import SearchableSelect from '@/components/SearchableSelect';
import { useRole } from '@/hooks/useRole';
import toast from 'react-hot-toast';

function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
}

function formatAttributesLabel(attributes) {
  if (!attributes) return '';
  if (typeof attributes === 'string') {
    try { attributes = JSON.parse(attributes); } catch (e) { return attributes; }
  }
  if (typeof attributes !== 'object' || attributes === null) return String(attributes || '');
  const entries = Object.entries(attributes).filter(([k, v]) => Boolean(v));
  if (entries.length === 0) return '';
  return entries.map(([k, v]) => `${k}: ${v}`).join(' · ');
}

function ExpiryBadge({ dateStr }) {
  if (!dateStr) return <span className="badge badge-gray">No Expiry</span>;
  const days  = daysUntil(dateStr);
  const label = new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  if (days < 0)   return <span className="badge badge-red">Expired ({Math.abs(days)}d ago)</span>;
  if (days === 0) return <span className="badge badge-red">Expires Today</span>;
  if (days <= 7)  return <span className="badge badge-red">{label} · {days}d left</span>;
  if (days <= 30) return <span className="badge badge-amber">{label} · {days}d left</span>;
  if (days <= 90) return <span className="badge badge-blue">{label} · {days}d left</span>;
  return <span className="badge badge-green">{label}</span>;
}

const EXPIRY_FILTERS = [
  { key: '',        label: 'All'              },
  { key: 'soon',    label: '⚠️ Expiring ≤30d' },
  { key: '7',       label: '🔴 ≤7 days'       },
  { key: '15',      label: '🟠 ≤15 days'      },
  { key: 'none',    label: 'No Expiry'        },
];

export default function StockItemsPage() {
  const router    = useRouter();
  const { canEditStock, isAdmin, assignedStores, hasStoreAccess, isSales, storePerms, isPlusForStore } = useRole();

  // Sales users cannot view sold items — enforce available-only status
  const salesRestrictedStatus = isSales;

  const [items,    setItems]    = useState([]);
  const [stores,   setStores]   = useState([]);
  const [products, setProducts] = useState([]);
  const [loading,  setLoading]  = useState(false);

  // All users (including sales) see all stores in the filter
  const availableStores = stores;

  const [filterStore,   setFilterStore]   = useState('');
  const [filterProduct, setFilterProduct] = useState('');
  const [filterStatus,  setFilterStatus]  = useState(() => {
    if (typeof window === 'undefined') return 'available';
    const p = new URLSearchParams(window.location.search);
    return p.get('status') || 'available';
  });

  // Keep sales users locked to available-only — reset if they somehow get a different status
  useEffect(() => {
    if (salesRestrictedStatus && filterStatus !== 'available' && filterStatus !== 'expired') {
      setFilterStatus('available');
    }
  }, [salesRestrictedStatus, filterStatus]);
  const [filterExpiry,  setFilterExpiry]  = useState(() => {
    if (typeof window === 'undefined') return '';
    const p = new URLSearchParams(window.location.search);
    return p.get('expiring_soon') === '1' ? 'soon' : '';
  });

  // Add stock modal
  const [addModal,        setAddModal]        = useState(false);
  const [addStore,        setAddStore]        = useState('');
  const [addProduct,      setAddProduct]      = useState('');
  const [addVariationId,  setAddVariationId]  = useState('');
  const [addQty,          setAddQty]          = useState(1);
  const [addExpiry,       setAddExpiry]       = useState('');
  const [addSaving,       setAddSaving]       = useState(false);

  // Inline edit expiry
  const [editRow,     setEditRow]     = useState(null);
  const [editExpiry,  setEditExpiry]  = useState('');
  const [editSaving,  setEditSaving]  = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (router.isReady) {
      if (router.query.expiring_soon === '1') setFilterExpiry('soon');
      if (router.query.status) setFilterStatus(router.query.status);
    }
  }, [router.isReady, router.query.expiring_soon, router.query.status]);

  async function loadMeta() {
    const [s, p] = await Promise.all([
      fetch('/api/stores').then(r => r.json()).catch(() => []),
      fetch('/api/products?slim=1').then(r => r.json()).catch(() => []),
    ]);
    setStores(Array.isArray(s) ? s : []);
    setProducts(Array.isArray(p) ? p : []);
  }

  async function loadItems() {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterStore)   params.set('store_id',   filterStore);
    if (filterProduct) params.set('product_id', filterProduct);
    if (filterStatus === 'expired') {
      // "Expired" status = available items whose expiry date has passed
      params.set('status', 'available');
      params.set('expired', '1');
    } else {
      if (filterStatus) params.set('status', filterStatus);
    }
    if (filterExpiry === 'soon' || filterExpiry === '7' || filterExpiry === '15')
      params.set('expiring_soon', '1');
    try {
      const r = await fetch(`/api/stock-items?${params}`);
      const data = await r.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('stock-items load error:', err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadMeta(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadItems(); }, [filterStore, filterProduct, filterStatus, filterExpiry]);

  const displayed = items.filter(item => {
    if (!filterExpiry || filterExpiry === 'soon') return true;
    const days = daysUntil(item.expiry_date);
    if (filterExpiry === '7')       return days !== null && days >= 0 && days <= 7;
    if (filterExpiry === '15')      return days !== null && days >= 0 && days <= 15;
    if (filterExpiry === 'expired') return days !== null && days < 0;
    if (filterExpiry === 'none')    return item.expiry_date === null;
    return true;
  });

  const counts = {
    soon:    items.filter(i => { const d = daysUntil(i.expiry_date); return d !== null && d >= 0 && d <= 30; }).reduce((s, i) => s + Number(i.qty), 0),
    expired: items.filter(i => { const d = daysUntil(i.expiry_date); return d !== null && d < 0; }).reduce((s, i) => s + Number(i.qty), 0),
  };

  function resetFilters() {
    setFilterStore('');
    setFilterProduct('');
    setFilterStatus('available');
    setFilterExpiry('');
  }
  const hasActiveFilter = filterStore || filterProduct || filterStatus !== 'available' || filterExpiry;

  // ── Add stock ──
  function openAdd() {
    setAddStore(''); setAddProduct(''); setAddVariationId(''); setAddQty(1); setAddExpiry('');
    setAddModal(true);
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!addStore || !addProduct) { toast.error('Select a store and product.'); return; }
    if (parseInt(addQty) > 2000) { toast.error('Quantity cannot exceed 2,000 units.'); return; }
    if (parseInt(addQty) < 1)     { toast.error('Quantity must be at least 1.'); return; }
    setAddSaving(true);
    try {
      const res  = await fetch('/api/stock-items', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          store_id: addStore,
          product_id: addProduct,
          variation_id: addVariationId || null,
          quantity: addQty,
          expiry_date: addExpiry || null
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success(data.message);
      setAddModal(false);
      loadItems();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAddSaving(false);
    }
  }

  // ── Edit expiry ──
  function startEdit(row) {
    setEditRow(row);
    setEditExpiry(row.expiry_date ? row.expiry_date.split('T')[0] : '');
  }

  async function saveExpiry() {
    setEditSaving(true);
    try {
      const res  = await fetch('/api/stock-items', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          store_id:     editRow.store_id,
          product_id:   editRow.product_id,
          variation_id: editRow.variation_id || null,
          old_expiry:   editRow.expiry_date ? editRow.expiry_date.split('T')[0] : null,
          status:       editRow.status,
          new_expiry:   editExpiry || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success('Expiry date updated.');
      setEditRow(null);
      loadItems();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setEditSaving(false);
    }
  }

  // ── Remove group ──
  async function handleRemove(row) {
    const varLabel = formatAttributesLabel(row.variation_attributes);
    const varText  = varLabel ? ` (${varLabel})` : '';
    if (!confirm(`Remove all ${row.qty} unit(s) of "${row.product_name}${varText}" from ${row.store_name}?`)) return;
    try {
      const res  = await fetch('/api/stock-items', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          store_id:     row.store_id,
          product_id:   row.product_id,
          variation_id: row.variation_id || null,
          expiry_date:  row.expiry_date ? row.expiry_date.split('T')[0] : null,
          status:       row.status,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success(data.message);
      loadItems();
    } catch (err) {
      toast.error(err.message);
    }
  }

  const rowKey = r => `${r.product_id}-${r.variation_id || 'novar'}-${r.store_id}-${r.expiry_date}-${r.status}`;

  return (
    <Layout title="Stock & Expiry" subtitle="Per-unit stock with expiry tracking">

      {/* Alert bars */}
      {!loading && counts.expired > 0 && (
        <div style={{ background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 10, padding: '11px 18px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, color: '#ef4444' }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span style={{ flex: 1 }}><strong>{counts.expired} unit{counts.expired > 1 ? 's' : ''} EXPIRED</strong> — remove from stock immediately</span>
          <button className="btn btn-sm" style={{ background: '#dc2626', color: '#fff', border: 'none' }} onClick={() => { setFilterStatus('available'); setFilterExpiry('expired'); }}>Show Expired</button>
        </div>
      )}
      {!loading && counts.soon > 0 && counts.expired === 0 && (
        <div style={{ background: 'rgba(245,158,11,.12)', border: '1px solid rgba(245,158,11,.35)', borderRadius: 10, padding: '11px 18px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, color: '#f59e0b' }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <span style={{ flex: 1 }}><strong>{counts.soon} unit{counts.soon > 1 ? 's' : ''} expiring within 30 days</strong></span>
          <button className="btn btn-sm" style={{ background: '#f59e0b', color: '#fff', border: 'none' }} onClick={() => setFilterExpiry('soon')}>Show Expiring</button>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Stock Units ({displayed.reduce((s, i) => s + Number(i.qty), 0)}{displayed.length !== items.length ? ` of ${items.reduce((s, i) => s + Number(i.qty), 0)}` : ''})</div>
            <div className="card-sub">Grouped by product · store · expiry date</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {hasActiveFilter && <button className="btn btn-secondary btn-sm" onClick={resetFilters}>✕ Clear Filters</button>}
            {isAdmin && <button className="btn btn-primary" onClick={openAdd}>+ Add Stock</button>}
          </div>
        </div>

        {/* Filters */}
        <div className="filter-row" style={{ padding: '14px 22px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 150 }}>
              <SearchableSelect options={availableStores.map(s => ({ value: s.id, label: s.name }))} value={filterStore} onChange={setFilterStore} placeholder={isAdmin ? "All Stores" : "All Stores"} />
            </div>
            <div style={{ flex: 1, minWidth: 150 }}>
              <SearchableSelect options={products.map(p => ({ value: p.id, label: p.name }))} value={filterProduct} onChange={setFilterProduct} placeholder="All Products" />
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {/* Sales users only see Available & Expired — no Sold or All */}
              {(isSales
                ? [{ v: 'available', label: 'Available' }, { v: 'expired', label: 'Expired' }]
                : [{ v: 'available', label: 'Available' }, { v: 'oversold', label: 'Oversold' }, { v: 'sold', label: 'Sold' }, { v: 'expired', label: 'Expired' }, { v: '', label: 'All' }]
              ).map(({ v, label }) => (
                <button key={v} onClick={() => { setFilterStatus(v); setFilterExpiry(''); }} className={`btn btn-sm ${filterStatus === v ? 'btn-primary' : 'btn-secondary'}`}>{label}</button>
              ))}
            </div>
          </div>
          {filterStatus !== 'expired' && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, marginRight: 4 }}>EXPIRY:</span>
              {EXPIRY_FILTERS.map(({ key, label }) => {
                const isActive = filterExpiry === key;
                let activeStyle = {};
                if (isActive && key === 'soon')  activeStyle = { background: '#f59e0b', color: '#fff', borderColor: '#f59e0b' };
                else if (isActive && key === '7') activeStyle = { background: '#ef4444', color: '#fff', borderColor: '#ef4444' };
                else if (isActive && key === '15') activeStyle = { background: '#f97316', color: '#fff', borderColor: '#f97316' };
                else if (isActive)                activeStyle = { background: '#6366f1', color: '#fff', borderColor: '#6366f1' };
                return (
                  <button key={key} onClick={() => setFilterExpiry(key)} className="btn btn-sm btn-secondary" style={isActive ? activeStyle : {}}>
                    {label}
                    {key === 'soon' && counts.soon > 0 && <span style={{ marginLeft: 5, background: isActive ? 'rgba(255,255,255,.3)' : '#fef3c7', color: isActive ? '#fff' : '#92400e', borderRadius: 10, padding: '1px 6px', fontSize: 11, fontWeight: 700 }}>{counts.soon}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Table */}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Product</th>
                <th>Variation</th>
                <th>Store</th>
                <th>Qty</th>
                <th>Expiry Date</th>
                {!isSales && <th>Status</th>}
                <th>Added</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={isAdmin ? (isSales ? 7 : 8) : (isSales ? 6 : 7)} style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>Loading…</td></tr>
              ) : displayed.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? (isSales ? 7 : 8) : (isSales ? 6 : 7)}>
                    <div className="empty-state">
                      <div className="empty-state-icon">📦</div>
                      <p>No stock items found</p>
                      <span>{hasActiveFilter ? 'Try adjusting your filters.' : 'Receive a product receipt to add stock.'}</span>
                    </div>
                  </td>
                </tr>
              ) : displayed.map((item, i) => {
                const days  = daysUntil(item.expiry_date);
                const rowBg = days !== null && days < 0 ? 'rgba(239,68,68,.04)' : days !== null && days <= 7 ? 'rgba(239,68,68,.03)' : days !== null && days <= 30 ? 'rgba(245,158,11,.03)' : 'transparent';
                const isEditing = editRow && rowKey(editRow) === rowKey(item);

                return (
                  <tr key={rowKey(item)} style={{ opacity: item.status !== 'available' ? .6 : 1, background: rowBg }}>
                    <td style={{ color: '#94a3b8', fontSize: 12 }}>{i + 1}</td>
                    <td><strong style={{ fontSize: 13 }}>{item.product_name}</strong></td>
                    <td>
                      {(() => {
                        const formatted = formatAttributesLabel(item.variation_attributes);
                        if (formatted) {
                          const pairs = formatted.split(' · ');
                          return (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                              {pairs.map((pair, pIdx) => {
                                const parts = pair.split(': ');
                                const attrKey = parts[0];
                                const attrVal = parts.slice(1).join(': ');
                                return (
                                  <span key={pIdx} style={{
                                    fontSize: 11.5,
                                    fontWeight: 600,
                                    color: '#334155',
                                    background: '#f1f5f9',
                                    border: '1px solid #cbd5e1',
                                    padding: '2px 8px',
                                    borderRadius: 4,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 3
                                  }}>
                                    {attrVal ? (
                                      <>
                                        <span style={{ color: '#0284c7', fontWeight: 700 }}>{attrKey}:</span>
                                        <span>{attrVal}</span>
                                      </>
                                    ) : (
                                      <span>{pair}</span>
                                    )}
                                  </span>
                                );
                              })}
                            </div>
                          );
                        }
                        if (item.variation_id) {
                          return (
                            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#0284c7', background: '#e0f2fe', border: '1px solid #bae6fd', padding: '2px 8px', borderRadius: 4 }}>
                              Variation #{item.variation_id}
                            </span>
                          );
                        }
                        return (
                          <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>
                        );
                      })()}
                    </td>
                    <td><span className="badge badge-indigo">{item.store_name}</span></td>
                    <td>
                      <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-base)' }}>{item.qty}</span>
                      <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 3 }}>units</span>
                    </td>
                    <td>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input
                            type="date"
                            value={editExpiry}
                            onChange={e => setEditExpiry(e.target.value)}
                            style={{ padding: '4px 8px', fontSize: 12, borderRadius: 5, border: '1.5px solid #6366f1', width: 140 }}
                            autoFocus
                          />
                          <button className="btn btn-primary btn-xs" onClick={saveExpiry} disabled={editSaving}>
                            {editSaving ? '…' : '✓'}
                          </button>
                          <button className="btn btn-secondary btn-xs" onClick={() => setEditRow(null)}>✕</button>
                        </div>
                      ) : (
                        <ExpiryBadge dateStr={item.expiry_date} />
                      )}
                    </td>
                    {!isSales && (
                      <td>
                        <span className={`badge ${item.status === 'available' ? 'badge-green' : item.status === 'oversold' ? 'badge-red' : item.status === 'sold' ? 'badge-gray' : 'badge-red'}`}>
                          {item.status}
                        </span>
                      </td>
                    )}
                    <td style={{ fontSize: 12, color: '#94a3b8' }}>
                      {new Date(item.created_at).toLocaleDateString()}
                    </td>
                    {isAdmin && (
                      <td>
                        <div style={{ display: 'flex', gap: 5 }}>
                          <button
                            className="btn btn-secondary btn-xs"
                            onClick={() => isEditing ? setEditRow(null) : startEdit(item)}
                            title="Edit expiry date"
                          >
                            ✏️
                          </button>
                          <button
                            className="btn btn-danger btn-xs"
                            onClick={() => handleRemove(item)}
                            title="Remove from stock"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Add Stock Modal ── */}
      {addModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setAddModal(false)}>
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <span className="modal-title">Add Stock</span>
              <button className="modal-close" onClick={() => setAddModal(false)}>×</button>
            </div>
            <form onSubmit={handleAdd}>
              <div className="modal-body">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="form-group">
                    <label>Store *</label>
                    <SearchableSelect options={availableStores.map(s => ({ value: s.id, label: s.name }))} value={addStore} onChange={setAddStore} placeholder="— Select Store —" />
                  </div>
                  <div className="form-group">
                    <label>Product *</label>
                    <SearchableSelect
                      options={products.map(p => ({ value: p.id, label: p.name }))}
                      value={addProduct}
                      onChange={val => {
                        setAddProduct(val);
                        const prod = products.find(p => String(p.id) === String(val));
                        if (prod) {
                          const fpList = prod.flavor_prices || [];
                          if (fpList.length > 0) {
                            setAddVariationId(String(fpList[0].id));
                          } else {
                            setAddVariationId('');
                          }
                        }
                      }}
                      placeholder="— Select Product —"
                    />
                  </div>
                  {(() => {
                    const selProd = products.find(p => String(p.id) === String(addProduct));
                    if (!selProd) return null;

                    const fpList = selProd.flavor_prices || [];
                    if (fpList.length === 0) return null;

                    return (
                      <div className="form-group">
                        <label>Variation *</label>
                        <select
                          value={addVariationId}
                          onChange={e => setAddVariationId(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: 6,
                            border: '1.5px solid #6366f1',
                            background: 'var(--bg-input)',
                            color: 'var(--text-base)',
                            fontWeight: 600,
                            fontSize: 13
                          }}
                        >
                          {fpList.map(fp => (
                            <option key={fp.id} value={fp.id}>
                              {formatAttributesLabel(fp.attributes) || `Variation #${fp.id}`}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })()}
                  <div className="form-group">
                    <label>Quantity *</label>
                    <input
                      type="number"
                      min="1"
                      max="2000"
                      value={addQty}
                      onChange={e => {
                        const v = parseInt(e.target.value) || 0;
                        if (v > 2000) { toast.error('Max 2,000 units allowed.'); return; }
                        setAddQty(e.target.value);
                      }}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Expiry Date <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span></label>
                    <input type="date" value={addExpiry} onChange={e => setAddExpiry(e.target.value)} />
                    <span style={{ fontSize: 11.5, color: '#94a3b8' }}>All {addQty || 1} unit(s) will share this expiry date.</span>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={addSaving}>{addSaving ? 'Adding…' : 'Add to Stock'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
