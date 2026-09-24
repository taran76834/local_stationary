import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import 'react-quill-new/dist/quill.snow.css';

const ReactQuill = dynamic(() => import('react-quill-new'), {
  ssr: false,
  loading: () => (
    <div style={{ minHeight: 180, padding: 14, background: 'var(--bg-base)', border: '1.5px solid var(--border)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 13 }}>
      Loading Rich Text Editor…
    </div>
  ),
});

const modules = {
  toolbar: [
    [{ header: [1, 2, 3, 4, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ color: [] }, { background: [] }],
    [{ align: [] }],
    ['link', 'clean'],
  ],
};

const formats = [
  'header',
  'bold',
  'italic',
  'underline',
  'strike',
  'list',
  'bullet',
  'color',
  'background',
  'align',
  'link',
];

export default function RichTextEditor({ value, onChange, placeholder = 'Write product description here…' }) {
  const [showHtml, setShowHtml] = useState(false);

  return (
    <div className="rich-text-editor-wrap" style={{ position: 'relative' }}>
      <style>{`
        .rich-text-editor-wrap .ql-toolbar.ql-snow {
          border-color: var(--border, #cbd5e1) !important;
          border-top-left-radius: 10px;
          border-top-right-radius: 10px;
          background: var(--bg-base, #f8fafc);
        }
        .rich-text-editor-wrap .ql-container.ql-snow {
          border-color: var(--border, #cbd5e1) !important;
          border-bottom-left-radius: 10px;
          border-bottom-right-radius: 10px;
          min-height: 180px;
          background: var(--bg-card, #ffffff);
          color: var(--text-base, #0f172a);
          font-family: inherit;
          font-size: 14px;
        }
        .rich-text-editor-wrap .ql-editor {
          min-height: 180px;
          line-height: 1.6;
        }
        .rich-text-editor-wrap .ql-editor.ql-blank::before {
          color: var(--text-muted, #94a3b8);
          font-style: normal;
        }
        [data-theme="dark"] .rich-text-editor-wrap .ql-stroke {
          stroke: #94a3b8 !important;
        }
        [data-theme="dark"] .rich-text-editor-wrap .ql-fill {
          fill: #94a3b8 !important;
        }
        [data-theme="dark"] .rich-text-editor-wrap .ql-picker {
          color: #94a3b8 !important;
        }
        [data-theme="dark"] .rich-text-editor-wrap .ql-picker-options {
          background-color: var(--bg-card, #1e293b) !important;
          border-color: var(--border, #334155) !important;
        }
      `}</style>

      {/* HTML / Visual Toggle */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
        <button
          type="button"
          className="btn btn-secondary btn-xs"
          onClick={() => setShowHtml(!showHtml)}
          style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 8px' }}
        >
          {showHtml ? '👁️ Visual Editor' : '⚡ HTML Code View'}
        </button>
      </div>

      {showHtml ? (
        <textarea
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder="Enter raw HTML description…"
          rows={8}
          style={{
            width: '100%',
            padding: 14,
            fontFamily: 'monospace',
            fontSize: 13,
            border: '1.5px solid var(--border)',
            borderRadius: 10,
            outline: 'none',
            resize: 'vertical',
            background: '#1e293b',
            color: '#f8fafc',
          }}
        />
      ) : (
        <ReactQuill
          theme="snow"
          value={value || ''}
          onChange={content => onChange(content)}
          placeholder={placeholder}
          modules={modules}
          formats={formats}
        />
      )}
    </div>
  );
}
