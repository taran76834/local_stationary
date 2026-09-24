import { useState, useEffect, useRef } from 'react';

export default function MultiSelect({
  options = [],
  value = [],
  onChange,
  placeholder = '— Select —',
  disabled = false,
}) {
  const [open,   setOpen]   = useState(false);
  const [search, setSearch] = useState('');
  const ref   = useRef(null);
  const inRef = useRef(null);

  const selected = options.filter(o => value.map(String).includes(String(o.value)));
  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    function handle(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  useEffect(() => {
    if (open && inRef.current) inRef.current.focus();
  }, [open]);

  function toggle(val) {
    const strVal = String(val);
    const current = value.map(String);
    if (current.includes(strVal)) {
      onChange(current.filter(v => v !== strVal));
    } else {
      onChange([...current, strVal]);
    }
  }

  function remove(val) {
    onChange(value.map(String).filter(v => v !== String(val)));
  }

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      {/* Trigger */}
      <div
        onClick={() => !disabled && setOpen(v => !v)}
        style={{
          minHeight: 40,
          padding: selected.length ? '5px 36px 5px 8px' : '9px 36px 9px 12px',
          border: `1.5px solid ${open ? '#6366f1' : 'var(--border)'}`,
          borderRadius: 6,
          background: disabled ? 'var(--bg-muted, var(--bg-card))' : 'var(--bg-card)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          boxShadow: open ? '0 0 0 3px rgba(99,102,241,.15)' : 'none',
          transition: 'border-color .15s, box-shadow .15s',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
          alignItems: 'center',
          position: 'relative',
        }}
      >
        {selected.length === 0 ? (
          <span style={{ fontSize: 13.5, color: 'var(--text-faint)' }}>{placeholder}</span>
        ) : selected.map(opt => (
          <span key={opt.value} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: 'rgba(99,102,241,.15)', color: '#818cf8',
            borderRadius: 4, padding: '2px 6px', fontSize: 12.5, fontWeight: 500,
          }}>
            {opt.label}
            <span
              onClick={e => { e.stopPropagation(); remove(opt.value); }}
              style={{ cursor: 'pointer', lineHeight: 1, color: '#818cf8', fontWeight: 700 }}
            >×</span>
          </span>
        ))}
        {/* Chevron */}
        <span style={{
          position: 'absolute', right: 10, top: '50%',
          transform: `translateY(-50%) rotate(${open ? 180 : 0}deg)`,
          transition: 'transform .2s', color: 'var(--text-faint)', pointerEvents: 'none',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </div>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: 'var(--bg-card)', border: '1.5px solid var(--border)', borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,.25)', zIndex: 1050, overflow: 'hidden',
        }}>
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
            <input
              ref={inRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              style={{
                width: '100%', padding: '6px 10px',
                border: '1.5px solid var(--border)',
                borderRadius: 6, fontSize: 13, outline: 'none',
                background: 'var(--bg-base)', color: 'var(--text-base)',
              }}
              onFocus={e => e.target.style.borderColor = '#6366f1'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-faint)', textAlign: 'center' }}>No results</div>
            ) : filtered.map(opt => {
              const isSelected = value.map(String).includes(String(opt.value));
              return (
                <div
                  key={opt.value}
                  onClick={() => toggle(opt.value)}
                  style={{
                    padding: '9px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                    background: isSelected ? 'rgba(99,102,241,.12)' : 'transparent',
                    borderLeft: isSelected ? '3px solid #6366f1' : '3px solid transparent',
                    transition: 'background .1s',
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-hover, rgba(99,102,241,.06))'; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{
                    width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                    border: `2px solid ${isSelected ? '#6366f1' : 'var(--border)'}`,
                    background: isSelected ? '#6366f1' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {isSelected && (
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
                        <polyline points="2 6 5 9 10 3" />
                      </svg>
                    )}
                  </span>
                  <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text-base)' }}>{opt.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
