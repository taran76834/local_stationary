import Layout from '@/components/Layout';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import SearchableSelect from '@/components/SearchableSelect';
import { useRole } from '@/hooks/useRole';
import Pagination from '@/components/Pagination';
import TableLoader from '@/components/TableLoader';
import {
  IconTruck, IconBox, IconStore, IconFactory,
  IconCalendar, IconEdit, IconTrash, IconEye,
  IconPlus, IconRefresh, IconSearch, IconReceipt,
} from '@/components/Icons';

function parseVariationAttributes(attributes) {
  if (!attributes) return [];
  if (typeof attributes === 'string') {
    try {
      const parsed = JSON.parse(attributes);
      if (typeof parsed === 'object' && parsed !== null) {
        return Object.entries(parsed)
          .filter(([_, v]) => v !== undefined && v !== null && String(v).trim() !== '')
          .map(([k, v]) => `${k}: ${v}`);
      }
    } catch (e) {
      if (attributes.includes(',')) {
        return attributes.split(',').map(s => s.trim()).filter(Boolean);
      }
      return [attributes.trim()];
    }
  }
  if (typeof attributes === 'object' && attributes !== null) {
    return Object.entries(attributes)
      .filter(([_, v]) => v !== undefined && v !== null && String(v).trim() !== '')
      .map(([k, v]) => `${k}: ${v}`);
  }
  return [String(attributes)];
}

function renderVariationLines(item, isSmall = false) {
  const raw = item.vari_attribute || item.variation_attributes;
  let list = parseVariationAttributes(raw);
  if (list.length === 0 && item.flavor_name) {
    list = [`${item.flavor_name}${item.unit_value && item.unit_name ? ` - ${item.unit_value} ${item.unit_name}` : (item.unit_value ? ` - ${item.unit_value}` : '')}`];
  }

  if (list.length === 0) {
    return <span style={{ color: '#94a3b8', fontSize: isSmall ? 11 : 12 }}>—</span>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isSmall ? 2 : 4, alignItems: 'flex-start' }}>
      {list.map((attr, idx) => (
        <span
          key={idx}
          style={{
            display: 'inline-block',
            fontSize: isSmall ? 10.5 : 11.5,
            fontWeight: 600,
            color: '#6366f1',
            background: 'rgba(99,102,241,.12)',
            padding: isSmall ? '1.5px 6px' : '2.5px 8px',
            borderRadius: 4,
            whiteSpace: 'nowrap',
            lineHeight: 1.3,
          }}
        >
          {attr}
        </span>
      ))}
    </div>
  );
}

function formatAttributesLabel(attributes) {
  const list = parseVariationAttributes(attributes);
  return list.join(', ');
}

