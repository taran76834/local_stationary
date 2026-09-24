import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export default function SearchableSelect({
  options = [],
  value = '',
  onChange,
  placeholder = '— Select —',
  disabled = false,
  selectRef,        // optional — parent can pass a ref to focus the trigger button
  onAfterSelect,    // optional — called after a value is picked
}) {
  const [open,      setOpen]      = useState(false);
  const [search,    setSearch]    = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const [dropPos,   setDropPos]   = useState({ top: 0, left: 0, width: 0 });
  const internalRef = useRef(null);
  const triggerRef  = selectRef || internalRef;   // use parent ref if provided
  const searchRef   = useRef(null);
  const dropRef     = useRef(null);

  const selected = options.find(o => String(o.value) === String(value));
  const filtered  = options.filter(o =>
    o.label.toLowerCase().includes(search.toLowerCase()) ||
    (o.sub || '').toLowerCase().includes(search.toLowerCase())
  );

  function calcPos() {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setDropPos({
      top:   rect.bottom + window.scrollY + 4,
      left:  rect.left   + window.scrollX,
      width: rect.width,
    });
  }

  function openDrop() {
    if (disabled) return;
    calcPos();
    setOpen(v => !v);
  }

  useEffect(() => {
    if (!open) return;
    const onScroll = () => calcPos();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handle(e) {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        dropRef.current    && !dropRef.current.contains(e.target)
      ) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  // Focus search input and reset index when dropdown opens
  useEffect(() => {
    if (open) {
      setActiveIdx(0);
      if (searchRef.current) searchRef.current.focus();
    }
  }, [open]);

  // Reset active index when search changes
  useEffect(() => { setActiveIdx(0); }, [search]);

  function select(val) {
    onChange(val);
    setOpen(false);
    setSearch('');
    onAfterSelect?.();
    // return focus to trigger after selection
    setTimeout(() => triggerRef.current?.focus(), 0);
  }

  // Keyboard on the search input inside the dropdown
  function handleSearchKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered.length > 0) select(filtered[activeIdx]?.value ?? filtered[0].value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      setSearch('');
      triggerRef.current?.focus();
    }
  }

  // Keyboard on the trigger button (closed state)
  function handleTriggerKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openDrop();
    }
  }

  const dropdown = open && (
    <div
      ref={dropRef}
      style={{
        position:  'absolute',
        top:       dropPos.top,
        left:      dropPos.left,
        width:     dropPos.width,
        background: 'var(--bg-card, #fff)',
        border:    '1.5px solid var(--border, #e2e8f0)',
        borderRadius: 8,
        boxShadow: '0 8px 32px rgba(0,0,0,.14)',
        zIndex:    9999,
        overflow:  'hidden',
      }}
    >
      <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-light, #f1f5f9)' }}>
        <input
          ref={searchRef}
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder="Search…"
          style={{
            width: '100%',
            padding: '6px 10px',
            border: '1.5px solid var(--border, #e2e8f0)',
            borderRadius: 6,
            fontSize: 13,
            outline: 'none',
            background: 'var(--bg-input, #fff)',
            color: 'var(--text-base, #1e293b)',
          }}
          onFocus={e => e.target.style.borderColor = '#6366f1'}
          onBlur={e  => e.target.style.borderColor = 'var(--border, #e2e8f0)'}
        />
      </div>

      <div style={{ maxHeight: 220, overflowY: 'auto' }}>
        <div
          onClick={() => select('')}
          style={{ padding: '9px 14px', fontSize: 13, color: 'var(--text-faint, #94a3b8)', cursor: 'pointer', borderBottom: '1px solid var(--border-light, #f8fafc)' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-row, #f8fafc)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          {placeholder}
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-faint, #94a3b8)', textAlign: 'center' }}>
            No results found
          </div>
        ) : filtered.map((opt, idx) => {
          const isSelected  = String(opt.value) === String(value);
          const isHighlight = idx === activeIdx;
          return (
            <div
              key={opt.value}
              onClick={() => select(opt.value)}
              onMouseEnter={() => setActiveIdx(idx)}
              style={{
                padding:    '9px 14px',
                cursor:     'pointer',
                background: isSelected
                  ? 'var(--primary-muted, #eef2ff)'
                  : isHighlight ? 'var(--hover-row, #f8fafc)' : 'transparent',
                borderLeft: isSelected
                  ? '3px solid #6366f1'
                  : isHighlight ? '3px solid #a5b4fc' : '3px solid transparent',
                transition: 'background .1s',
              }}
            >
              <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text-base, #1e293b)' }}>{opt.label}</div>
              {opt.sub && <div style={{ fontSize: 11.5, color: 'var(--text-faint, #94a3b8)', marginTop: 1 }}>{opt.sub}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={openDrop}
        onKeyDown={handleTriggerKeyDown}
        style={{
          width:      '100%',
          padding:    '9px 36px 9px 12px',
          border:     `1.5px solid ${open ? '#6366f1' : 'var(--border, #e2e8f0)'}`,
          borderRadius: 6,
          background: disabled ? 'var(--bg-base, #f8fafc)' : 'var(--bg-input, #fff)',
          textAlign:  'left',
          fontSize:   13.5,
          color:      selected ? 'var(--text-base, #1e293b)' : 'var(--text-faint, #94a3b8)',
          cursor:     disabled ? 'not-allowed' : 'pointer',
          boxShadow:  open ? '0 0 0 3px rgba(99,102,241,.1)' : 'none',
          transition: 'border-color .15s, box-shadow .15s',
          position:   'relative',
          whiteSpace: 'nowrap',
          overflow:   'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {selected ? selected.label : placeholder}
        <span style={{
          position: 'absolute', right: 10, top: '50%',
          transform: `translateY(-50%) rotate(${open ? 180 : 0}deg)`,
          transition: 'transform .2s',
          color: '#94a3b8',
          pointerEvents: 'none',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>

      {typeof document !== 'undefined' && createPortal(dropdown, document.body)}
    </div>
  );
}
