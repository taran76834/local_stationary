import Layout from '@/components/Layout';
import { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import SearchableSelect from '@/components/SearchableSelect';
import { useRole } from '@/hooks/useRole';
import Pagination from '@/components/Pagination';
import TableLoader from '@/components/TableLoader';

const PAGE_SIZE = 15;
const STATUS_BADGE = { paid: 'badge-green', cancelled: 'badge-red' };

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

function formatVariationAttributes(attrs) {
  const list = parseVariationAttributes(attrs);
  return list.join(', ');
}

function getVariationStock(selProd, varOpt, storeFlavorStock = {}) {
  if (!selProd || !varOpt) return 0;
  const fsList = storeFlavorStock[selProd.id] || storeFlavorStock[String(selProd.id)] || [];
  const varId = varOpt.id || varOpt.variation_id;
  const varAttr = varOpt.attributes || varOpt.vari_attribute;

  const fs = fsList.find(fItem => {
    if (varId && fItem.variation_id && Number(fItem.variation_id) === Number(varId)) return true;
    if (varAttr && fItem.vari_attribute) {
      const s1 = typeof varAttr === 'string' ? varAttr.trim() : JSON.stringify(varAttr);
      const s2 = typeof fItem.vari_attribute === 'string' ? fItem.vari_attribute.trim() : JSON.stringify(fItem.vari_attribute);
      if (s1 === s2) return true;
    }
    return false;
  });

  return fs ? (parseInt(fs.stock) || 0) : 0;
}

// ── Debounce hook ─────────────────────────────────────────────────────────────
function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ── Customer search dropdown ──────────────────────────────────────────────────
function CustomerSearch({ name, phone, onNameChange, onPhoneChange, onSelect, nameInputRef, onPhoneTab }) {
  const [suggestions, setSuggestions] = useState([]);
  const [showDrop, setShowDrop] = useState(false);
  const [searching, setSearching] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const wrapRef = useRef(null);
  const listRef = useRef(null);
  const phoneInputRef = useRef(null);
  const justSelected = useRef(false);

  const query = name || phone;
  const debQuery = useDebounce(query, 280);

  useEffect(() => {
    if (justSelected.current) { justSelected.current = false; return; }
    if (!debQuery || debQuery.trim().length < 1) { setSuggestions([]); return; }
    setSearching(true);
    fetch(`/api/customers?q=${encodeURIComponent(debQuery.trim())}`)
      .then(r => r.json())
      .then(data => { setSuggestions(Array.isArray(data) ? data : []); setShowDrop(true); setActiveIdx(-1); })
      .catch(() => setSuggestions([]))
      .finally(() => setSearching(false));
  }, [debQuery]);

  useEffect(() => {
    function handle(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setShowDrop(false);
        setActiveIdx(-1);
      }
    }
    document.addEventListener('mousedown', handle);
    document.addEventListener('focusin', handle);
    return () => {
      document.removeEventListener('mousedown', handle);
      document.removeEventListener('focusin', handle);
    };
  }, []);
  // Scroll active item into view
  useEffect(() => {
    if (activeIdx < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll('[data-cust-item]');
    items[activeIdx]?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  function pick(customer) {
    justSelected.current = true;
    setSuggestions([]);
    setShowDrop(false);
    setActiveIdx(-1);
    onSelect(customer);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && (!showDrop || suggestions.length === 0)) {
      e.preventDefault();
      phoneInputRef.current?.focus();
      return;
    }
    if (!showDrop || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // Only select if user explicitly navigated to a suggestion
      if (activeIdx >= 0) {
        pick(suggestions[activeIdx]);
      } else {
        // No highlight — just move to phone field
        phoneInputRef.current?.focus();
      }
    } else if (e.key === 'Escape') {
      setShowDrop(false);
      setActiveIdx(-1);
    }
  }

  function handlePhoneKeyDown(e) {
    if (e.key === 'Tab' && !e.shiftKey && showDrop) {
      setShowDrop(false);
      setActiveIdx(-1);
    }
    // Arrow navigation in dropdown
    if (showDrop && suggestions.length > 0 && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      handleKeyDown(e);
      return;
    }
    // Enter on highlighted suggestion — select it
    if (e.key === 'Enter' && showDrop && suggestions.length > 0 && activeIdx >= 0) {
      e.preventDefault();
      pick(suggestions[activeIdx]);
      return;
    }
    if (e.key === 'Escape') {
      setShowDrop(false);
      setActiveIdx(-1);
      return;
    }
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      setShowDrop(false);
      setActiveIdx(-1);
      onPhoneTab?.();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      setShowDrop(false);
      setActiveIdx(-1);
      onPhoneTab?.();
    }
  }

  return (
    <div ref={wrapRef} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, position: 'relative' }}>
      {/* Name field */}
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label>Customer Name</label>
        <input
          ref={nameInputRef}
          value={name}
          onChange={e => onNameChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setShowDrop(true)}
          onBlur={() => setTimeout(() => { if (!wrapRef.current?.contains(document.activeElement)) { setShowDrop(false); setActiveIdx(-1); } }, 100)}
          onKeyDown={handleKeyDown}
          placeholder="Customer name (optional)"
          autoComplete="off"
        />
      </div>

      {/* Phone field */}
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label>Customer Phone</label>
        <input
          ref={phoneInputRef}
          value={phone}
          onChange={e => onPhoneChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setShowDrop(true)}
          onBlur={() => setTimeout(() => { if (!wrapRef.current?.contains(document.activeElement)) { setShowDrop(false); setActiveIdx(-1); } }, 100)}
          onKeyDown={handlePhoneKeyDown}
          placeholder="9876543210"
          autoComplete="off"
        />
      </div>

      {/* Suggestions dropdown */}
      {showDrop && suggestions.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          zIndex: 999,
          background: 'var(--bg-card)',
          border: '1.5px solid var(--border)',
          borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,.12)',
          overflow: 'hidden',
          marginTop: 4,
        }}>
          <div style={{ padding: '6px 12px', fontSize: 11, color: 'var(--text-faint)', fontWeight: 600, textTransform: 'uppercase', borderBottom: '1px solid var(--border-light)' }}>
            {searching ? 'Searching…' : `${suggestions.length} customer${suggestions.length > 1 ? 's' : ''} found`}
          </div>
          <div ref={listRef} style={{ maxHeight: 240, overflowY: 'auto' }}>
            {suggestions.map((c, idx) => (
              <div
                key={c.id}
                data-cust-item
                onMouseDown={() => pick(c)}
                onMouseEnter={() => setActiveIdx(idx)}
                style={{
                  padding: '9px 14px',
                  cursor: 'pointer',
                  borderBottom: '1px solid var(--border-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: idx === activeIdx ? 'var(--hover-row)' : 'transparent',
                  borderLeft: `3px solid ${idx === activeIdx ? '#6366f1' : 'transparent'}`,
                }}
              >
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-base)' }}>{c.name}</div>
                  {c.phone && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>📞 {c.phone}</div>}
                </div>
                <span style={{ fontSize: 11, color: '#6366f1', fontWeight: 600 }}>Select</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Batch selector (searchable, modern) ──────────────────────────────────────
function BatchSelect({ batches, value, onChange, today, soon }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const triggerRef = useRef(null);
  const dropRef = useRef(null);
  const searchRef = useRef(null);
  const listRef = useRef(null);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });

  function calcPos() {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setDropPos({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX, width: r.width });
  }

  function openDrop() { calcPos(); setOpen(v => !v); }

  useEffect(() => {
    if (!open) return;
    const h = () => calcPos();
    window.addEventListener('scroll', h, true);
    window.addEventListener('resize', h);
    return () => { window.removeEventListener('scroll', h, true); window.removeEventListener('resize', h); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function h(e) {
      if (triggerRef.current?.contains(e.target) || dropRef.current?.contains(e.target)) return;
      setOpen(false); setSearch('');
    }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  useEffect(() => { if (open) { setActiveIdx(0); if (searchRef.current) searchRef.current.focus(); } }, [open]);
  useEffect(() => { setActiveIdx(0); }, [search]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll('[data-batch-item]');
    items[activeIdx]?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  function batchMeta(b) {
    const exp = b.expiry_date ? new Date(b.expiry_date) : null;
    const isExpired = exp && exp < today;
    const isSoon = exp && !isExpired && exp <= soon;
    const label = b.expiry_date
      ? new Date(b.expiry_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : 'No expiry date';
    const color = isExpired ? '#ef4444' : isSoon ? '#f59e0b' : '#10b981';
    const tag = isExpired ? 'EXPIRED' : isSoon ? 'Expiring soon' : 'Good';
    const tagBg = isExpired ? 'rgba(239,68,68,.15)' : isSoon ? 'rgba(245,158,11,.15)' : 'rgba(16,185,129,.15)';
    return { label, color, tag, tagBg, isExpired, isSoon };
  }

  const allOptions = batches.map(b => {
    const m = batchMeta(b);
    return { key: b.expiry_date ?? '__null__', label: m.label, sub: `${b.qty} units in stock`, color: m.color, tag: m.tag, tagBg: m.tagBg };
  });

  const filtered = allOptions.filter(o =>
    o.label.toLowerCase().includes(search.toLowerCase()) ||
    o.sub.toLowerCase().includes(search.toLowerCase())
  );

  const selected = value === undefined
    ? null
    : allOptions.find(o => (value === null ? o.key === '__null__' : o.key === value)) || null;

  const dropdown = open && createPortal(
    <div ref={dropRef} style={{
      position: 'absolute', top: dropPos.top, left: dropPos.left, width: Math.max(dropPos.width, 260),
      background: 'var(--bg-card)', border: '1.5px solid var(--border)',
      borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,.14)', zIndex: 9999, overflow: 'hidden',
    }}>
      <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-light)' }}>
        <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search batch…"
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, filtered.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
            else if (e.key === 'Enter') {
              e.preventDefault();
              const opt = filtered[activeIdx] ?? filtered[0];
              if (opt) { onChange(opt.key === '__null__' ? null : opt.key); setOpen(false); setSearch(''); setTimeout(() => triggerRef.current?.focus(), 0); }
            }
            else if (e.key === 'Escape') { setOpen(false); setSearch(''); triggerRef.current?.focus(); }
          }}
          style={{ width: '100%', padding: '6px 10px', border: '1.5px solid var(--border)', borderRadius: 6, fontSize: 13, outline: 'none', background: 'var(--bg-input)', color: 'var(--text-base)' }}
          onFocus={e => e.target.style.borderColor = '#6366f1'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'}
        />
      </div>
      <div ref={listRef} style={{ maxHeight: 220, overflowY: 'auto' }}>
        {filtered.length === 0
          ? <div style={{ padding: '12px 14px', fontSize: 13, color: '#94a3b8', textAlign: 'center' }}>No results</div>
          : filtered.map((opt, idx) => {
            const isActive = selected?.key === opt.key;
            const isHighlight = idx === activeIdx;
            const rowBg = isActive ? 'rgba(99,102,241,.12)' : isHighlight ? 'var(--hover-row)' : idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-base)';
            return (
              <div key={opt.key}
                data-batch-item
                onMouseDown={() => {
                  onChange(opt.key === '__null__' ? null : opt.key);
                  setOpen(false); setSearch('');
                  setTimeout(() => triggerRef.current?.focus(), 0);
                }}
                onMouseEnter={() => setActiveIdx(idx)}
                style={{
                  padding: '9px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                  background: rowBg,
                  borderLeft: `3px solid ${isActive ? '#6366f1' : isHighlight ? '#a5b4fc' : 'transparent'}`,
                  transition: 'background .1s',
                }}
              >
                <span style={{ fontSize: 15, flexShrink: 0 }}>📦</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: opt.color }}>{opt.label}</div>
                  <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 1 }}>{opt.sub}</div>
                </div>
                <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: opt.tagBg, color: opt.color, flexShrink: 0 }}>
                  {opt.tag}
                </span>
              </div>
            );
          })
        }
      </div>
    </div>,
    document.body
  );

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <button type="button" ref={triggerRef} onClick={openDrop}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDrop(); } }}
        style={{
          width: '100%', padding: '7px 32px 7px 10px', border: `1.5px solid ${open ? '#6366f1' : 'var(--border)'}`,
          borderRadius: 7, background: 'var(--bg-input)', textAlign: 'left', fontSize: 13, cursor: 'pointer',
          color: 'var(--text-base)',
          boxShadow: open ? '0 0 0 3px rgba(99,102,241,.1)' : 'none',
          transition: 'border-color .15s, box-shadow .15s', position: 'relative',
          display: 'flex', alignItems: 'center', gap: 7,
        }}>
        {selected ? (
          <>
            <span style={{ fontSize: 15, flexShrink: 0 }}>📦</span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: selected.color, fontWeight: 600 }}>
              {selected.label}
            </span>
            <span style={{ fontSize: 11, color: '#94a3b8', flexShrink: 0 }}>{selected.sub}</span>
          </>
        ) : (
          <span style={{ flex: 1, color: '#94a3b8' }}>— Select batch —</span>
        )}
        <span style={{
          position: 'absolute', right: 8, top: '50%', transform: `translateY(-50%) rotate(${open ? 180 : 0}deg)`,
          transition: 'transform .2s', color: '#94a3b8', pointerEvents: 'none',
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>
      {typeof document !== 'undefined' && dropdown}
    </div>
  );
}