// ── Product search-to-add input ───────────────────────────────────────────────
function ProductSearchAdd({ products, onAdd, inputRef }) {
  const [query, setQuery] = useState('');
  const [suggs, setSuggs] = useState([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0, showAbove: false });
  const wrapRef = useRef(null);
  const dropRef = useRef(null);
  const listRef = useRef(null);

  function calcPos() {
    if (!wrapRef.current) return;
    const r = wrapRef.current.getBoundingClientRect();
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
    const spaceBelow = viewportHeight - r.bottom;
    const showAbove = spaceBelow < 250 && r.top > 250;
    setDropPos({
      top: showAbove ? (r.top + (typeof window !== 'undefined' ? window.scrollY : 0) - 4) : (r.bottom + (typeof window !== 'undefined' ? window.scrollY : 0) + 4),
      left: r.left + (typeof window !== 'undefined' ? window.scrollX : 0),
      width: r.width,
      showAbove,
    });
  }

  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (!q) { setSuggs([]); setOpen(false); return; }

    const matched = [];
    for (const p of products) {
      const nameMatch = p.name.toLowerCase().includes(q);
      const barcodeMatch = p.barcode && p.barcode.toLowerCase().includes(q);
      const hasVars = p.flavor_prices && p.flavor_prices.length > 0;

      if (hasVars) {
        let anyVarMatched = false;
        for (const vp of p.flavor_prices) {
          const attrLabel = formatAttributesLabel(vp.attributes);
          const varBarcodeMatch = vp.barcode && vp.barcode.toLowerCase().includes(q);
          const varLabelMatch = attrLabel.toLowerCase().includes(q);

          if (nameMatch || barcodeMatch || varBarcodeMatch || varLabelMatch) {
            anyVarMatched = true;
            const pVal = (vp.sale_price && parseFloat(vp.sale_price) > 0) ? vp.sale_price : (vp.price || p.price);
            matched.push({
              key: `${p.id}_${vp.id}`,
              product: p,
              variation: vp,
              name: `${p.name} — ${attrLabel || `Variation #${vp.id}`}`,
              barcode: vp.barcode || p.barcode || '',
              price: pVal,
              variation_id: String(vp.id),
              vari_attribute: attrLabel,
            });
          }
        }
        if (!anyVarMatched && (nameMatch || barcodeMatch)) {
          for (const vp of p.flavor_prices) {
            const attrLabel = formatAttributesLabel(vp.attributes);
            const pVal = (vp.sale_price && parseFloat(vp.sale_price) > 0) ? vp.sale_price : (vp.price || p.price);
            matched.push({
              key: `${p.id}_${vp.id}`,
              product: p,
              variation: vp,
              name: `${p.name} — ${attrLabel || `Variation #${vp.id}`}`,
              barcode: vp.barcode || p.barcode || '',
              price: pVal,
              variation_id: String(vp.id),
              vari_attribute: attrLabel,
            });
          }
        }
      } else if (nameMatch || barcodeMatch) {
        matched.push({
          key: String(p.id),
          product: p,
          variation: null,
          name: p.name,
          barcode: p.barcode || '',
          price: p.price,
          variation_id: null,
          vari_attribute: null,
        });
      }
      if (matched.length >= 15) break;
    }

    setSuggs(matched);
    setActiveIdx(-1);
    calcPos();
    setOpen(matched.length > 0);
  }, [query, products]);

  useEffect(() => {
    if (!open) return;
    const h = () => calcPos();
    window.addEventListener('scroll', h, true); window.addEventListener('resize', h);
    return () => { window.removeEventListener('scroll', h, true); window.removeEventListener('resize', h); };
  }, [open]);

  useEffect(() => {
    function onDown(e) {
      if (wrapRef.current?.contains(e.target) || dropRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  // Scroll active item into view
  useEffect(() => {
    if (activeIdx < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll('[data-product-sugg]');
    items[activeIdx]?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  function pick(item) {
    onAdd(item); setQuery(''); setSuggs([]); setOpen(false); setActiveIdx(-1);
    setTimeout(() => inputRef?.current?.focus(), 50);
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Escape') {
      e.stopPropagation();
    }
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, suggs.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); const t = activeIdx >= 0 ? suggs[activeIdx] : suggs[0]; if (t) pick(t); }
    else if (e.key === 'Escape') { setOpen(false); setActiveIdx(-1); }
  }

  const dropdown = open && suggs.length > 0 && createPortal(
    <div
      ref={dropRef}
      style={{
        position: 'absolute',
        top: dropPos.top,
        left: dropPos.left,
        width: dropPos.width,
        transform: dropPos.showAbove ? 'translateY(-100%)' : 'none',
        zIndex: 99999,
        background: 'var(--bg-card)',
        border: '1.5px solid var(--border)',
        borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0,0,0,.2)',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '6px 12px', fontSize: 11, color: 'var(--text-faint)', fontWeight: 600, textTransform: 'uppercase', borderBottom: '1px solid var(--border-light)' }}>
        {suggs.length} item{suggs.length > 1 ? 's' : ''} found
      </div>
      <div ref={listRef} style={{ maxHeight: 240, overflowY: 'auto' }}>
        {suggs.map((item, idx) => {
          const isActive = idx === activeIdx;
          return (
            <div
              key={item.key || idx}
              data-product-sugg
              onMouseDown={() => pick(item)}
              onMouseEnter={() => setActiveIdx(idx)}
              style={{
                padding: '9px 14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: isActive ? 'rgba(99,102,241,.12)' : 'transparent',
                borderLeft: `3px solid ${isActive ? '#6366f1' : 'transparent'}`,
                borderBottom: '1px solid var(--border-light)',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-base)' }}>{item.name}</div>
                <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 1 }}>{item.barcode ? `${item.barcode} · ` : ''}₹{parseFloat(item.price || 0).toFixed(2)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>,
    document.body
  );

  return (
    <div ref={wrapRef} style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', background: 'var(--bg-base)', border: '1.5px solid var(--border)', borderRadius: 8 }}
        onFocusCapture={e => e.currentTarget.style.borderColor = '#6366f1'}
        onBlurCapture={e => e.currentTarget.style.borderColor = 'var(--border)'}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
        <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={onKeyDown}
          onFocus={() => { if (suggs.length > 0) { calcPos(); setOpen(true); } }}
          placeholder="Type product name or barcode, press Enter to add…"
          autoComplete="off"
          style={{ flex: 1, fontSize: 13, border: 'none', background: 'transparent', outline: 'none', color: 'var(--text-base)' }}
        />
        {query && <button type="button" onClick={() => { setQuery(''); setSuggs([]); setOpen(false); inputRef?.current?.focus(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>}
      </div>
      {typeof document !== 'undefined' && dropdown}
    </div>
  );
}


const PAGE_SIZE = 10;
const STATUS_BADGE = { draft: 'badge-amber', ordered: 'badge-blue', received: 'badge-green', cancelled: 'badge-red' };
const STATUS_LABELS = { draft: 'Draft', ordered: 'Pending Receipt', received: 'Received & Approved', cancelled: 'Cancelled' };

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

// ── Purchase Order / Product Receipt Hover Preview Popup ───────────────────────
function OrderHoverPopup({ orderId, pos, cache, onMouseEnter, onMouseLeave }) {
  if (!pos) return null;
  const detail = cache[orderId];

  const popupWidth = 580;
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1000;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;

  // Position to left of eye icon if fits, otherwise to the right
  let leftPos = (pos.rectLeft || 0) + (typeof window !== 'undefined' ? window.scrollX : 0) - popupWidth - 12;
  if (leftPos < 12) {
    leftPos = (pos.rectRight || 0) + (typeof window !== 'undefined' ? window.scrollX : 0) + 12;
  }
  leftPos = Math.max(12, Math.min(leftPos, viewportWidth - popupWidth - 12));

  const popupEstHeight = detail ? Math.min(380, 140 + (detail.items?.length || 0) * 40) : 160;
  const spaceBelow = viewportHeight - (pos.rectTop || 0);
  const showAbove = spaceBelow < popupEstHeight && (pos.rectBottom || 0) > popupEstHeight;
  const topPos = showAbove
    ? Math.max(10, (pos.rectBottom || 0) + (typeof window !== 'undefined' ? window.scrollY : 0) - popupEstHeight)
    : Math.max(10, pos.top);

  return createPortal(
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: 'absolute',
        top: topPos,
        left: leftPos,
        width: popupWidth,
        maxWidth: '92vw',
        zIndex: 99999,
        background: 'var(--bg-card)',
        border: '1.5px solid var(--border)',
        borderRadius: 12,
        boxShadow: '0 12px 36px rgba(0,0,0,.22), 0 2px 8px rgba(0,0,0,.1)',
        padding: '16px 18px',
        fontSize: 13,
        color: 'var(--text-base)',
        animation: 'popIn 0.15s ease-out',
      }}
    >
      <style>{`
        @keyframes popIn {
          from { opacity: 0; transform: translateY(-4px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes popSpinner {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      {!detail ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 0', gap: 10, color: '#6366f1' }}>
          <div style={{ width: 20, height: 20, border: '2.5px solid #6366f1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'popSpinner 0.6s linear infinite' }} />
          <span style={{ fontSize: 13.5, fontWeight: 600 }}>Loading receipt details…</span>
        </div>
      ) : (
        <>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed var(--border)', paddingBottom: 10, marginBottom: 10 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#6366f1' }}>{detail.order_number}</div>
              <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>
                {formatISTDateTime(detail.ordered_at)}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {detail.store_name && <span className="badge badge-indigo" style={{ fontSize: 11, padding: '3px 8px' }}>{detail.store_name}</span>}
              <span className={`badge ${STATUS_BADGE[detail.status]}`} style={{ fontSize: 11, padding: '3px 8px' }}>{STATUS_LABELS[detail.status]}</span>
            </div>
          </div>

          {/* Supplier & Creator */}
          {(detail.supplier_name || detail.created_by_name) && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, background: 'var(--bg-base)', padding: '6px 12px', borderRadius: 8, marginBottom: 10, border: '1px solid var(--border-light)' }}>
              <div>
                <span style={{ color: '#94a3b8' }}>Supplier: </span>
                <span style={{ fontWeight: 600 }}>{detail.supplier_name || '—'}</span>
              </div>
              {detail.created_by_name && (
                <div>
                  <span style={{ color: '#94a3b8' }}>By: </span>
                  <span style={{ fontWeight: 600, color: '#6366f1' }}>{detail.created_by_name}</span>
                </div>
              )}
            </div>
          )}

          {/* Products Received */}
          <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', color: '#94a3b8', marginBottom: 6 }}>
            Products Received ({detail.items?.length || 0})
          </div>
          <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid var(--border-light)', borderRadius: 8, marginBottom: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                  <th style={{ padding: '7px 10px', textAlign: 'left' }}>Product</th>
                  <th style={{ padding: '7px 10px', textAlign: 'left' }}>Variation</th>
                  <th style={{ padding: '7px 10px', textAlign: 'center', width: 60 }}>Qty</th>
                  <th style={{ padding: '7px 10px', textAlign: 'right', width: 95 }}>Unit Cost</th>
                  <th style={{ padding: '7px 10px', textAlign: 'right', width: 100 }}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {(!detail.items || detail.items.length === 0) ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '12px', textAlign: 'center', color: '#94a3b8' }}>No items in this receipt.</td>
                  </tr>
                ) : (
                  detail.items.map((item, idx) => {
                    const varText = formatAttributesLabel(item.vari_attribute) || formatAttributesLabel(item.variation_attributes) || (item.flavor_name ? `${item.flavor_name}${item.unit_value && item.unit_name ? ` - ${item.unit_value} ${item.unit_name}` : (item.unit_value ? ` - ${item.unit_value}` : '')}` : '');
                    const expLabel = item.expiry_date ? new Date(item.expiry_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : null;
                    const subtotalVal = parseFloat(item.subtotal || (parseFloat(item.quantity || 0) * parseFloat(item.unit_cost || 0)));

                    return (
                      <tr key={idx} style={{ borderBottom: idx < detail.items.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                        <td style={{ padding: '7px 10px', fontWeight: 600 }}>
                          <div style={{ color: 'var(--text-base)', lineHeight: 1.3 }}>{item.product_name}</div>
                          {expLabel && (
                            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                              Exp: {expLabel}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '7px 10px' }}>
                          {renderVariationLines(item, true)}
                        </td>
                        <td style={{ padding: '7px 10px', textAlign: 'center', fontWeight: 700, color: 'var(--text-base)' }}>{item.quantity}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', color: '#64748b', fontWeight: 500 }}>₹{parseFloat(item.unit_cost).toFixed(2)}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, color: '#6366f1' }}>₹{subtotalVal.toFixed(2)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Totals */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed var(--border)', paddingTop: 8 }}>
            {detail.notes ? (
              <span style={{ fontSize: 11.5, color: '#94a3b8', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280 }}>
                Notes: {detail.notes}
              </span>
            ) : <span />}
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-base)' }}>Total: ₹{parseFloat(detail.total_amount).toFixed(2)}</span>
            </div>
          </div>
        </>
      )}
    </div>,
    document.body
  );
}

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [stores, setStores] = useState([]);
  const [modal, setModal] = useState(false);
  const [detail, setDetail] = useState(null);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchText, setSearchText] = useState('');
  const [filterStore, setFilterStore] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [dateFrom, setDateFrom] = useState('');

  // ── Hover preview state ──────────────────────────────────────────────
  const [hoveredOrder, setHoveredOrder] = useState(null);
  const [orderCache, setOrderCache] = useState({});
  const hoverTimerRef = useRef(null);
  const activeOrderIdRef = useRef(null);
  const isOverPopoverRef = useRef(false);

  function handleEyeHoverStart(e, order) {
    activeOrderIdRef.current = order.id;
    clearTimeout(hoverTimerRef.current);

    const rect = e.currentTarget.getBoundingClientRect();
    const pos = {
      top: rect.top + window.scrollY,
      left: Math.max(12, rect.left + window.scrollX - 590),
      rectTop: rect.top,
      rectBottom: rect.bottom,
      rectLeft: rect.left,
      rectRight: rect.right,
    };

    if (!orderCache[order.id]) {
      fetch(`/api/purchase-orders/${order.id}`)
        .then(r => r.json())
        .then(data => {
          setOrderCache(prev => ({ ...prev, [order.id]: data }));
        })
        .catch(console.error);
    }

    setHoveredOrder({ orderId: order.id, pos });
  }

  function handleEyeHoverEnd() {
    activeOrderIdRef.current = null;
    clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      if (!isOverPopoverRef.current) {
        setHoveredOrder(null);
      }
    }, 150);
  }

  function handlePopoverMouseEnter() {
    isOverPopoverRef.current = true;
    clearTimeout(hoverTimerRef.current);
  }

  function handlePopoverMouseLeave() {
    isOverPopoverRef.current = false;
    setHoveredOrder(null);
  }
  const [dateTo, setDateTo] = useState('');

  // New order form
  const [storeId, setStoreId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [notes, setNotes] = useState('');
  // items: each has product_id, quantity, unit_cost, expiry_date
  const [items, setItems] = useState([]);

  const barcodeRef = useRef(null);
  const scanBufferRef = useRef('');
  const scanTimerRef = useRef(null);
  const lastKeyTimeRef = useRef(0);
  const firstCharRef = useRef(''); // tracks the char that may have leaked into a field
  const { canAddPurchaseOrder, isAdmin, assignedStores, hasStoreAccess, isSales, storePerms, isPlusForStore, hasAnyPlus, hasAnyMinus } = useRole();
  const router = useRouter();

  // Sales users with ONLY minus permission (no plus) should not see this page
  useEffect(() => {
    if (isSales && hasAnyMinus && !hasAnyPlus) {
      router.push('/dashboard');
    }
  }, [isSales, hasAnyMinus, hasAnyPlus, router]);

  const availableStores = isAdmin
    ? stores
    : stores.filter(s => {
      const id = Number(s.id);
      if (!assignedStores.includes(id)) return false;
      // For sales users, only show plus stores
      if (isSales) return isPlusForStore(id);
      // For others (manager, store_plus), show all assigned stores
      return true;
    });

  // Barcode scanner detection:
  // - First char always passes through (so human typing is never blocked).
  // - If a second char arrives within 50ms we know it's a scanner:
  //   strip the 1 leaked char from the focused field, then block everything
  //   until Enter arrives and process the full barcode.
  useEffect(() => {
    if (!modal) return;

    const SCAN_SPEED_MS = 50;

    function onKeyDown(e) {
      const now = Date.now();
      const gap = now - lastKeyTimeRef.current;
      const inScan = scanBufferRef.current.length > 0;

      // ── Enter ──
      if (e.key === 'Enter') {
        if (scanBufferRef.current.length > 2) {
          e.preventDefault();
          e.stopPropagation();
          const code = scanBufferRef.current;
          scanBufferRef.current = '';
          firstCharRef.current = '';
          clearTimeout(scanTimerRef.current);
          lastKeyTimeRef.current = 0;
          addByBarcode(code);
        }
        return;
      }

      if (e.key.length !== 1 || e.ctrlKey || e.altKey || e.metaKey) return;

      // ── Already confirmed in a scan sequence ──
      if (inScan && gap < SCAN_SPEED_MS) {
        e.preventDefault();
        e.stopPropagation();
        scanBufferRef.current += e.key;
        lastKeyTimeRef.current = now;
        clearTimeout(scanTimerRef.current);
        scanTimerRef.current = setTimeout(() => {
          scanBufferRef.current = '';
          firstCharRef.current = '';
          lastKeyTimeRef.current = 0;
        }, 300);
        return;
      }

      // ── Second fast char — scanner just identified ──
      if (!inScan && lastKeyTimeRef.current !== 0 && gap < SCAN_SPEED_MS) {
        e.preventDefault();
        e.stopPropagation();
        // Strip the first char that already leaked into the focused field
        const active = document.activeElement;
        if (active && active !== barcodeRef.current && ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName)) {
          if (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') {
            // For text inputs, remove the leaked character
            const currentValue = active.value;
            const selectionStart = active.selectionStart;
            const selectionEnd = active.selectionEnd;

            // The leaked char was just added at the cursor position (before selection moved)
            // Remove the character just before the current cursor position
            if (selectionStart > 0) {
              const newValue = currentValue.slice(0, selectionStart - 1) + currentValue.slice(selectionStart);
              const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
              if (setter) {
                setter.call(active, newValue);
                active.dispatchEvent(new Event('input', { bubbles: true }));
                // Restore cursor position (one position back since we removed a char)
                active.setSelectionRange(selectionStart - 1, selectionStart - 1);
              }
            }
          }
        }
        // Rebuild buffer with the leaked first char + this char
        scanBufferRef.current = firstCharRef.current + e.key;
        firstCharRef.current = '';
        lastKeyTimeRef.current = now;
        clearTimeout(scanTimerRef.current);
        scanTimerRef.current = setTimeout(() => {
          scanBufferRef.current = '';
          lastKeyTimeRef.current = 0;
        }, 300);
        return;
      }

      // ── Slow / human keystroke — let it through ──
      firstCharRef.current = e.key; // remember in case next key is fast
      lastKeyTimeRef.current = now;
      scanBufferRef.current = ''; // reset any stale buffer
      clearTimeout(scanTimerRef.current);
      scanTimerRef.current = setTimeout(() => {
        firstCharRef.current = '';
        lastKeyTimeRef.current = 0;
      }, 300);
    }

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      clearTimeout(scanTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modal, products]);

  async function load() {
    setLoading(true);
    const [o, p, s, st] = await Promise.all([
      fetch('/api/purchase-orders').then(r => r.json()),
      fetch('/api/products').then(r => r.json()),
      fetch('/api/suppliers').then(r => r.json()),
      fetch('/api/stores').then(r => r.json()),
    ]);
    setOrders(Array.isArray(o) ? o : []);
    setProducts(Array.isArray(p) ? p : []);
    setSuppliers(Array.isArray(s) ? s : []);
    setStores(Array.isArray(st) ? st : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setStoreId(''); setSupplierId(''); setNotes('');
    setItems([]);
    scanBufferRef.current = '';
    firstCharRef.current = '';
    clearTimeout(scanTimerRef.current);
    setModal(true);
    setTimeout(() => {
      if (barcodeRef.current) barcodeRef.current.value = '';
      barcodeRef.current?.focus();
    }, 100);
  }

  function getVariationOptions(prod) {
    if (!prod) return [];
    const fpList = prod.flavor_prices || [];
    const flavorsList = prod.flavors || [];

    if (fpList.length > 0) {
      return fpList.map((fp, idx) => {
        let label = formatAttributesLabel(fp.attributes);
        if (!label && fp.flavor_id) {
          const flav = flavorsList.find(f => Number(f.id) === Number(fp.flavor_id));
          label = flav?.name || `Flavor #${fp.flavor_id}`;
        }

        const key = fp.attributes
          ? (typeof fp.attributes === 'string' ? fp.attributes : JSON.stringify(fp.attributes))
          : `var_${fp.id || idx}`;

        const value = fp.id ? String(fp.id) : (key || `var_${idx}`);

        return {
          key: key || `var_${idx}`,
          value: value,
          variation_id: fp.id || null,
          vari_attribute: fp.attributes ? (typeof fp.attributes === 'string' ? fp.attributes : JSON.stringify(fp.attributes)) : '',
          barcode: fp.barcode || '',
          price: fp.price,
          sale_price: fp.sale_price,
          label: label || 'Default Variation',
        };
      });
    }

    return flavorsList.map(f => {
      const attr = { Flavor: f.name };
      const attrStr = JSON.stringify(attr);
      return {
        key: attrStr,
        value: attrStr,
        variation_id: null,
        vari_attribute: attrStr,
        price: prod.price,
        sale_price: prod.sale_price,
        label: f.name,
      };
    });
  }

  function addItem() {
    setItems([{ product_id: '', variation_id: null, vari_attribute: '', quantity: 1, unit_cost: '', expiry_date: '' }, ...items]);
  }

  function addItemByProduct(itemOrProd) {
    if (!itemOrProd) return;

    if (itemOrProd.product) {
      const prod = itemOrProd.product;
      const targetVarId = itemOrProd.variation_id || null;
      const targetVariAttr = itemOrProd.vari_attribute || '';
      const targetCost = (itemOrProd.price !== undefined && itemOrProd.price !== null && itemOrProd.price !== '') ? itemOrProd.price : (prod.price || '');

      setItems(prev => {
        const existingIdx = prev.findIndex(i => String(i.product_id) === String(prod.id) && String(i.variation_id || '') === String(targetVarId || ''));
        if (existingIdx >= 0) {
          const copy = [...prev];
          copy[existingIdx] = {
            ...copy[existingIdx],
            quantity: (parseInt(copy[existingIdx].quantity) || 0) + 1
          };
          return copy;
        }
        return [{
          product_id: prod.id,
          variation_id: targetVarId,
          vari_attribute: targetVariAttr,
          quantity: 1,
          unit_cost: targetCost,
          expiry_date: ''
        }, ...prev];
      });
      return;
    }

    const prod = itemOrProd;
    const opts = getVariationOptions(prod);
    const firstOpt = opts.length > 0 ? opts[0] : null;
    const variationId = firstOpt ? firstOpt.variation_id : null;
    const variAttr = firstOpt ? (firstOpt.vari_attribute || '') : '';
    let cost = (firstOpt && firstOpt.price !== undefined && firstOpt.price !== null && firstOpt.price !== '') ? firstOpt.price : (prod.price || '');

    setItems(prev => {
      const existingIdx = prev.findIndex(i => String(i.product_id) === String(prod.id) && String(i.variation_id || '') === String(variationId || ''));
      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx] = {
          ...copy[existingIdx],
          quantity: (parseInt(copy[existingIdx].quantity) || 0) + 1
        };
        return copy;
      }
      return [{
        product_id: prod.id,
        variation_id: variationId,
        vari_attribute: variAttr,
        quantity: 1,
        unit_cost: cost,
        expiry_date: ''
      }, ...prev];
    });
  }

  const productSearchRef = useRef(null);
  function removeItem(i) { setItems(items.filter((_, idx) => idx !== i)); }
  function updateItem(i, field, val) {
    const next = [...items];
    if (typeof field === 'object') {
      next[i] = { ...next[i], ...field };
    } else {
      next[i] = { ...next[i], [field]: val };
      if (field === 'product_id') {
        const prod = products.find(p => String(p.id) === String(val));
        if (prod) {
          const opts = getVariationOptions(prod);
          const firstOpt = opts.length > 0 ? opts[0] : null;
          next[i].variation_id = firstOpt ? firstOpt.variation_id : null;
          next[i].vari_attribute = firstOpt ? (firstOpt.vari_attribute || '') : '';
          next[i].unit_cost = (firstOpt && firstOpt.price !== undefined && firstOpt.price !== null && firstOpt.price !== '') ? firstOpt.price : (prod.price || '');
        }
      }
    }
    setItems(next);
  }

  const orderTotal = items.reduce((s, i) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.unit_cost) || 0), 0);

  function addByBarcode(code) {
    const c = code.trim().replace(/[\r\n\t]/g, '');
    if (!c) return;

    // 1. Check for variation barcode match first
    let matchedProd = null;
    let matchedVar = null;

    for (const p of products) {
      if (p.flavor_prices && Array.isArray(p.flavor_prices)) {
        const foundFp = p.flavor_prices.find(fp => fp.barcode && fp.barcode.trim().toLowerCase() === c.toLowerCase());
        if (foundFp) {
          matchedProd = p;
          matchedVar = foundFp;
          break;
        }
      }
    }

    // 2. If no variation barcode matched, check main product barcode
    if (!matchedProd) {
      matchedProd = products.find(p => p.barcode && p.barcode.trim().toLowerCase() === c.toLowerCase());
    }

    if (!matchedProd) {
      toast.error(`Product not found for barcode: "${c}" (${c.length} chars)`);
    } else {
      let targetVarId = null;
      let targetVariAttr = '';
      let targetCost = matchedProd.price || '';
      let varLabel = '';

      if (matchedVar) {
        targetVarId = matchedVar.id || null;
        varLabel = formatAttributesLabel(matchedVar.attributes);
        targetCost = (matchedVar.price !== undefined && matchedVar.price !== null && matchedVar.price !== '')
          ? matchedVar.price
          : (matchedProd.price || '');
        targetVariAttr = matchedVar.attributes ? (typeof matchedVar.attributes === 'string' ? matchedVar.attributes : JSON.stringify(matchedVar.attributes)) : '';
      } else {
        const opts = getVariationOptions(matchedProd);
        const firstOpt = opts.length > 0 ? opts[0] : null;
        targetVarId = firstOpt ? firstOpt.variation_id : null;
        targetVariAttr = firstOpt ? (firstOpt.vari_attribute || '') : '';
        if (firstOpt && firstOpt.price !== undefined && firstOpt.price !== null && firstOpt.price !== '') {
          targetCost = firstOpt.price;
        }
        if (firstOpt) {
          varLabel = firstOpt.label;
        }
      }

      setItems(prev => {
        const existingIdx = prev.findIndex(i => String(i.product_id) === String(matchedProd.id) && String(i.variation_id || '') === String(targetVarId || ''));
        if (existingIdx >= 0) {
          const copy = [...prev];
          copy[existingIdx] = {
            ...copy[existingIdx],
            quantity: (parseInt(copy[existingIdx].quantity) || 0) + 1
          };
          return copy;
        }
        return [{
          product_id: matchedProd.id,
          variation_id: targetVarId,
          vari_attribute: targetVariAttr,
          quantity: 1,
          unit_cost: targetCost,
          expiry_date: ''
        }, ...prev];
      });
      toast.success(`Added: ${matchedProd.name}${varLabel ? ` (${varLabel})` : ''}`);
    }

    if (barcodeRef.current) barcodeRef.current.value = '';
    scanBufferRef.current = '';
    barcodeRef.current?.focus();
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (saving) return;
    const validItems = items.filter(i => i.product_id && parseInt(i.quantity) > 0);
    if (validItems.length === 0) { toast.error('Add at least one valid item.'); return; }
    if (!storeId) { toast.error('Please select a store.'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id: storeId,
          supplier_id: supplierId || null,
          items: validItems.map(i => ({ ...i, unit_cost: parseFloat(i.unit_cost) || 0 })),
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success(`Receipt ${data.order_number} created.`);
      setModal(false);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function openDetail(id) {
    const data = await fetch(`/api/purchase-orders/${id}`).then(r => r.json());
    setDetail(data);
  }

  const [approvingId, setApprovingId] = useState(null);

  // Approve (receive) — uses expiry_date already stored on each item
  async function handleApprove(orderId) {
    setApprovingId(orderId);
    try {
      const res = await fetch(`/api/purchase-orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'received' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to approve order.');
      toast.success('Order approved. Stock updated.');
      setDetail(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setApprovingId(null);
    }
  }

  async function cancelOrder(id) {
    const res = await fetch(`/api/purchase-orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    });
    if (res.ok) { toast.success('Order cancelled.'); setDetail(null); load(); }
    else { const d = await res.json(); toast.error(d.message); }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this order?')) return;
    const res = await fetch(`/api/purchase-orders/${id}`, { method: 'DELETE' });
    if (res.ok) { toast.success('Deleted.'); load(); }
    else toast.error('Failed.');
  }

  function resetFilters() {
    setSearchText(''); setFilterStore(''); setFilterSupplier('');
    setStatusFilter(''); setDateFrom(''); setDateTo('');
    setPage(1);
  }

  const hasFilter = searchText || filterStore || filterSupplier || statusFilter || dateFrom || dateTo;

  const filtered = orders.filter(o => {
    if (!isAdmin && !hasStoreAccess(o.store_id)) return false;
    if (statusFilter && o.status !== statusFilter) return false;
    if (filterStore && String(o.store_id) !== String(filterStore)) return false;
    if (filterSupplier && String(o.supplier_id) !== String(filterSupplier)) return false;
    if (searchText) {
      const q = searchText.toLowerCase();
      if (
        !o.order_number?.toLowerCase().includes(q) &&
        !o.supplier_name?.toLowerCase().includes(q) &&
        !o.store_name?.toLowerCase().includes(q) &&
        !o.created_by_name?.toLowerCase().includes(q)
      ) return false;
    }
    if (dateFrom) {
      if (new Date(o.ordered_at) < new Date(dateFrom)) return false;
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      if (new Date(o.ordered_at) > to) return false;
    }
    return true;
  });

  const totalPurchaseValue = orders.reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0);
  const approvedCount = orders.filter(o => o.status === 'received').length;
  const pendingCount = orders.filter(o => o.status === 'pending').length;

  return (
    <Layout title="Product Receipts">
      {/* ── Top Header with Action ───────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-base)', display: 'flex', alignItems: 'center', gap: 10, letterSpacing: '-0.02em', margin: 0 }}>
            Stationery Product Receipts
            <span className="badge badge-indigo" style={{ fontSize: 13, fontWeight: 700, padding: '3px 10px' }}>
              {orders.length} {orders.length === 1 ? 'Receipt' : 'Receipts'}
            </span>
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginTop: 4 }}>
            Stock inward, supplier purchases, cost pricing, and batch expiry tracking
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            className="btn btn-secondary"
            onClick={load}
            disabled={loading}
            title="Refresh Receipts"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 42, padding: '0 14px' }}
          >
            <IconRefresh size={15} /> Refresh
          </button>
          {canAddPurchaseOrder && (
            <button
              className="btn btn-primary"
              onClick={openNew}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 42, padding: '0 18px', fontWeight: 700 }}
            >
              <IconPlus size={16} /> New Receipt
            </button>
          )}
        </div>
      </div>

      {/* ── Main Data Card & Filters ─────────────────────────────── */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {/* Filter bar */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-light)', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', background: 'var(--bg-card)' }}>

          {/* Search */}
          <div style={{ flex: '1 1 220px', minWidth: 200 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>Search Receipt</div>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)', pointerEvents: 'none', display: 'flex' }}>
                <IconSearch size={14} />
              </span>
              <input
                value={searchText}
                onChange={e => { setSearchText(e.target.value); setPage(1); }}
                placeholder="Receipt no, supplier, store…"
                style={{ paddingLeft: 34, width: '100%', height: 40, borderRadius: 8 }}
              />
            </div>
          </div>

          {/* Store */}
          <div style={{ flex: '1 1 180px', minWidth: 160 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>Store Branch</div>
            <SearchableSelect
              options={availableStores.map(s => ({ value: s.id, label: s.name }))}
              value={filterStore}
              onChange={v => { setFilterStore(v); setPage(1); }}
              placeholder={isAdmin ? "All Stores" : "Select Store"}
            />
          </div>

          {/* Supplier */}
          <div style={{ flex: '1 1 180px', minWidth: 160 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>Supplier</div>
            <SearchableSelect
              options={suppliers.map(s => ({ value: s.id, label: s.name }))}
              value={filterSupplier}
              onChange={v => { setFilterSupplier(v); setPage(1); }}
              placeholder="All Suppliers"
            />
          </div>

          {/* Status */}
          <div style={{ flex: '0 0 auto' }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>Status</div>
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
              style={{ padding: '0 12px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: 13, background: 'var(--bg-input)', color: 'var(--text-base)', cursor: 'pointer', height: 40 }}
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="received">Approved</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Date from */}
          <div style={{ flex: '0 0 auto' }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>From Date</div>
            <input
              type="date"
              value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setPage(1); }}
              style={{ width: 145, height: 40, borderRadius: 8 }}
            />
          </div>

          {/* Date to */}
          <div style={{ flex: '0 0 auto' }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>To Date</div>
            <input
              type="date"
              value={dateTo}
              onChange={e => { setDateTo(e.target.value); setPage(1); }}
              style={{ width: 145, height: 40, borderRadius: 8 }}
            />
          </div>

          {/* Clear */}
          {hasFilter && (
            <div style={{ flex: '0 0 auto', paddingBottom: 1 }}>
              <button className="btn btn-secondary btn-sm" onClick={resetFilters} style={{ height: 40, padding: '0 14px' }}>✕ Reset</button>
            </div>
          )}
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 50, textAlign: 'center' }}>#</th>
                <th style={{ minWidth: 180 }}>Receipt No.</th>
                <th style={{ minWidth: 160 }}>Store Branch</th>
                <th style={{ minWidth: 160 }}>Supplier</th>
                <th style={{ minWidth: 140 }}>Created By</th>
                <th style={{ minWidth: 110 }}>Status</th>
                <th style={{ minWidth: 120, textAlign: 'right' }}>Total Amount</th>
                <th style={{ minWidth: 160 }}>Date &amp; Time</th>
                <th style={{ width: 130, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableLoader cols={9} />
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <div className="empty-state" style={{ padding: '48px 20px' }}>
                      <div className="empty-state-icon" style={{ width: 56, height: 56 }}>
                        <IconTruck size={28} />
                      </div>
                      <p style={{ fontSize: 16, fontWeight: 700, marginTop: 12 }}>{statusFilter ? `No ${statusFilter} receipts found` : 'No product receipts yet'}</p>
                      <span style={{ color: 'var(--text-muted)' }}>{hasFilter ? 'Try clearing your filters or changing search keywords' : 'Click "+ New Receipt" to record supplier stock inward'}</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((o, i) => (
                <tr key={o.id} style={{ transition: 'background 0.15s ease' }}>
                  <td style={{ textAlign: 'center', color: 'var(--text-faint)', fontSize: 12.5, fontWeight: 600 }}>
                    {(page - 1) * PAGE_SIZE + i + 1}
                  </td>
                  <td>
                    <div>
                      <strong style={{ color: 'var(--primary)', fontSize: 13.5, letterSpacing: '0.01em' }}>{o.order_number}</strong>
                    </div>
                  </td>
                  <td>
                    {o.store_name ? (
                      <span className="badge badge-indigo" style={{ fontWeight: 700 }}>
                        {o.store_name}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-faint)' }}>—</span>
                    )}
                  </td>
                  <td>
                    {o.supplier_name ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13, color: 'var(--text-base)' }}>
                        <IconFactory size={14} color="var(--text-faint)" />
                        {o.supplier_name}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-faint)' }}>—</span>
                    )}
                  </td>
                  <td>
                    {o.created_by_name ? (
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)' }}>
                        {o.created_by_name}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-faint)' }}>—</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[o.status] || 'badge-gray'}`} style={{ fontWeight: 700 }}>
                      {STATUS_LABELS[o.status] || o.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 800, fontSize: 13.5, color: 'var(--text-base)' }}>
                    ₹{parseFloat(o.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text-muted)' }}>
                      <IconCalendar size={13} color="var(--text-faint)" />
                      {formatISTDateTime(o.ordered_at)}
                    </div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => { setHoveredOrder(null); openDetail(o.id); }}
                        onMouseEnter={e => handleEyeHoverStart(e, o)}
                        onMouseLeave={handleEyeHoverEnd}
                        onTouchStart={e => handleEyeHoverStart(e, o)}
                        onTouchEnd={handleEyeHoverEnd}
                        title="View Receipt Details"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 9px', fontSize: 12 }}
                      >
                        <IconEye size={13} /> View
                      </button>
                      {canAddPurchaseOrder && (isSales ? isPlusForStore(o.store_id) : true) && o.status === 'pending' && (
                        <button
                          className="btn btn-success btn-sm"
                          disabled={approvingId === o.id}
                          onClick={() => handleApprove(o.id)}
                          style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 10px', fontSize: 12, fontWeight: 700 }}
                        >
                          {approvingId === o.id ? '…' : 'Approve'}
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(o.id)}
                          title="Delete Receipt"
                          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '5px 8px', fontSize: 12 }}
                        >
                          <IconTrash size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} />
      </div>

      {/* ── New Order Modal ── */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal" style={{ maxWidth: 1060, width: '95%' }}>
            <div className="modal-header">
              <span className="modal-title">New Product Receipt</span>
              <button className="modal-close" onClick={() => setModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreate} onKeyDown={e => { if (e.key === 'Enter' && e.target.type !== 'submit') e.preventDefault(); }}>
              <div className="modal-body">
                <div className="form-grid" style={{ marginBottom: 20 }}>
                  <div className="form-group">
                    <label>Store *</label>
                    <SearchableSelect
                      options={availableStores.map(s => ({ value: s.id, label: s.name }))}
                      value={storeId}
                      onChange={v => setStoreId(v)}
                      placeholder="— Select Store —"
                    />
                  </div>
                  <div className="form-group">
                    <label>Supplier</label>
                    <SearchableSelect
                      options={suppliers.map(s => ({ value: s.id, label: s.name, sub: s.phone || '' }))}
                      value={supplierId}
                      onChange={v => setSupplierId(v)}
                      placeholder="— Select Supplier —"
                    />
                  </div>
                  <div className="form-group full">
                    <label>Notes</label>
                    <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes…" />
                  </div>
                </div>

                <div style={{ marginBottom: 10, fontWeight: 700, fontSize: 13.5, color: 'var(--text-base)' }}>Products Received</div>

                {/* Barcode scanner input */}
                <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--bg-base)', border: '1.5px solid #6366f1', borderRadius: 8, boxShadow: '0 0 0 3px rgba(99,102,241,.1)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="7" y1="7" x2="7" y2="17" /><line x1="10" y1="7" x2="10" y2="17" /><line x1="13" y1="7" x2="13" y2="11" /><line x1="16" y1="7" x2="16" y2="17" /><line x1="13" y1="14" x2="13" y2="17" />
                  </svg>
                  <input
                    ref={barcodeRef}
                    type="text"
                    defaultValue=""
                    onKeyDown={e => {
                      if (e.key !== 'Enter') return;
                      e.preventDefault();
                      addByBarcode(barcodeRef.current?.value || '');
                    }}
                    placeholder="Scan or type barcode, press Enter to add"
                    style={{ flex: 1, fontSize: 13.5, border: 'none', background: 'transparent', outline: 'none', color: 'var(--text-base)' }}
                    autoComplete="off"
                    autoFocus
                  />
                </div>

                {/* Product search add */}
                <ProductSearchAdd products={products} onAdd={addItemByProduct} inputRef={productSearchRef} />
                <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <table className="items-table">
                    <thead>
                      <tr style={{ background: 'var(--bg-base)' }}>
                        <th style={{ minWidth: 240, padding: '10px 12px' }}>Product</th>
                        <th style={{ minWidth: 160, padding: '10px 12px' }}>Variation</th>
                        <th style={{ width: 85, minWidth: 85, padding: '10px 8px', textAlign: 'center' }}>Qty</th>
                        <th style={{ width: 115, minWidth: 115, padding: '10px 8px', textAlign: 'right' }}>Unit Cost (₹)</th>
                        <th style={{ width: 160, minWidth: 160, padding: '10px 12px' }}>Expiry Date</th>
                        <th style={{ width: 120, minWidth: 120, padding: '10px 12px', textAlign: 'right' }}>Subtotal</th>
                        <th style={{ width: 44, padding: '10px 8px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, i) => {
                        const selProd = products.find(p => String(p.id) === String(item.product_id));
                        const hasFlavors = selProd && selProd.flavors && selProd.flavors.length > 0;
                        return (
                          <tr key={i}>
                            <td style={{ minWidth: 240, padding: '8px 10px' }}>
                              <SearchableSelect
                                options={products.map(p => ({ value: p.id, label: p.name, sub: p.barcode ? `Barcode: ${p.barcode}` : '' }))}
                                value={item.product_id}
                                onChange={v => updateItem(i, 'product_id', v)}
                                placeholder="Search product…"
                              />
                            </td>
                            <td style={{ minWidth: 200, padding: '8px 10px' }}>
                              {selProd && (selProd.flavors?.length > 0 || selProd.flavor_prices?.length > 0) ? (
                                <SearchableSelect
                                  options={getVariationOptions(selProd).map(opt => ({
                                    value: opt.value,
                                    label: opt.label,
                                    sub: `${opt.barcode ? `Barcode: ${opt.barcode} · ` : ''}${(opt.price !== undefined && opt.price !== null && opt.price !== '') ? `Unit Cost: ₹${parseFloat(opt.price).toFixed(2)}` : ''}`
                                  }))}
                                  value={item.variation_id ? String(item.variation_id) : (item.vari_attribute || '')}
                                  onChange={val => {
                                    if (!val) {
                                      updateItem(i, { variation_id: null, vari_attribute: '' });
                                      return;
                                    }
                                    const opts = getVariationOptions(selProd);
                                    const match = opts.find(o => o.value === val || o.key === val || String(o.variation_id) === String(val));
                                    if (match) {
                                      updateItem(i, {
                                        variation_id: match.variation_id || null,
                                        vari_attribute: match.vari_attribute || '',
                                        unit_cost: (match.price !== undefined && match.price !== null && match.price !== '') ? match.price : (selProd.price || '')
                                      });
                                    }
                                  }}
                                  placeholder="— Select Variation —"
                                />
                              ) : (
                                <span style={{ color: '#94a3b8', fontSize: 12, paddingLeft: 4 }}>— Standard —</span>
                              )}
                            </td>
                            <td style={{ padding: '8px 8px', textAlign: 'center' }}>
                              <input
                                type="number" min="1" max="2000"
                                value={item.quantity}
                                onChange={e => {
                                  const v = parseInt(e.target.value) || 0;
                                  if (v > 2000) { toast.error('Max 2,000 units per item.'); return; }
                                  updateItem(i, 'quantity', e.target.value);
                                }}
                                style={{ width: 75, textAlign: 'center', fontWeight: 600 }}
                              />
                            </td>
                            <td style={{ padding: '8px 8px', textAlign: 'right' }}>
                              <input
                                type="number" min="0" step="0.01"
                                value={item.unit_cost}
                                onChange={e => updateItem(i, 'unit_cost', e.target.value)}
                                style={{ width: 95, textAlign: 'right', fontWeight: 600 }}
                              />
                            </td>
                            <td style={{ padding: '8px 10px' }}>
                              <input
                                type="date"
                                value={item.expiry_date}
                                onChange={e => updateItem(i, 'expiry_date', e.target.value)}
                                style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12.5 }}
                                title={`All ${item.quantity || 1} unit(s) will share this expiry date`}
                              />
                            </td>
                            <td style={{ padding: '8px 10px', fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap', color: '#6366f1', fontSize: 13.5 }}>
                              ₹{((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_cost) || 0)).toFixed(2)}
                            </td>
                            <td style={{ padding: '8px 8px', textAlign: 'center' }}>
                              <button type="button" className="btn btn-danger btn-sm" onClick={() => removeItem(i)} title="Remove item">✕</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div style={{ textAlign: 'right', marginTop: 14, fontWeight: 800, fontSize: 16, color: 'var(--text-base)' }}>
                  Total: <span style={{ color: '#6366f1' }}>₹{orderTotal.toFixed(2)}</span>
                </div>

                {/* Expiry hint */}
                <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(99,102,241,.1)', borderRadius: 8, fontSize: 12.5, color: 'var(--primary)', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span>ℹ️</span>
                  <span>The expiry date applies to <strong>all units</strong> of that product in this receipt. You can leave it blank if the product has no expiry.</span>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating…' : 'Create Receipt'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Detail Modal ── */}
      {detail && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDetail(null)}>
          <div className="modal" style={{ maxWidth: 880, width: '95%' }}>
            <div className="modal-header">
              <div>
                <span className="modal-title">Receipt: {detail.order_number}</span>
                <div style={{ marginTop: 4 }}>
                  <span className={`badge ${STATUS_BADGE[detail.status]}`}>{STATUS_LABELS[detail.status]}</span>
                </div>
              </div>
              <button className="modal-close" onClick={() => setDetail(null)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 18, fontSize: 13, background: 'var(--bg-base)', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--border-light)' }}>
                <div><strong>Store:</strong> {detail.store_name ? <span className="badge badge-indigo">{detail.store_name}</span> : '—'}</div>
                <div><strong>Supplier:</strong> {detail.supplier_name || '—'}</div>
                <div><strong>Created By:</strong> {detail.created_by_name || '—'}</div>
                <div><strong>Date &amp; Time:</strong> {formatISTDateTime(detail.ordered_at)}</div>
                <div><strong>Total:</strong> <strong style={{ color: '#6366f1' }}>₹{parseFloat(detail.total_amount).toFixed(2)}</strong></div>
                {detail.notes && <div style={{ gridColumn: '1/-1' }}><strong>Notes:</strong> {detail.notes}</div>}
              </div>

              <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
                <table className="items-table">
                  <thead>
                    <tr style={{ background: 'var(--bg-base)' }}>
                      <th style={{ padding: '10px 12px' }}>Product</th>
                      <th style={{ padding: '10px 12px' }}>Variation</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center', width: 90 }}>Qty</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', width: 120 }}>Unit Cost</th>
                      <th style={{ padding: '10px 12px', width: 150 }}>Expiry Date</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', width: 130 }}>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detail.items || []).map(item => {
                      const varText = formatAttributesLabel(item.vari_attribute) || formatAttributesLabel(item.variation_attributes) || (item.flavor_name ? `${item.flavor_name}${item.unit_value && item.unit_name ? ` - ${item.unit_value} ${item.unit_name}` : (item.unit_value ? ` - ${item.unit_value}` : '')}` : '');
                      const subtotalVal = parseFloat(item.subtotal || (parseFloat(item.quantity || 0) * parseFloat(item.unit_cost || 0)));

                      return (
                        <tr key={item.id}>
                          <td style={{ padding: '10px 12px' }}>
                            <strong style={{ fontSize: 13.5, color: 'var(--text-base)' }}>{item.product_name}</strong>
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            {renderVariationLines(item, false)}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700 }}>{item.quantity}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 500, color: 'var(--text-muted)' }}>₹{parseFloat(item.unit_cost).toFixed(2)}</td>
                          <td style={{ padding: '10px 12px', fontSize: 12.5, color: item.expiry_date ? 'var(--text-base)' : '#94a3b8' }}>
                            {item.expiry_date ? new Date(item.expiry_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#6366f1' }}>₹{subtotalVal.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {detail.status === 'pending' && canAddPurchaseOrder && (
                <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                  <button
                    className="btn btn-success"
                    disabled={approvingId === detail.id}
                    onClick={() => handleApprove(detail.id)}
                  >
                    {approvingId === detail.id ? 'Approving…' : '✅ Approve & Add to Stock'}
                  </button>
                  <button className="btn btn-danger" onClick={() => cancelOrder(detail.id)}>
                    ✕ Cancel Order
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {hoveredOrder && (
        <OrderHoverPopup
          orderId={hoveredOrder.orderId}
          pos={hoveredOrder.pos}
          cache={orderCache}
          onMouseEnter={handlePopoverMouseEnter}
          onMouseLeave={handlePopoverMouseLeave}
        />
      )}
    </Layout>
  );
}
