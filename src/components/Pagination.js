export default function Pagination({ page, total, pageSize, onChange }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const pages = [];
  const delta = 2;
  const left  = Math.max(1, page - delta);
  const right = Math.min(totalPages, page + delta);

  if (left > 1)           { pages.push(1); if (left > 2) pages.push('…'); }
  for (let i = left; i <= right; i++) pages.push(i);
  if (right < totalPages) { if (right < totalPages - 1) pages.push('…'); pages.push(totalPages); }

  const btn = (content, target, disabled = false, active = false) => (
    <button
      key={content + (target || '')}
      onClick={() => !disabled && target && onChange(target)}
      disabled={disabled}
      style={{
        minWidth: 34, height: 34, padding: '0 10px',
        border: `1.5px solid ${active ? '#6366f1' : 'var(--border)'}`,
        borderRadius: 7,
        background: active ? '#6366f1' : disabled ? 'var(--bg-base)' : 'var(--bg-card)',
        color: active ? '#fff' : disabled ? 'var(--text-faint)' : 'var(--text-base)',
        fontWeight: active ? 700 : 500,
        fontSize: 13,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all .15s',
      }}
    >
      {content}
    </button>
  );

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderTop: '1px solid var(--border)', flexWrap: 'wrap', gap: 10 }}>
      <span style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>
        Page {page} of {totalPages} · {total} total
      </span>
      <div style={{ display: 'flex', gap: 5 }}>
        {btn('‹', page - 1, page === 1)}
        {pages.map((p, i) =>
          p === '…'
            ? <span key={`ellipsis-${i}`} style={{ display: 'flex', alignItems: 'center', padding: '0 4px', color: 'var(--text-faint)', fontSize: 13 }}>…</span>
            : btn(p, p, false, p === page)
        )}
        {btn('›', page + 1, page === totalPages)}
      </div>
    </div>
  );
}