// ── Product search-to-add input ───────────────────────────────────────────────
function ProductSearchAdd({ products, storeStock, storeFlavorStock = {}, storeId, onAdd, inputRef }) {
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
          const attrLabel = formatVariationAttributes(vp.attributes);
          const varBarcodeMatch = vp.barcode && vp.barcode.toLowerCase().includes(q);
          const varLabelMatch = attrLabel.toLowerCase().includes(q);

          if (nameMatch || barcodeMatch || varBarcodeMatch || varLabelMatch) {
            anyVarMatched = true;
            const pVal = (vp.sale_price && parseFloat(vp.sale_price) > 0) ? vp.sale_price : (vp.price || p.price);
            const fQty = getVariationStock(p, vp, storeFlavorStock);

            matched.push({
              key: `${p.id}_${vp.id}`,
              product: p,
              variation: vp,
              name: `${p.name} — ${attrLabel || `Variation #${vp.id}`}`,
              barcode: vp.barcode || p.barcode || '',
              price: pVal,
              stock: fQty,
              variation_id: String(vp.id),
              vari_attribute: attrLabel,
            });
          }
        }
        if (!anyVarMatched && (nameMatch || barcodeMatch)) {
          for (const vp of p.flavor_prices) {
            const attrLabel = formatVariationAttributes(vp.attributes);
            const pVal = (vp.sale_price && parseFloat(vp.sale_price) > 0) ? vp.sale_price : (vp.price || p.price);
            const fQty = getVariationStock(p, vp, storeFlavorStock);

            matched.push({
              key: `${p.id}_${vp.id}`,
              product: p,
              variation: vp,
              name: `${p.name} — ${attrLabel || `Variation #${vp.id}`}`,
              barcode: vp.barcode || p.barcode || '',
              price: pVal,
              stock: fQty,
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
          stock: storeId ? (storeStock[p.id] ?? 0) : (p.stock ?? 0),
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
  }, [query, products, storeStock, storeFlavorStock, storeId]);

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
    return () => { document.removeEventListener('mousedown', onDown); };
  }, []);

  // Scroll active item into view
  useEffect(() => {
    if (activeIdx < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll('[data-product-sugg]');
    items[activeIdx]?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  function pick(sugg) {
    onAdd(sugg); setQuery(''); setSuggs([]); setOpen(false); setActiveIdx(-1);
    setTimeout(() => inputRef?.current?.focus(), 50);
  }

  function onKeyDown(e) {
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
          const stock = item.stock;
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
                <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 1 }}>{item.barcode ? `${item.barcode} · ` : ''}₹{parseFloat(item.price || 0).toFixed(2)} · Stock: {stock}</div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: stock > 10 ? 'rgba(16,185,129,.15)' : stock > 0 ? 'rgba(245,158,11,.15)' : 'rgba(239,68,68,.15)', color: stock > 10 ? '#10b981' : stock > 0 ? '#f59e0b' : '#ef4444' }}>{stock}</span>
            </div>
          );
        })}
      </div>
    </div>,
    document.body
  );

  return (
    <div ref={wrapRef} style={{ marginTop: 10, marginBottom: 8 }}>
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

const PT_CFG = {
  cash: { label: '💵 Cash', color: '#10b981', bg: 'rgba(16,185,129,.15)' },
  card: { label: '💳 Card', color: '#3b82f6', bg: 'rgba(59,130,246,.15)' },
  upi: { label: '📱 UPI', color: '#8b5cf6', bg: 'rgba(139,92,246,.15)' },
};

function PaymentBadge({ type }) {
  const c = PT_CFG[type || 'cash'] || PT_CFG.cash;
  return <span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: 99, background: c.bg, color: c.color, fontSize: 11.5, fontWeight: 700 }}>{c.label}</span>;
}

