import Layout from '@/components/Layout';
import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import SearchableSelect from '@/components/SearchableSelect';
import Pagination from '@/components/Pagination';
import TableLoader from '@/components/TableLoader';
import { useAuth } from '@/context/AuthContext';
import { useRole } from '@/hooks/useRole';
import { useRouter } from 'next/router';

const PAGE_SIZE = 15;

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

export default function StockTransfersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { isAdmin, hasAnyTransfers, canCreateTransfer, storePerms } = useRole();

  useEffect(() => {
    if (user && user.role !== 'admin' && !hasAnyTransfers) {
      router.replace('/dashboard');
    }
  }, [user, hasAnyTransfers, router]);

  // For non-admin: only show stores where user has 'transfers' permission
  function getPermittedStores(allStores) {
    if (isAdmin) return allStores;
    return allStores.filter(s => {
      const arr = storePerms[String(s.id)];
      return Array.isArray(arr) && arr.includes('transfers');
    });
  }

  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState([]);
  const [products, setProducts] = useState([]);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [batches, setBatches] = useState([]);

  // filters
  const [fFromStore, setFFromStore] = useState('');
  const [fToStore, setFToStore] = useState('');
  const [fSearch, setFSearch] = useState('');

  // form
  const [fromStoreId, setFromStoreId] = useState('');
  const [toStoreId, setToStoreId] = useState('');
  const [productId, setProductId] = useState('');
  const [variationId, setVariationId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [expiryDate, setExpiryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [storeStock, setStoreStock] = useState({});
  const [storeFlavorStock, setStoreFlavorStock] = useState({});

  const qtyRef = useRef(null);
  const notesRef = useRef(null);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (fFromStore) params.set('from_store', fFromStore);
    if (fToStore) params.set('to_store', fToStore);
    if (fSearch) params.set('q', fSearch);

    const [t, s, p] = await Promise.all([
      fetch(`/api/stock-transfers?${params}`).then(r => r.json()),
      fetch('/api/stores').then(r => r.json()),
      fetch('/api/products?slim=1').then(r => r.json()),
    ]);
    setTransfers(Array.isArray(t) ? t : []);
    const allStores = Array.isArray(s) ? s : [];
    setStores(allStores);
    setProducts(Array.isArray(p) ? p : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [fFromStore, fToStore, fSearch]);

  async function loadBatches(storeId, prodId, vId = null) {
    if (!storeId || !prodId) { setBatches([]); setExpiryDate(''); return; }
    let url = `/api/stock-items/batches?store_id=${storeId}&product_id=${prodId}`;
    if (vId) url += `&variation_id=${vId}`;

    const rows = await fetch(url).then(r => r.json());
    const list = Array.isArray(rows) ? rows : [];
    setBatches(list);
    setExpiryDate(list.length > 0 ? (list[0].expiry_date ?? '') : '');
  }

  async function loadFromStoreStock(sid) {
    if (!sid) { setStoreStock({}); setStoreFlavorStock({}); return; }
    const rows = await fetch(`/api/store-products?store_id=${sid}`).then(r => r.json());
    if (Array.isArray(rows)) {
      const map = {};
      const flavorMap = {};
      rows.forEach(r => {
        map[r.product_id] = Math.max(0, parseInt(r.stock) || 0);
        flavorMap[r.product_id] = r.flavor_stocks || [];
      });
      setStoreStock(map);
      setStoreFlavorStock(flavorMap);
    }
  }

  function getVarOptions(prod) {
    if (!prod) return [];
    const fpList = prod.flavor_prices || [];

    if (fpList.length > 0) {
      return fpList.map((fp, idx) => {
        const label = formatAttributesLabel(fp.attributes) || `Variation #${fp.id || idx + 1}`;
        return {
          key: String(fp.id || `var_${idx}`),
          variation_id: fp.id ? String(fp.id) : '',
          attributes: fp.attributes,
          label: label,
        };
      });
    }
    return [];
  }

  function handleProductSelect(val) {
    setProductId(val);
    const prod = products.find(p => String(p.id) === String(val));
    const opts = getVarOptions(prod);

    if (opts.length > 0) {
      const first = opts[0];
      setVariationId(first.variation_id);
      loadBatches(fromStoreId, val, first.variation_id);
    } else {
      setVariationId('');
      loadBatches(fromStoreId, val);
    }
  }

  function handleVarChange(vId, opts) {
    setVariationId(vId);
    loadBatches(fromStoreId, productId, vId);
  }

  function openModal() {
    setFromStoreId(''); setToStoreId(''); setProductId('');
    setVariationId('');
    setQuantity('1'); setExpiryDate(''); setNotes('');
    setBatches([]); setStoreStock({}); setStoreFlavorStock({});
    setModal(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!fromStoreId) return toast.error('Select source store.');
    if (!toStoreId) return toast.error('Select destination store.');
    if (!productId) return toast.error('Select a product.');
    if (parseInt(quantity) < 1) return toast.error('Quantity must be at least 1.');
    if (String(fromStoreId) === String(toStoreId)) return toast.error('Source and destination must differ.');

    setSaving(true);
    try {
      const res = await fetch('/api/stock-transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_store_id: fromStoreId,
          to_store_id: toStoreId,
          product_id: productId,
          variation_id: variationId || null,
          quantity: parseInt(quantity),
          expiry_date: expiryDate || null,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success(`${data.transfer_number} — transfer complete.`);
      setModal(false);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  const hasFilter = !!(fFromStore || fToStore || fSearch);
  function clearFilters() { setFFromStore(''); setFToStore(''); setFSearch(''); setPage(1); }

  const paged = transfers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Available qty for selected product+fromStore batch
  const selBatch = batches.find(b => (b.expiry_date ?? '') === expiryDate);
  const batchAvail = selBatch ? parseInt(selBatch.qty) : null;

  return (
    <Layout title="Stock Transfers">

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Stock Transfers ({transfers.length})</div>
            <div className="card-sub">Move stock between stores</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {hasFilter && <button className="btn btn-secondary btn-sm" onClick={clearFilters}>✕ Clear</button>}
            {canCreateTransfer && <button className="btn btn-primary" onClick={openModal}>+ New Transfer</button>}
          </div>
        </div>

        {/* ── Filters ── */}
        <div style={{ display: 'flex', gap: 12, padding: '12px 22px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ minWidth: 180 }}>
            <SearchableSelect
              options={getPermittedStores(stores).map(s => ({ value: s.id, label: s.name }))}
              value={fFromStore}
              onChange={v => { setFFromStore(v); setPage(1); }}
              placeholder="From Store"
            />
          </div>
          <div style={{ minWidth: 180 }}>
            <SearchableSelect
              options={stores.map(s => ({ value: s.id, label: s.name }))}
              value={fToStore}
              onChange={v => { setFToStore(v); setPage(1); }}
              placeholder="To Store"
            />
          </div>
          <input value={fSearch} onChange={e => { setFSearch(e.target.value); setPage(1); }}
            placeholder="Search transfer / product / store…"
            style={{ flex: '1 1 180px', minWidth: 0, padding: '7px 12px', border: '1.5px solid var(--border)', borderRadius: 6, fontSize: 13, background: 'var(--bg-input)', color: 'var(--text-base)' }}
          />
        </div>

        {/* ── Table ── */}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Transfer No.</th>
                <th>Product</th>
                <th>From Store</th>
                <th>To Store</th>
                <th>Qty</th>
                <th className="hide-mobile">Expiry</th>
                <th className="hide-mobile">By</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableLoader cols={9} />
              ) : transfers.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <div className="empty-state">
                      <div className="empty-state-icon">🔄</div>
                      <p>{hasFilter ? 'No transfers match your filters.' : 'No stock transfers yet.'}</p>
                    </div>
                  </td>
                </tr>
              ) : paged.map((t, i) => {
                const exp = t.expiry_date ? new Date(t.expiry_date) : null;
                const today = new Date(); today.setHours(0, 0, 0, 0);
                const soon = new Date(today); soon.setDate(today.getDate() + 30);
                const isExpired = exp && exp < today;
                const isSoon = exp && !isExpired && exp <= soon;
                const expColor = isExpired ? '#ef4444' : isSoon ? '#f59e0b' : '#10b981';
                const expLabel = exp ? exp.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : null;

                return (
                  <tr key={t.id}>
                    <td style={{ color: '#94a3b8', fontSize: 12 }}>{(page - 1) * PAGE_SIZE + i + 1}</td>
                    <td><strong style={{ color: '#6366f1' }}>{t.transfer_number}</strong></td>
                    <td style={{ fontWeight: 600 }}>
                      <div>{t.product_name}</div>
                      {(() => {
                        const formatted = formatAttributesLabel(t.variation_attributes);
                        if (formatted) {
                          const pairs = formatted.split(' · ');
                          return (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center', marginTop: 3 }}>
                              {pairs.map((pair, pIdx) => {
                                const parts = pair.split(': ');
                                const attrKey = parts[0];
                                const attrVal = parts.slice(1).join(': ');
                                return (
                                  <span key={pIdx} style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: '#334155',
                                    background: '#f1f5f9',
                                    border: '1px solid #cbd5e1',
                                    padding: '1px 6px',
                                    borderRadius: 4,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 2
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
                        const fName = t.flavor_name || '';
                        const uVal = (t.unit_value || '').trim();
                        const uName = t.unit_name || '';
                        let label = fName;
                        if (uVal && uName) {
                          label = fName ? `${fName} - ${uVal} ${uName}` : `${uVal} ${uName}`;
                        } else if (uVal) {
                          label = fName ? `${fName} - ${uVal}` : uVal;
                        }

                        return label ? (
                          <span style={{ display: 'inline-block', fontSize: 11, color: '#6366f1', background: 'rgba(99,102,241,.1)', padding: '1px 6px', borderRadius: 4, fontWeight: 700, marginTop: 2 }}>
                            {label}
                          </span>
                        ) : null;
                      })()}
                    </td>
                    <td><span className="badge badge-indigo">{t.from_store_name}</span></td>
                    <td><span className="badge badge-green">{t.to_store_name}</span></td>
                    <td><strong>{t.quantity}</strong></td>
                    <td className="hide-mobile">
                      {expLabel
                        ? <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 99, background: `${expColor}18`, color: expColor, fontWeight: 700, fontSize: 11, border: `1px solid ${expColor}40` }}>
                          {expLabel}{isExpired ? ' ⚠️' : isSoon ? ' ⚠️' : ''}
                        </span>
                        : <span style={{ color: '#94a3b8' }}>—</span>}
                    </td>
                    <td className="hide-mobile" style={{ fontSize: 12, color: '#6366f1', fontWeight: 600 }}>{t.created_by_name || '—'}</td>
                    <td style={{ fontSize: 12, color: '#94a3b8' }}>{new Date(t.created_at).toLocaleDateString('en-IN')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={transfers.length} pageSize={PAGE_SIZE} onChange={setPage} />
      </div>

      {/* ── New Transfer Modal ── */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <span className="modal-title">New Stock Transfer</span>
              <button className="modal-close" onClick={() => setModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* From Store */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>From Store</label>
                  <SearchableSelect
                    options={getPermittedStores(stores).map(s => ({ value: s.id, label: s.name }))}
                    value={fromStoreId}
                    onChange={v => {
                      setFromStoreId(v);
                      setProductId(''); setBatches([]); setExpiryDate('');
                      loadFromStoreStock(v);
                    }}
                    placeholder="— Select source store —"
                  />
                </div>

                {/* To Store — allow all stores as destination */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>To Store</label>
                  <SearchableSelect
                    options={stores.filter(s => String(s.id) !== String(fromStoreId)).map(s => ({ value: s.id, label: s.name }))}
                    value={toStoreId}
                    onChange={setToStoreId}
                    placeholder="— Select destination store —"
                  />
                </div>

                {/* Product */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Product</label>
                  <SearchableSelect
                    options={products.map(p => ({
                      value: p.id,
                      label: p.name,
                      sub: fromStoreId ? `Stock: ${Math.max(0, storeStock[p.id] ?? 0)}` : undefined,
                    }))}
                    value={productId}
                    onChange={handleProductSelect}
                    placeholder="— Select product —"
                  />
                </div>

                {/* Variation / Attributes selector */}
                {(() => {
                  const selProd = products.find(p => String(p.id) === String(productId));
                  if (!selProd) return null;
                  const varOptions = getVarOptions(selProd);
                  if (varOptions.length === 0) return null;

                  const flavorStocksList = storeFlavorStock[selProd.id] || [];

                  return (
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Variation *</label>
                      <select
                        value={variationId}
                        onChange={e => handleVarChange(e.target.value, varOptions)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1.5px solid #6366f1',
                          borderRadius: 6,
                          fontSize: 13,
                          background: 'var(--bg-input)',
                          color: 'var(--text-base)',
                          fontWeight: 600
                        }}
                      >
                        {varOptions.map(opt => {
                          const fs = flavorStocksList.find(item => {
                            if (opt.variation_id && item.variation_id && Number(item.variation_id) === Number(opt.variation_id)) return true;
                            if (opt.attributes && item.vari_attribute) {
                              const s1 = typeof opt.attributes === 'string' ? opt.attributes.trim() : JSON.stringify(opt.attributes);
                              const s2 = typeof item.vari_attribute === 'string' ? item.vari_attribute.trim() : JSON.stringify(item.vari_attribute);
                              return s1 === s2;
                            }
                            return false;
                          });
                          const vStock = Math.max(0, fs ? (parseInt(fs.stock) || 0) : 0);

                          return (
                            <option key={opt.key} value={opt.variation_id}>
                              {opt.label} {fromStoreId ? `(Stock: ${vStock})` : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  );
                })()}

                {/* Batch / Expiry */}
                {batches.length > 0 && (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Batch (Expiry)</label>
                    <select value={expiryDate} onChange={e => setExpiryDate(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', border: '1.5px solid var(--border)', borderRadius: 6, fontSize: 13, background: 'var(--bg-input)', color: 'var(--text-base)' }}>
                      {batches.map(b => {
                        const label = b.expiry_date
                          ? new Date(b.expiry_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                          : 'No expiry date';
                        return (
                          <option key={b.expiry_date ?? '__null__'} value={b.expiry_date ?? ''}>
                            {label} — {b.qty} units
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}

                {/* Qty + available */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Quantity</span>
                    {batchAvail !== null && (
                      <span style={{ fontWeight: 600, fontSize: 12, color: batchAvail > 0 ? '#10b981' : '#ef4444' }}>
                        Available: {batchAvail}
                      </span>
                    )}
                  </label>
                  <input
                    ref={qtyRef}
                    type="number" min="1"
                    max={batchAvail ?? undefined}
                    value={quantity}
                    onChange={e => setQuantity(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); notesRef.current?.focus(); } }}
                    style={{ border: batchAvail !== null && parseInt(quantity) > batchAvail ? '1.5px solid #ef4444' : undefined }}
                  />
                  {batchAvail !== null && parseInt(quantity) > batchAvail && (
                    <div style={{ fontSize: 11.5, color: '#ef4444', marginTop: 4, fontWeight: 600 }}>
                      ❌ Only {batchAvail} units available in this batch
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Notes (optional)</label>
                  <input ref={notesRef} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Reason for transfer…" />
                </div>

                {/* Summary */}
                {fromStoreId && toStoreId && productId && quantity > 0 && (
                  <div style={{ padding: '12px 16px', background: 'var(--bg-base)', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: 13 }}>
                    <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--text-base)' }}>Transfer Summary</div>
                    <div style={{ color: 'var(--text-muted)', lineHeight: 1.8 }}>
                      <span style={{ color: '#6366f1', fontWeight: 600 }}>{quantity}</span> unit(s) of{' '}
                      <strong>{products.find(p => String(p.id) === String(productId))?.name}</strong>
                      <br />
                      <span style={{ color: '#ef4444', fontWeight: 600 }}>{stores.find(s => String(s.id) === String(fromStoreId))?.name}</span>
                      {' → '}
                      <span style={{ color: '#10b981', fontWeight: 600 }}>{stores.find(s => String(s.id) === String(toStoreId))?.name}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Transferring…' : '🔄 Transfer Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