// ── Bill Hover/Hold Preview Popup ──────────────────────────────────────────────
function BillHoverPopup({ billId, pos, cache, onMouseEnter, onMouseLeave, onClick }) {
  if (!pos) return null;
  const detail = cache[billId];

  const popupWidth = 480;
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1000;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;

  // Position strictly to the left of the eye button (rectLeft - popupWidth - 12) so button is NEVER covered!
  let leftPos = (pos.rectLeft || 0) + (typeof window !== 'undefined' ? window.scrollX : 0) - popupWidth - 12;
  if (leftPos < 12) {
    leftPos = (pos.rectRight || 0) + (typeof window !== 'undefined' ? window.scrollX : 0) + 12;
  }

  const popupEstHeight = detail ? Math.min(340, 140 + (detail.items?.length || 0) * 35) : 160;
  const spaceBelow = viewportHeight - (pos.rectTop || 0);
  const showAbove = spaceBelow < popupEstHeight && (pos.rectBottom || 0) > popupEstHeight;
  const topPos = showAbove
    ? Math.max(10, (pos.rectBottom || 0) + (typeof window !== 'undefined' ? window.scrollY : 0) - popupEstHeight)
    : Math.max(10, pos.top || (pos.rectTop + (typeof window !== 'undefined' ? window.scrollY : 0)));

  return createPortal(
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      style={{
        position: 'absolute',
        top: topPos,
        left: leftPos,
        width: popupWidth,
        zIndex: 99999,
        background: 'var(--bg-card)',
        border: '1.5px solid var(--border)',
        borderRadius: 12,
        boxShadow: '0 12px 36px rgba(0,0,0,.22), 0 2px 8px rgba(0,0,0,.1)',
        padding: '14px 16px',
        fontSize: 13,
        color: 'var(--text-base)',
        animation: 'popIn 0.15s ease-out',
        cursor: 'pointer',
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '18px 0', gap: 10, color: '#6366f1' }}>
          <div style={{ width: 18, height: 18, border: '2.5px solid #6366f1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'popSpinner 0.6s linear infinite' }} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>Loading bill details…</span>
        </div>
      ) : (
        <>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed var(--border)', paddingBottom: 8, marginBottom: 8 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, color: '#6366f1' }}>{detail.bill_number}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
                {formatISTDateTime(detail.created_at)}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {detail.store_name && <span className="badge badge-indigo" style={{ fontSize: 10.5 }}>{detail.store_name}</span>}
              <span className={`badge ${STATUS_BADGE[detail.status]}`} style={{ fontSize: 10.5 }}>{detail.status}</span>
            </div>
          </div>

          {/* Customer & Creator */}
          {(detail.customer_name || detail.customer_phone || detail.created_by_name) && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, background: 'var(--bg-base)', padding: '5px 10px', borderRadius: 6, marginBottom: 8 }}>
              <div>
                <span style={{ color: '#94a3b8' }}>Customer: </span>
                <span style={{ fontWeight: 600 }}>{detail.customer_name || 'Walk-in'}</span>
                {detail.customer_phone && <span style={{ color: '#64748b' }}> ({detail.customer_phone})</span>}
              </div>
              {detail.created_by_name && (
                <div>
                  <span style={{ color: '#94a3b8' }}>By: </span>
                  <span style={{ fontWeight: 600, color: '#6366f1' }}>{detail.created_by_name}</span>
                </div>
              )}
            </div>
          )}

          {/* Products listing */}
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', color: '#94a3b8', marginBottom: 5 }}>
            Products Added ({detail.items?.length || 0})
          </div>
          <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border-light)', borderRadius: 8, marginBottom: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--border)', color: '#64748b', fontSize: 10.5 }}>
                  <th style={{ padding: '5px 8px', textAlign: 'left' }}>Product</th>
                  <th style={{ padding: '5px 8px', textAlign: 'left' }}>Variation</th>
                  <th style={{ padding: '5px 8px', textAlign: 'center' }}>Qty</th>
                  <th style={{ padding: '5px 8px', textAlign: 'right' }}>Rate</th>
                  <th style={{ padding: '5px 8px', textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {(!detail.items || detail.items.length === 0) ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '10px', textAlign: 'center', color: '#94a3b8' }}>No items in this bill.</td>
                  </tr>
                ) : (
                  detail.items.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: idx < detail.items.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                      <td style={{ padding: '5px 8px', fontWeight: 600 }}>{item.product_name}</td>
                      <td style={{ padding: '5px 8px' }}>
                        {renderVariationLines(item, true)}
                      </td>
                      <td style={{ padding: '5px 8px', textAlign: 'center', fontWeight: 600 }}>{item.quantity}</td>
                      <td style={{ padding: '5px 8px', textAlign: 'right', color: '#64748b' }}>₹{parseFloat(item.unit_price).toFixed(2)}</td>
                      <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 700 }}>₹{parseFloat(item.subtotal).toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Totals */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed var(--border)', paddingTop: 6 }}>
            <PaymentBadge type={detail.payment_type} />
            <div style={{ textAlign: 'right', fontSize: 12 }}>
              {parseFloat(detail.discount) > 0 && <span style={{ fontSize: 11, color: '#ef4444', marginRight: 8 }}>Disc: -₹{parseFloat(detail.discount).toFixed(2)}</span>}
              {parseFloat(detail.tax) > 0 && <span style={{ fontSize: 11, color: '#f59e0b', marginRight: 8 }}>Tax: +₹{parseFloat(detail.tax).toFixed(2)}</span>}
              <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text-base)' }}>Total: ₹{parseFloat(detail.total_amount).toFixed(2)}</span>
            </div>
          </div>
        </>
      )}
    </div>,
    document.body
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function BillsPage() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [stores, setStores] = useState([]);
  const [modal, setModal] = useState(false);
  const [detail, setDetail] = useState(null);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);

  // ── Hover/Hold 1 sec preview state ─────────────────────────────────────
  const [hoveredBill, setHoveredBill] = useState(null);
  const [billCache, setBillCache] = useState({});
  const hoverTimerRef = useRef(null);
  const activeBillIdRef = useRef(null);
  const isOverPopoverRef = useRef(false);

  function handleEyeHoverStart(e, bill) {
    activeBillIdRef.current = bill.id;
    clearTimeout(hoverTimerRef.current);

    const rect = e.currentTarget.getBoundingClientRect();
    const pos = {
      top: rect.top + window.scrollY,
      rectLeft: rect.left,
      rectRight: rect.right,
      rectTop: rect.top,
      rectBottom: rect.bottom,
    };

    fetch(`/api/bills/${bill.id}`)
      .then(r => r.json())
      .then(data => {
        setBillCache(prev => ({ ...prev, [bill.id]: data }));
      })
      .catch(console.error);

    setHoveredBill({ billId: bill.id, pos });
  }

  function handleEyeHoverEnd() {
    activeBillIdRef.current = null;
    clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      if (!isOverPopoverRef.current) {
        setHoveredBill(null);
      }
    }, 150);
  }

  function handlePopoverMouseEnter() {
    isOverPopoverRef.current = true;
    clearTimeout(hoverTimerRef.current);
  }

  function handlePopoverMouseLeave() {
    isOverPopoverRef.current = false;
    setHoveredBill(null);
  }

  const { canEditBill, canAddBill, isAdmin, isSales, assignedStores, storePerms } = useRole();

  const availableStores = isAdmin
    ? stores
    : isSales
      // Sales: only show stores where user has 'minus' permission (can create bills)
      ? stores.filter(s => {
        const perms = storePerms[String(s.id)];
        return Array.isArray(perms) ? perms.includes('minus') : perms === 'minus';
      })
      : stores.filter(s => assignedStores.includes(Number(s.id)));

  // ── Filters ──────────────────────────────────────────────────────────────
  const [filterStore, setFilterStore] = useState('');
  const [filterPayment, setFilterPayment] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [filterDate, setFilterDate] = useState(''); // 'today','yesterday','week','month','custom',''
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Store stock map { product_id: stock }
  const [storeStock, setStoreStock] = useState({});
  const [storeFlavorStock, setStoreFlavorStock] = useState({});

  // Stock batches map { product_id: [{expiry_date, qty}] }
  const [stockBatches, setStockBatches] = useState({});

  // Inline add store
  const [showAddStore, setShowAddStore] = useState(false);
  const [newStoreName, setNewStoreName] = useState('');
  const [addingStore, setAddingStore] = useState(false);

  // Bill form
  const [storeId, setStoreId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentType, setPaymentType] = useState('cash');
  const [discount, setDiscount] = useState('0');
  const [tax, setTax] = useState('0');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([]);

  const billBarcodeRef = useRef(null);
  const productSearchRef = useRef(null);
  const modalBodyRef = useRef(null);
  const storeSelectRef = useRef(null);
  const custNameInputRef = useRef(null);
  const paymentGroupRef = useRef(null);
  const firstItemSelectRef = useRef(null);
  const pendingItemFocus = useRef(false);
  const discountRef = useRef(null);
  const taxRef = useRef(null);
  const notesRef = useRef(null);
  const submitRef = useRef(null);
  const firstItemPriceRef = useRef(null);
  const pendingQtyFocus = useRef(false);
  const addItemBtnRef = useRef(null);
  const itemQtyRefs = useRef([]);
  const itemSelectRefs = useRef([]);
  const itemPriceRefs = useRef([]);
  const billScanBufferRef = useRef('');
  const billScanTimerRef = useRef(null);
  const billLastKeyTimeRef = useRef(0);
  const billFirstCharRef = useRef('');

  // Same barcode scanner interception as purchase-orders:
  // first char passes through, second fast char triggers scanner mode —
  // strips the leaked char and blocks the rest until Enter.
  useEffect(() => {
    if (!modal) return;

    const SCAN_SPEED_MS = 50;

    function onKeyDown(e) {
      const now = Date.now();
      const gap = now - billLastKeyTimeRef.current;
      const inScan = billScanBufferRef.current.length > 0;

      // End key → submit the bill form
      if (e.key === 'End') {
        e.preventDefault();
        e.stopPropagation();
        submitRef.current?.click();
        return;
      }

      if (e.key === 'Enter') {
        if (billScanBufferRef.current.length > 2) {
          e.preventDefault();
          e.stopPropagation();
          const code = billScanBufferRef.current;
          billScanBufferRef.current = '';
          billFirstCharRef.current = '';
          clearTimeout(billScanTimerRef.current);
          billLastKeyTimeRef.current = 0;
          addByBarcodeForBill(code);
        }
        return;
      }

      if (e.key.length !== 1 || e.ctrlKey || e.altKey || e.metaKey) return;

      // Already in confirmed scan sequence — block everything
      if (inScan && gap < SCAN_SPEED_MS) {
        e.preventDefault();
        e.stopPropagation();
        billScanBufferRef.current += e.key;
        billLastKeyTimeRef.current = now;
        clearTimeout(billScanTimerRef.current);
        billScanTimerRef.current = setTimeout(() => {
          billScanBufferRef.current = '';
          billFirstCharRef.current = '';
          billLastKeyTimeRef.current = 0;
        }, 300);
        return;
      }

      // Second fast char — scanner just identified, strip the leaked first char
      if (!inScan && billLastKeyTimeRef.current !== 0 && gap < SCAN_SPEED_MS) {
        e.preventDefault();
        e.stopPropagation();
        // Strip the first char that already leaked into the focused field
        const active = document.activeElement;
        if (active && active !== billBarcodeRef.current && ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName)) {
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
        billScanBufferRef.current = billFirstCharRef.current + e.key;
        billFirstCharRef.current = '';
        billLastKeyTimeRef.current = now;
        clearTimeout(billScanTimerRef.current);
        billScanTimerRef.current = setTimeout(() => {
          billScanBufferRef.current = '';
          billLastKeyTimeRef.current = 0;
        }, 300);
        return;
      }

      // Slow / human keystroke — let it through, just track it
      billFirstCharRef.current = e.key;
      billLastKeyTimeRef.current = now;
      billScanBufferRef.current = '';
      clearTimeout(billScanTimerRef.current);
      billScanTimerRef.current = setTimeout(() => {
        billFirstCharRef.current = '';
        billLastKeyTimeRef.current = 0;
      }, 300);
    }

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      clearTimeout(billScanTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modal, products, storeId, stockBatches]);

  async function load() {
    setLoading(true);
    const [b, p, s] = await Promise.all([
      fetch('/api/bills').then(r => r.json()),
      fetch('/api/products?slim=1').then(r => r.json()),
      fetch('/api/stores').then(r => r.json()),
    ]);
    setBills(Array.isArray(b) ? b : []);
    setProducts(Array.isArray(p) ? p : []);
    setStores(Array.isArray(s) ? s : []);
    setLoading(false);
  }

  async function loadStoreStock(sid) {
    if (!sid) { setStoreStock({}); setStoreFlavorStock({}); return; }
    const rows = await fetch(`/api/store-products?store_id=${sid}`).then(r => r.json()).catch(() => []);
    if (Array.isArray(rows)) {
      const map = {};
      const flavorMap = {};
      rows.forEach(r => {
        map[r.product_id] = r.stock;
        flavorMap[r.product_id] = r.flavor_stocks || [];
      });
      setStoreStock(map);
      setStoreFlavorStock(flavorMap);
    }
  }

  useEffect(() => { load(); }, []);

  // Auto-select store filter if user has exactly one store
  useEffect(() => {
    if (availableStores.length === 1 && !filterStore) {
      setFilterStore(String(availableStores[0].id));
    }
  }, [availableStores, filterStore]);

  // ── Filtered bills (client-side) ─────────────────────────────────────────
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const weekStart = new Date(today); weekStart.setDate(today.getDate() - today.getDay());
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const filtered = bills.filter(b => {
    if (filterStore && String(b.store_id) !== String(filterStore)) return false;
    if (filterPayment && (b.payment_type || 'cash') !== filterPayment) return false;
    if (filterSearch) {
      const q = filterSearch.toLowerCase();
      if (
        !b.bill_number?.toLowerCase().includes(q) &&
        !(b.customer_name || '').toLowerCase().includes(q) &&
        !(b.customer_phone || '').includes(q)
      ) return false;
    }
    if (filterDate) {
      const d = new Date(b.created_at); d.setHours(0, 0, 0, 0);
      if (filterDate === 'today' && d.getTime() !== today.getTime()) return false;
      if (filterDate === 'yesterday' && d.getTime() !== yesterday.getTime()) return false;
      if (filterDate === 'week' && d < weekStart) return false;
      if (filterDate === 'month' && d < monthStart) return false;
      if (filterDate === 'custom') {
        if (dateFrom && d < new Date(dateFrom)) return false;
        if (dateTo && d > new Date(dateTo)) return false;
      }
    }
    return true;
  });

  const summary = filtered.reduce((acc, b) => {
    if (b.status === 'cancelled') return acc; // exclude cancelled from revenue
    acc.total += parseFloat(b.total_amount) || 0;
    acc.discount += parseFloat(b.discount) || 0;
    acc.count += 1;
    const pt = b.payment_type || 'cash';
    acc.byPayment[pt] = (acc.byPayment[pt] || 0) + (parseFloat(b.total_amount) || 0);
    return acc;
  }, { total: 0, discount: 0, count: 0, byPayment: {} });

  const hasFilter = !!(filterStore || filterPayment || filterSearch || filterDate);
  function clearFilters() { setFilterStore(''); setFilterPayment(''); setFilterSearch(''); setFilterDate(''); setDateFrom(''); setDateTo(''); setPage(1); }
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function loadProductBatches(sid, productId, itemIndex, variationId) {
    if (!sid || !productId) return;
    const vId = variationId;
    const key = vId ? `${productId}_${vId}` : `${productId}`;
    const url = `/api/stock-items/batches?store_id=${sid}&product_id=${productId}${vId ? `&variation_id=${vId}` : ''}`;
    const rows = await fetch(url).then(r => r.json()).catch(() => []);
    const batches = Array.isArray(rows) ? rows : [];
    setStockBatches(prev => ({ ...prev, [key]: batches }));
    // Auto-select the first batch for the item
    if (batches.length > 0 && itemIndex !== undefined) {
      setItems(prev => {
        const next = [...prev];
        if (next[itemIndex]) {
          next[itemIndex] = { ...next[itemIndex], expiry_date: batches[0].expiry_date ?? null };
        }
        return next;
      });
    }
  }

  function handleStoreChange(sid) {
    setStoreId(sid);
    loadStoreStock(sid);
    setItems([]);
    setStockBatches({});
  }

  function openNew() {
    // Auto-select store if user only has access to one
    const defaultStore = availableStores.length === 1 ? String(availableStores[0].id) : '';
    setStoreId(defaultStore);
    setCustomerName(''); setCustomerPhone('');
    setPaymentType('cash');
    setDiscount('0'); setTax('0'); setNotes('');
    setItems([]);
    setShowAddStore(false); setNewStoreName('');
    setStoreStock({});
    billScanBufferRef.current = '';
    billFirstCharRef.current = '';
    clearTimeout(billScanTimerRef.current);
    setModal(true);
    // If a store was auto-selected, load its stock immediately
    if (defaultStore) loadStoreStock(defaultStore);
    setTimeout(() => {
      if (billBarcodeRef.current) billBarcodeRef.current.value = '';
      // Open the store dropdown if multi-store
      if (!defaultStore) storeSelectRef.current?.click();
    }, 150);
  }

  async function handleAddStore() {
    if (!newStoreName.trim()) return;
    setAddingStore(true);
    try {
      const res = await fetch('/api/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newStoreName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success('Store added.');
      const updated = await fetch('/api/stores').then(r => r.json());
      setStores(Array.isArray(updated) ? updated : []);
      handleStoreChange(String(data.id));
      setNewStoreName('');
      setShowAddStore(false);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAddingStore(false);
    }
  }

  function addItem() { setItems([...items, { product_id: '', quantity: 1, unit_price: '' }]); }
  function removeItem(i) { setItems(items.filter((_, idx) => idx !== i)); }

  function addItemByProduct(itemOrProd) {
    const prod = itemOrProd.product || itemOrProd;
    const isSugg = Boolean(itemOrProd.product && itemOrProd.variation_id !== undefined);

    let defaultVariationId = isSugg ? itemOrProd.variation_id : null;
    let defaultPrice = isSugg ? itemOrProd.price : (prod.price || '');
    let defaultVariAttribute = isSugg ? itemOrProd.vari_attribute : null;

    if (!isSugg) {
      const hasVars = prod.flavor_prices && prod.flavor_prices.length > 0;
      if (hasVars) {
        const vp = prod.flavor_prices[0];
        defaultVariationId = String(vp.id);
        defaultPrice = (vp.sale_price && parseFloat(vp.sale_price) > 0) ? vp.sale_price : (vp.price || prod.price);
        defaultVariAttribute = formatVariationAttributes(vp.attributes);
      }
    }

    const newItem = {
      product_id: prod.id,
      quantity: 1,
      unit_price: defaultPrice,
      variation_id: defaultVariationId,
      vari_attribute: defaultVariAttribute,
    };
    setItems(prev => {
      const next = [...prev, newItem];
      if (storeId) loadProductBatches(storeId, prod.id, next.length - 1, defaultVariationId);
      return next;
    });
    pendingQtyFocus.current = true;
  }

  // Keep search input visible after adding
  useEffect(() => {
    if (!modal || items.length === 0) return;
    setTimeout(() => {
      // Always scroll modal body to bottom so new item is visible
      if (modalBodyRef.current) {
        modalBodyRef.current.scrollTop = modalBodyRef.current.scrollHeight;
      }
      if (pendingQtyFocus.current) {
        pendingQtyFocus.current = false;
        const lastRef = itemQtyRefs.current[items.length - 1];
        lastRef?.focus();
        lastRef?.select();
      } else if (pendingItemFocus.current) {
        pendingItemFocus.current = false;
        firstItemSelectRef.current?.click();
      } else {
        productSearchRef.current?.focus();
      }
    }, 80);
  }, [items.length]);

  function updateItem(i, field, val) {
    const updates = typeof field === 'object' ? field : { [field]: val };

    setItems(prev => {
      const next = [...prev];
      if (!next[i]) return next;
      const updatedItem = { ...next[i], ...updates };

      if (updates.product_id || updates.variation_id !== undefined) {
        const pId = updates.product_id || updatedItem.product_id;
        const vId = updates.variation_id !== undefined ? updates.variation_id : updatedItem.variation_id;
        if (updates.product_id) {
          const prod = products.find(p => String(p.id) === String(pId));
          if (prod) {
            const hasVars = prod.flavor_prices && prod.flavor_prices.length > 0;
            const defaultVarId = hasVars ? String(prod.flavor_prices[0].id) : null;
            let defaultPrice = prod.price || '';
            let defaultVariAttr = hasVars ? formatVariationAttributes(prod.flavor_prices[0].attributes) : null;
            if (hasVars) {
              const vp = prod.flavor_prices[0];
              defaultPrice = (vp.sale_price && parseFloat(vp.sale_price) > 0) ? vp.sale_price : (vp.price || prod.price);
            }
            updatedItem.unit_price = defaultPrice;
            updatedItem.variation_id = defaultVarId;
            updatedItem.vari_attribute = defaultVariAttr;
          }
        } else if (updates.variation_id !== undefined) {
          const prod = products.find(p => String(p.id) === String(updatedItem.product_id));
          if (prod && prod.flavor_prices) {
            const vp = prod.flavor_prices.find(v => String(v.id) === String(vId));
            if (vp) {
              const pVal = (vp.sale_price && parseFloat(vp.sale_price) > 0) ? vp.sale_price : (vp.price || prod.price);
              updatedItem.unit_price = pVal;
              updatedItem.vari_attribute = formatVariationAttributes(vp.attributes);
            }
          }
        }
        delete updatedItem.expiry_date;
        if (storeId && pId) loadProductBatches(storeId, pId, i, updatedItem.variation_id);
      }

      next[i] = updatedItem;
      return next;
    });
  }

  function addByBarcodeForBill(code) {
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
      let defaultVariationId = null;
      let defaultPrice = matchedProd.price || '';
      let varLabel = '';

      if (matchedVar) {
        defaultVariationId = String(matchedVar.id);
        defaultPrice = (matchedVar.sale_price && parseFloat(matchedVar.sale_price) > 0) ? matchedVar.sale_price : (matchedVar.price || matchedProd.price);
        varLabel = formatVariationAttributes(matchedVar.attributes);
      } else {
        const hasVars = matchedProd.flavor_prices && matchedProd.flavor_prices.length > 0;
        if (hasVars) {
          const vp = matchedProd.flavor_prices[0];
          defaultVariationId = String(vp.id);
          defaultPrice = (vp.sale_price && parseFloat(vp.sale_price) > 0) ? vp.sale_price : (vp.price || matchedProd.price);
          varLabel = formatVariationAttributes(vp.attributes);
        }
      }

      const batchKey = defaultVariationId ? `${matchedProd.id}_${defaultVariationId}` : String(matchedProd.id);
      const cachedBatches = stockBatches[batchKey] || [];
      const firstBatch = cachedBatches.length > 0 ? (cachedBatches[0].expiry_date ?? null) : undefined;

      setItems(prev => {
        const newItem = {
          product_id: matchedProd.id,
          quantity: 1,
          unit_price: defaultPrice,
          variation_id: defaultVariationId,
          vari_attribute: varLabel || null,
          ...(firstBatch !== undefined ? { expiry_date: firstBatch } : {}),
        };
        const newIndex = prev.length;
        if (storeId && cachedBatches.length === 0) loadProductBatches(storeId, matchedProd.id, newIndex, defaultVariationId);
        toast.success(`Added: ${matchedProd.name}${varLabel ? ` (${varLabel})` : ''}`);
        return [...prev, newItem];
      });
    }

    if (billBarcodeRef.current) billBarcodeRef.current.value = '';
    billScanBufferRef.current = '';
    billFirstCharRef.current = '';
    billBarcodeRef.current?.focus();
  }

  const subtotal = items.reduce((s, i) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.unit_price) || 0), 0);
  const discountAmt = parseFloat(discount) || 0;
  const taxAmt = parseFloat(tax) || 0;
  const total = subtotal - discountAmt + taxAmt;

  async function handleCreate(e) {
    e.preventDefault();
    if (!storeId) { toast.error('Please select a store.'); return; }
    if (items.length === 0) { toast.error('Add at least one item.'); return; }

    // Per-item validation with specific errors
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const num = i + 1;
      if (!it.product_id) { toast.error(`Item ${num}: select a product.`); return; }
      if (!it.quantity || parseInt(it.quantity) < 1) { toast.error(`Item ${num}: quantity must be at least 1.`); return; }
    }

    const validItems = items.filter(i => i.product_id && parseInt(i.quantity) > 0);

    // Validate manual batch selections — group by product+batch and check combined qty
    if (storeId) {
      // Block if any item has no batch selected
      for (const it of validItems) {
        const batches = stockBatches[String(it.product_id)] || [];
        if (batches.length > 0 && it.expiry_date === undefined) {
          const prod = products.find(p => String(p.id) === String(it.product_id));
          toast.error(`Please select a stock batch for "${prod?.name || 'a product'}".`);
          return;
        }
      }
    }
    setSaving(true);
    try {
      const res = await fetch('/api/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id: storeId || null,
          customer_name: customerName,
          customer_phone: customerPhone,
          payment_type: paymentType,
          items: validItems.map(it => ({
            product_id: it.product_id,
            variation_id: it.variation_id || null,
            quantity: it.quantity,
            unit_price: it.unit_price,
            expiry_date: it.expiry_date,
          })),
          discount: discountAmt,
          tax: taxAmt,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success(`Bill ${data.bill_number} created.`);
      setModal(false);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function openDetail(id) {
    const data = await fetch(`/api/bills/${id}`).then(r => r.json());
    setDetail(data);
  }

  async function updateStatus(id, status) {
    const res = await fetch(`/api/bills/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) { toast.success(`Bill marked as ${status}.`); setDetail(null); load(); }
    else { const d = await res.json(); toast.error(d.message); }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this bill?')) return;
    const res = await fetch(`/api/bills/${id}`, { method: 'DELETE' });
    if (res.ok) { toast.success('Deleted.'); load(); }
    else toast.error('Failed.');
  }

  async function printBill(id) {
    const data = await fetch(`/api/bills/${id}`).then(r => r.json());
    const PT_LABEL = { cash: 'Cash', card: 'Card', upi: 'UPI' };
    const subtotalAmt = (data.items || []).reduce((s, i) => s + parseFloat(i.subtotal || 0), 0);
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<title>${data.bill_number}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Inter',sans-serif;background:#fff;color:#000;font-size:13px;line-height:1.5}
  .receipt{max-width:360px;margin:0 auto;padding:24px 20px}

  /* Header */
  .header{text-align:center;padding-bottom:14px;border-bottom:2px solid #000;margin-bottom:14px}
  .brand{font-size:20px;font-weight:800;letter-spacing:-.5px;text-transform:uppercase;color:#000}
  .brand-sub{font-size:10px;font-weight:500;letter-spacing:.15em;text-transform:uppercase;color:#000;margin-top:2px}
  .bill-no{font-size:11px;font-weight:700;letter-spacing:.1em;margin-top:8px;text-transform:uppercase;color:#000}

  /* Info rows */
  .info-section{margin-bottom:12px;padding-bottom:12px;border-bottom:1px dashed #000}
  .info-row{display:flex;justify-content:space-between;font-size:12px;padding:2px 0}
  .info-row .label{color:#000;font-weight:500}
  .info-row .value{font-weight:600;text-align:right;color:#000}

  /* Items table */
  table{width:100%;border-collapse:collapse;margin-bottom:12px}
  thead tr{border-bottom:1.5px solid #000}
  thead th{padding:6px 4px;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;text-align:left;color:#000}
  thead th:last-child{text-align:right}
  tbody td{padding:6px 4px;font-size:12.5px;border-bottom:1px dashed #000;vertical-align:top;color:#000}
  tbody td:last-child{text-align:right;font-weight:600}
  tbody tr:last-child td{border-bottom:none}
  .item-name{font-weight:600;color:#000}
  .item-meta{font-size:11px;color:#000;margin-top:1px}

  /* Totals */
  .totals{border-top:1px dashed #000;padding-top:10px;margin-bottom:14px}
  .total-row{display:flex;justify-content:space-between;font-size:12.5px;padding:3px 0;color:#000}
  .total-final{display:flex;justify-content:space-between;font-size:16px;font-weight:800;padding:10px 0 0;border-top:2px solid #000;margin-top:6px;color:#000}

  /* Footer */
  .footer{text-align:center;padding-top:14px;border-top:1px dashed #000;font-size:11px;color:#000;line-height:1.8}
  .footer .thank{font-size:13px;font-weight:700;color:#000;letter-spacing:.05em;text-transform:uppercase;margin-bottom:4px}

  @media print{
    body{padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    @page{margin:6mm;size:80mm auto}
    .receipt{padding:0}
  }
</style></head><body>
<div class="receipt">

  <div class="header">
    <div class="brand">Invincible Fitness</div>
    <div class="bill-no">Receipt No: ${data.bill_number}</div>
  </div>

  <div class="info-section">
    <div class="info-row"><span class="label">Date &amp; Time</span><span class="value">${formatISTDateTime(data.created_at)}</span></div>
    ${data.store_name ? `<div class="info-row"><span class="label">Store</span><span class="value">${data.store_name}</span></div>` : ''}
    ${data.customer_name ? `<div class="info-row"><span class="label">Customer</span><span class="value">${data.customer_name}</span></div>` : ''}
    ${data.customer_phone ? `<div class="info-row"><span class="label">Phone</span><span class="value">${data.customer_phone}</span></div>` : ''}
    <div class="info-row"><span class="label">Payment</span><span class="value">${PT_LABEL[data.payment_type || 'cash'] || 'Cash'}</span></div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:40%">Item</th>
        <th style="text-align:center">Qty</th>
        <th style="text-align:right">Rate</th>
        <th style="text-align:right">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${(data.items || []).map(item => {
      const expLabel = item.expiry_date
        ? new Date(item.expiry_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : null;
      const varText = item.vari_attribute || formatVariationAttributes(item.variation_attributes);
      return `
        <tr>
          <td>
            <div class="item-name">${item.product_name}</div>
            ${varText ? `<div class="item-meta" style="color:#6366f1;font-weight:600">Variation: ${varText}</div>` : ''}
            ${expLabel ? `<div class="item-meta">Exp: ${expLabel}</div>` : ''}
          </td>
          <td style="text-align:center">${item.quantity}</td>
          <td style="text-align:right">Rs.${parseFloat(item.unit_price).toFixed(2)}</td>
          <td>Rs.${parseFloat(item.subtotal).toFixed(2)}</td>
        </tr>`;
    }).join('')}
    </tbody>
  </table>

  <div class="totals">
    <div class="total-row"><span>Subtotal</span><span>Rs.${subtotalAmt.toFixed(2)}</span></div>
    ${parseFloat(data.discount) > 0 ? `<div class="total-row"><span>Discount</span><span>- Rs.${parseFloat(data.discount).toFixed(2)}</span></div>` : ''}
    ${parseFloat(data.tax) > 0 ? `<div class="total-row"><span>Tax</span><span>+ Rs.${parseFloat(data.tax).toFixed(2)}</span></div>` : ''}
    <div class="total-final"><span>TOTAL</span><span>Rs.${parseFloat(data.total_amount).toFixed(2)}</span></div>
  </div>

  ${data.notes ? `<div style="font-size:11.5px;color:#000;margin-bottom:14px;padding:8px 10px;border:1px dashed #000;border-radius:4px"><strong>Note:</strong> ${data.notes}</div>` : ''}

  <div class="footer">
    <div class="thank">Thank You</div>
    <div>Please visit us again</div>
    <div style="margin-top:4px;font-size:10px;color:#000">Printed: ${new Date().toLocaleString('en-IN')}</div>
  </div>

</div>
<script>window.onload=()=>{window.print();window.onafterprint=()=>window.close();}<\/script>
</body></html>`);
    win.document.close();
  }



  return (
    <Layout title="Bills">

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Bills ({filtered.length}{filtered.length !== bills.length ? ` of ${bills.length}` : ''})</div>
            <div className="card-sub">Stock is deducted from the selected store</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {hasFilter && <button className="btn btn-secondary btn-sm" onClick={clearFilters}>✕ Clear</button>}
            {canAddBill && <button className="btn btn-primary" onClick={openNew}>+ New Bill</button>}
          </div>
        </div>

        {/* ── Filter bar ── */}
        <div className="filter-row" style={{ display: 'flex', gap: 12, padding: '12px 22px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ minWidth: 180 }}>
            <SearchableSelect
              options={availableStores.map(s => ({ value: s.id, label: s.name }))}
              value={filterStore}
              onChange={setFilterStore}
              placeholder={isAdmin ? "All Stores" : "Select Store"}
            />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[{ k: '', label: 'All' }, { k: 'cash', label: '💵 Cash' }, { k: 'card', label: '💳 Card' }, { k: 'upi', label: '📱 UPI' }].map(({ k, label }) => (
              <button key={k} onClick={() => setFilterPayment(k)}
                className={`btn btn-sm ${filterPayment === k ? 'btn-primary' : 'btn-secondary'}`}>{label}</button>
            ))}
          </div>
          <input value={filterSearch} onChange={e => setFilterSearch(e.target.value)}
            placeholder="Search bill no. / customer…"
            style={{ flex: '1 1 150px', minWidth: 0, padding: '7px 12px', border: '1.5px solid var(--border)', borderRadius: 6, fontSize: 13, background: 'var(--bg-input)', color: 'var(--text-base)' }} />
        </div>

        {/* ── Date filter row ── */}
        <div style={{ display: 'flex', gap: 8, padding: '10px 22px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', alignItems: 'center', background: 'var(--bg-base)' }}>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.4px', marginRight: 2 }}>Date:</span>
          {[
            { k: 'today', label: 'Today' },
            { k: 'yesterday', label: 'Yesterday' },
            { k: 'week', label: 'This Week' },
            { k: 'month', label: 'This Month' },
            { k: '', label: 'All Time' },
            { k: 'custom', label: 'Custom' },
          ].map(({ k, label }) => (
            <button key={k} onClick={() => setFilterDate(k)}
              className={`btn btn-sm ${filterDate === k ? 'btn-primary' : 'btn-secondary'}`}>
              {label}
            </button>
          ))}
          {filterDate === 'custom' && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 4 }}>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                style={{ padding: '5px 10px', border: '1.5px solid var(--border)', borderRadius: 6, fontSize: 13, background: 'var(--bg-input)', color: 'var(--text-base)' }} />
              <span style={{ color: 'var(--text-faint)', fontSize: 13 }}>→</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                style={{ padding: '5px 10px', border: '1.5px solid var(--border)', borderRadius: 6, fontSize: 13, background: 'var(--bg-input)', color: 'var(--text-base)' }} />
            </div>
          )}
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Bill No.</th>
                <th className="hide-mobile">Store</th>
                <th>Customer</th>
                <th className="hide-mobile">Payment</th>
                <th className="hide-mobile">Created By</th>
                <th className="hide-mobile">Status</th>
                <th>Total</th>
                <th className="hide-mobile">DATE &amp; TIME</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableLoader cols={10} />
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10}>
                    <div className="empty-state">
                      <div className="empty-state-icon">🧾</div>
                      <p>{hasFilter ? 'No bills match your filters.' : 'No bills yet.'}</p>
                    </div>
                  </td>
                </tr>
              ) : paged.map((b, i) => (
                <tr key={b.id}>
                  <td style={{ color: '#94a3b8', fontSize: 12 }}>{(page - 1) * PAGE_SIZE + i + 1}</td>
                  <td>
                    <strong style={{ color: '#6366f1' }}>{b.bill_number}</strong>
                    <div className="show-mobile" style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{formatISTDateTime(b.created_at)}</div>
                  </td>
                  <td className="hide-mobile">
                    {b.store_name
                      ? <span className="badge badge-indigo">{b.store_name}</span>
                      : <span style={{ color: '#94a3b8' }}>—</span>}
                  </td>
                  <td>
                    {b.customer_name
                      ? <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{b.customer_name}</div>
                        {b.customer_phone && <div style={{ fontSize: 11.5, color: '#64748b' }}>{b.customer_phone}</div>}
                      </div>
                      : <span style={{ color: '#94a3b8' }}>—</span>}
                  </td>
                  <td className="hide-mobile"><PaymentBadge type={b.payment_type} /></td>
                  <td className="hide-mobile">
                    {b.created_by_name
                      ? <span style={{ fontSize: 12, fontWeight: 600, color: '#6366f1' }}>{b.created_by_name}</span>
                      : <span style={{ color: '#94a3b8' }}>—</span>}
                  </td>
                  <td className="hide-mobile"><span className={`badge ${STATUS_BADGE[b.status]}`}>{b.status}</span></td>
                  <td style={{ fontWeight: 700 }}>₹{parseFloat(b.total_amount).toFixed(2)}</td>
                  <td className="hide-mobile" style={{ fontSize: 12, color: '#94a3b8' }}>{formatISTDateTime(b.created_at)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => { setHoveredBill(null); openDetail(b.id); }}
                        onMouseEnter={e => handleEyeHoverStart(e, b)}
                        onMouseLeave={handleEyeHoverEnd}
                        onTouchStart={e => handleEyeHoverStart(e, b)}
                        onTouchEnd={handleEyeHoverEnd}
                        title="View bill"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => printBill(b.id)} title="Print bill">🖨️</button>

                      {isAdmin && <button className="btn btn-danger btn-sm" onClick={() => handleDelete(b.id)}>🗑️</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} />
      </div>

      {/* ── New Bill Modal ── */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal" ref={modalBodyRef} style={{ maxWidth: 720 }}>
            <div className="modal-header">
              <span className="modal-title">New Bill</span>
              <button className="modal-close" onClick={() => setModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">

                {/* Store selector */}
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label>Store</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <SearchableSelect
                        options={availableStores.map(s => ({ value: s.id, label: s.name }))}
                        value={storeId}
                        onChange={v => handleStoreChange(v)}
                        placeholder="— Select Store —"
                        selectRef={storeSelectRef}
                        onAfterSelect={() => setTimeout(() => custNameInputRef.current?.focus(), 50)}
                      />
                    </div>
                    {isAdmin && (
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAddStore(v => !v)}>
                        {showAddStore ? 'Cancel' : '+ New Store'}
                      </button>
                    )}
                  </div>
                  {isAdmin && showAddStore && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <input value={newStoreName} onChange={e => setNewStoreName(e.target.value)} placeholder="Store name…" style={{ flex: 1 }} />
                      <button type="button" className="btn btn-primary btn-sm" onClick={handleAddStore} disabled={addingStore}>
                        {addingStore ? 'Adding…' : 'Add'}
                      </button>
                    </div>
                  )}
                  {storeId && (
                    <div style={{ marginTop: 6, fontSize: 12, color: '#6366f1' }}>
                      Stock will be deducted from: <strong>{stores.find(s => String(s.id) === String(storeId))?.name}</strong>
                    </div>
                  )}
                </div>

                {/* ── Rest of form — only visible after store is selected ── */}
                {storeId && (
                  <>
                    {/* ── Customer search ── */}
                    <div style={{ marginBottom: 16 }}>
                      <CustomerSearch
                        name={customerName}
                        phone={customerPhone}
                        onNameChange={setCustomerName}
                        onPhoneChange={setCustomerPhone}
                        onSelect={c => { setCustomerName(c.name); setCustomerPhone(c.phone || ''); }}
                        nameInputRef={custNameInputRef}
                        onPhoneTab={() => paymentGroupRef.current?.querySelector('[tabindex="0"]')?.focus()}
                      />
                    </div>

                    {/* ── Payment Type ── */}
                    <div className="form-group" style={{ marginBottom: 16 }}>
                      <label>Payment Type</label>
                      <div style={{ display: 'flex', gap: 8 }} ref={paymentGroupRef}>
                        {[
                          { value: 'cash', label: '💵 Cash', color: '#10b981' },
                          { value: 'card', label: '💳 Card', color: '#3b82f6' },
                          { value: 'upi', label: '📱 UPI', color: '#8b5cf6' },
                        ].map(pt => (
                          <button
                            key={pt.value}
                            type="button"
                            tabIndex={paymentType === pt.value ? 0 : -1}
                            onClick={() => setPaymentType(pt.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                productSearchRef.current?.focus();
                                return;
                              }
                              if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
                              e.preventDefault();
                              const PT = ['cash', 'card', 'upi'];
                              const next = e.key === 'ArrowRight'
                                ? PT[(PT.indexOf(paymentType) + 1) % PT.length]
                                : PT[(PT.indexOf(paymentType) - 1 + PT.length) % PT.length];
                              setPaymentType(next);
                              setTimeout(() => paymentGroupRef.current?.querySelector('[tabindex="0"]')?.focus(), 0);
                            }}
                            style={{
                              flex: 1,
                              padding: '9px 0',
                              borderRadius: 8,
                              border: `2px solid ${paymentType === pt.value ? pt.color : '#e2e8f0'}`,
                              background: paymentType === pt.value ? `${pt.color}20` : 'var(--bg-card)',
                              color: paymentType === pt.value ? pt.color : 'var(--text-muted)',
                              fontWeight: 700,
                              fontSize: 13.5,
                              cursor: 'pointer',
                              transition: 'all .15s',
                            }}
                          >
                            {pt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 13 }}>Bill Items</div>

                    {/* Barcode scanner */}
                    <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--bg-base)', border: '1.5px solid #6366f1', borderRadius: 8, boxShadow: '0 0 0 3px rgba(99,102,241,.1)' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="7" y1="7" x2="7" y2="17" /><line x1="10" y1="7" x2="10" y2="17" /><line x1="13" y1="7" x2="13" y2="11" /><line x1="16" y1="7" x2="16" y2="17" /><line x1="13" y1="14" x2="13" y2="17" />
                      </svg>
                      <input
                        ref={billBarcodeRef}
                        type="text"
                        defaultValue=""
                        onKeyDown={e => {
                          if (e.key !== 'Enter') return;
                          e.preventDefault();
                          addByBarcodeForBill(billBarcodeRef.current?.value || '');
                        }}
                        placeholder="Scan or type barcode, press Enter to add"
                        style={{ flex: 1, fontSize: 13.5, border: 'none', background: 'transparent', outline: 'none', color: 'var(--text-base)' }}
                        autoComplete="off"
                      />
                    </div>

                    {/* Product search add */}
                    <ProductSearchAdd
                      products={products}
                      storeStock={storeStock}
                      storeFlavorStock={storeFlavorStock}
                      storeId={storeId}
                      onAdd={addItemByProduct}
                      inputRef={productSearchRef}
                    />
                    {/* ── Item cards ── */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {items.map((item, i) => {
                        const avail = item.product_id
                          ? (storeId ? (storeStock[item.product_id] ?? 0) : (products.find(p => String(p.id) === String(item.product_id))?.stock ?? 0))
                          : null;
                        const qty = parseInt(item.quantity) || 0;
                        const batches = storeId && item.product_id ? (stockBatches[String(item.product_id)] || []) : [];
                        const batchesLoaded = storeId && item.product_id && stockBatches[String(item.product_id)] !== undefined;
                        const rowToday = new Date(); rowToday.setHours(0, 0, 0, 0);
                        const rowSoon = new Date(rowToday); rowSoon.setDate(rowToday.getDate() + 30);
                        const selBatch = item.expiry_date !== undefined && batches.length > 0
                          ? batches.find(b => (b.expiry_date || null) === (item.expiry_date || null))
                          : null;
                        const batchQty = selBatch ? parseInt(selBatch.qty) : null;
                        const overLimit = batchQty !== null && qty > batchQty;
                        const exp = selBatch?.expiry_date ? new Date(selBatch.expiry_date) : null;
                        const isExpired = exp && exp < rowToday;
                        const isSoon = exp && !isExpired && exp <= rowSoon;
                        const subtotalAmt = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);

                        return (
                          <div key={i} style={{
                            background: i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-base)',
                            border: '1.5px solid var(--border)',
                            borderRadius: 10,
                            padding: '12px 14px',
                          }}>
                            {/* Product row */}
                            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                              <div style={{ flex: 1 }}>
                                <SearchableSelect
                                  options={products.map(p => ({
                                    value: p.id,
                                    label: p.name,
                                    sub: `${p.barcode ? `${p.barcode} · ` : ''}Stock: ${storeId ? (storeStock[p.id] ?? 0) : p.stock} · ₹${parseFloat(p.price).toFixed(2)}`,
                                  }))}
                                  value={item.product_id}
                                  onChange={v => updateItem(i, 'product_id', v)}
                                  placeholder="Search product…"
                                  selectRef={i === items.length - 1 ? firstItemSelectRef : undefined}
                                  onAfterSelect={() => setTimeout(() => itemQtyRefs.current[i]?.focus(), 50)}
                                />
                              </div>
                              <button type="button" onClick={() => removeItem(i)} style={{
                                flexShrink: 0, width: 30, height: 30, borderRadius: 6, border: 'none',
                                background: '#fee2e2', color: '#ef4444', fontSize: 18, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                              }}>×</button>
                            </div>

                            {/* Variation Selector for Variable Products */}
                            {(() => {
                              const selProd = products.find(p => String(p.id) === String(item.product_id));
                              if (!selProd || !selProd.flavor_prices || selProd.flavor_prices.length === 0) return null;

                              const varOptions = selProd.flavor_prices.map(vp => ({
                                id: String(vp.id),
                                label: formatVariationAttributes(vp.attributes) || `Variation #${vp.id}`,
                                attributes: vp.attributes,
                                barcode: vp.barcode || '',
                                price: vp.price,
                                sale_price: vp.sale_price,
                              }));

                              return (
                                <div style={{ marginTop: 8 }}>
                                  <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.3px' }}>
                                    <span>Variation *</span>
                                  </div>
                                  <SearchableSelect
                                    options={varOptions.map(opt => {
                                      const pVal = (opt.sale_price && parseFloat(opt.sale_price) > 0) ? opt.sale_price : (opt.price || selProd.price);
                                      const fQty = getVariationStock(selProd, opt, storeFlavorStock);
                                      return {
                                        value: opt.id,
                                        label: opt.label,
                                        sub: `${opt.barcode ? `Barcode: ${opt.barcode} · ` : ''}₹${parseFloat(pVal || 0).toFixed(2)} · ${fQty} in stock`
                                      };
                                    })}
                                    value={item.variation_id ? String(item.variation_id) : ''}
                                    onChange={val => {
                                      const match = varOptions.find(o => o.id === val);
                                      if (match) {
                                        const pVal = (match.sale_price && parseFloat(match.sale_price) > 0) ? match.sale_price : (match.price || selProd.price);
                                        updateItem(i, {
                                          variation_id: match.id,
                                          ...(pVal ? { unit_price: pVal } : {})
                                        });
                                      }
                                    }}
                                    placeholder="— Select Variation —"
                                  />
                                </div>
                              );
                            })()}

                            {/* Batch selector */}
                            {(() => {
                              const batchKey = item.variation_id ? `${item.product_id}_${item.variation_id}` : String(item.product_id);
                              const batches = storeId && item.product_id ? (stockBatches[batchKey] || []) : [];
                              const batchesLoaded = storeId && item.product_id && stockBatches[batchKey] !== undefined;

                              if (!storeId || !item.product_id || batches.length === 0) return null;

                              return (
                                <div style={{ marginTop: 8 }}>
                                  <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.3px' }}>Batch</div>
                                  <BatchSelect batches={batches} value={item.expiry_date} onChange={v => updateItem(i, 'expiry_date', v)} today={rowToday} soon={rowSoon} />
                                  {selBatch && (isExpired || isSoon || overLimit) && (
                                    <div style={{ marginTop: 5, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                      {isExpired && <span style={{ fontSize: 11, fontWeight: 700, color: '#ef4444' }}>⚠️ Batch expired</span>}
                                      {isSoon && !isExpired && <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b' }}>⚠️ Expiring within 30 days</span>}
                                      {overLimit && <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,.1)', padding: '1px 7px', borderRadius: 5, border: '1px solid rgba(245,158,11,.3)' }}>⚠️ Exceeds batch stock ({batchQty} avail) — stock will go negative</span>}
                                    </div>
                                  )}
                                  {batches.length === 0 && avail === 0 && (
                                    <div style={{ marginTop: 4, fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>⚠️ No stock available — will go negative</div>
                                  )}
                                </div>
                              );
                            })()}

                            {/* Qty · Price · Available · Subtotal */}
                            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginTop: 10, flexWrap: 'wrap' }}>
                              <div>
                                <div style={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Qty</div>
                                <input type="number" min="1" value={item.quantity}
                                  ref={el => {
                                    itemQtyRefs.current[i] = el;
                                  }}
                                  onChange={e => updateItem(i, 'quantity', e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      itemPriceRefs.current[i]?.focus();
                                      itemPriceRefs.current[i]?.select();
                                    }
                                  }}
                                  style={{ width: 64, padding: '5px 8px', border: `1.5px solid ${overLimit ? '#f59e0b' : 'var(--border)'}`, borderRadius: 6, fontSize: 13, background: 'var(--bg-input)', color: 'var(--text-base)' }}
                                />
                              </div>
                              <div>
                                <div style={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Unit Price (₹)</div>
                                <input type="number" min="0" step="0.01" value={item.unit_price}
                                  ref={el => { itemPriceRefs.current[i] = el; if (i === 0) firstItemPriceRef.current = el; }}
                                  onChange={e => updateItem(i, 'unit_price', e.target.value)}
                                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItemBtnRef.current?.focus(); } }}
                                  style={{ width: 90, padding: '5px 8px', border: '1.5px solid var(--border)', borderRadius: 6, fontSize: 13, background: 'var(--bg-input)', color: 'var(--text-base)' }}
                                />
                              </div>
                              {avail !== null && (
                                <div>
                                  <div style={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Available</div>
                                  {(() => {
                                    let displayQty;
                                    const selProd = products.find(p => String(p.id) === String(item.product_id));
                                    const hasVars = selProd && selProd.flavor_prices && selProd.flavor_prices.length > 0;
                                    if (hasVars && item.variation_id) {
                                      const selVar = selProd.flavor_prices.find(v => String(v.id) === String(item.variation_id));
                                      displayQty = getVariationStock(selProd, selVar || { id: item.variation_id, attributes: item.vari_attribute }, storeFlavorStock);
                                    } else if (hasVars && !item.variation_id) {
                                      displayQty = 0;
                                    } else if (batchQty !== null) {
                                      displayQty = batchQty;
                                    } else if (batchesLoaded) {
                                      // batches fetched — sum all batch qtys as real available
                                      displayQty = batches.reduce((s, b) => s + parseInt(b.qty || 0), 0);
                                    } else {
                                      displayQty = avail; // not yet fetched, show storeStock
                                    }
                                    return <span className={`badge ${displayQty > 10 ? 'badge-green' : displayQty > 0 ? 'badge-amber' : 'badge-red'}`}>{displayQty}</span>;
                                  })()}
                                </div>
                              )}
                              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                                <div style={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Subtotal</div>
                                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-base)' }}>₹{subtotalAmt.toFixed(2)}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div style={{ marginTop: 10 }}>
                      <button ref={addItemBtnRef} type="button" className="btn btn-secondary btn-sm"
                        onClick={() => { addItem(); pendingItemFocus.current = true; setTimeout(() => productSearchRef.current?.focus(), 50); }}
                        onKeyDown={e => { if (e.key === 'ArrowRight' || e.key === 'Tab') { /* natural tab */ } else if (e.key === 'd' || e.key === 'D') { e.preventDefault(); discountRef.current?.focus(); } }}
                      >+ Add Item</button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
                      <div className="form-group">
                        <label>Discount (₹)</label>
                        <input ref={discountRef} type="number" min="0" step="0.01" value={discount} onChange={e => setDiscount(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); taxRef.current?.focus(); taxRef.current?.select(); } }} />
                      </div>
                      <div className="form-group">
                        <label>Tax (₹)</label>
                        <input ref={taxRef} type="number" min="0" step="0.01" value={tax} onChange={e => setTax(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); notesRef.current?.focus(); notesRef.current?.select(); } }} />
                      </div>
                      <div className="form-group" style={{ gridColumn: '1/-1' }}>
                        <label>Notes</label>
                        <input ref={notesRef} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes…"
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submitRef.current?.focus(); } }} />
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', marginTop: 12, fontSize: 13, color: 'var(--text-muted)' }}>
                      <div>Subtotal: ₹{subtotal.toFixed(2)}</div>
                      <div>Discount: -₹{discountAmt.toFixed(2)}</div>
                      <div>Tax: +₹{taxAmt.toFixed(2)}</div>
                      <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-base)', marginTop: 4 }}>Total: ₹{total.toFixed(2)}</div>
                    </div>
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
                <button type="submit" ref={submitRef} className="btn btn-primary" disabled={saving}>{saving ? 'Creating…' : 'Create Bill'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Detail Modal ── */}
      {detail && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDetail(null)}>
          <div className="modal" style={{ maxWidth: 780 }}>
            <div className="modal-header">
              <span className="modal-title">Bill: {detail.bill_number}</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => printBill(detail.id)}>🖨️ Print</button>
                <button className="modal-close" onClick={() => setDetail(null)}>×</button>
              </div>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16, fontSize: 13 }}>
                <div><strong>Store:</strong> {detail.store_name ? <span className="badge badge-indigo">{detail.store_name}</span> : '—'}</div>
                <div><strong>Status:</strong> <span className={`badge ${STATUS_BADGE[detail.status]}`}>{detail.status}</span></div>
                <div><strong>Customer:</strong> {detail.customer_name || '—'}</div>
                <div><strong>Phone:</strong> {detail.customer_phone || '—'}</div>
                <div><strong>Created By:</strong> {detail.created_by_name || '—'}</div>
                <div><strong>Date &amp; Time:</strong> {formatISTDateTime(detail.created_at)}</div>
                <div><strong>Payment:</strong> {
                  (() => {
                    const pt = detail.payment_type || 'cash';
                    const cfg = { cash: { label: '💵 Cash', color: '#10b981', bg: 'rgba(16,185,129,.15)' }, card: { label: '💳 Card', color: '#3b82f6', bg: 'rgba(59,130,246,.15)' }, upi: { label: '📱 UPI', color: '#8b5cf6', bg: 'rgba(139,92,246,.15)' } };
                    const c = cfg[pt] || cfg.cash;
                    return <span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: 99, background: c.bg, color: c.color, fontSize: 12, fontWeight: 700 }}>{c.label}</span>;
                  })()
                }</div>
              </div>

              <table className="items-table">
                <thead><tr><th>Product</th><th>Variation</th><th>Qty</th><th>Unit Price</th><th>Subtotal</th><th>Expiry</th></tr></thead>
                <tbody>
                  {(detail.items || []).map(item => {
                    const detailToday = new Date(); detailToday.setHours(0, 0, 0, 0);
                    const detailSoon = new Date(detailToday); detailSoon.setDate(detailToday.getDate() + 30);
                    const exp = item.expiry_date ? new Date(item.expiry_date) : null;
                    const isExpired = exp && exp < detailToday;
                    const isSoon = exp && !isExpired && exp <= detailSoon;
                    const color = isExpired ? '#ef4444' : isSoon ? '#f59e0b' : '#10b981';
                    const expiryLabel = item.expiry_date
                      ? new Date(item.expiry_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                      : null;
                    return (
                      <tr key={item.id}>
                        <td style={{ fontWeight: 600 }}>{item.product_name}</td>
                        <td>
                          {renderVariationLines(item, false)}
                        </td>
                        <td>{item.quantity}</td>
                        <td>₹{parseFloat(item.unit_price).toFixed(2)}</td>
                        <td>₹{parseFloat(item.subtotal).toFixed(2)}</td>
                        <td>
                          {expiryLabel
                            ? <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 99, background: `${color}18`, color, fontWeight: 700, fontSize: 11, border: `1px solid ${color}40` }}>
                              {expiryLabel}{isExpired ? ' ⚠️' : isSoon ? ' ⚠️' : ''}
                            </span>
                            : <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div style={{ textAlign: 'right', marginTop: 12, fontSize: 13, color: 'var(--text-muted)' }}>
                <div>Discount: -₹{parseFloat(detail.discount).toFixed(2)}</div>
                <div>Tax: +₹{parseFloat(detail.tax).toFixed(2)}</div>
                <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-base)', marginTop: 4 }}>
                  Total: ₹{parseFloat(detail.total_amount).toFixed(2)}
                </div>
              </div>

              {detail.status === 'paid' && canEditBill && (
                <div style={{ marginTop: 16 }}>
                  <button
                    className="btn btn-danger"
                    onClick={() => {
                      if (confirm('Cancel this bill? This cannot be undone.')) {
                        updateStatus(detail.id, 'cancelled');
                      }
                    }}
                  >
                    Cancel Bill
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {hoveredBill && (
        <BillHoverPopup
          billId={hoveredBill.billId}
          pos={hoveredBill.pos}
          cache={billCache}
          onMouseEnter={handlePopoverMouseEnter}
          onMouseLeave={handlePopoverMouseLeave}
          onClick={() => { setHoveredBill(null); openDetail(hoveredBill.billId); }}
        />
      )}
    </Layout>
  );
}
