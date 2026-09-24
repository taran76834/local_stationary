import Layout from '@/components/Layout';
import { useEffect, useState, useRef } from 'react';
import toast from 'react-hot-toast';
import { useRole } from '@/hooks/useRole';
import Pagination from '@/components/Pagination';
import TableLoader from '@/components/TableLoader';

const PAGE_SIZE = 10;

function ImagePicker({ value, onChange }) {
  const inputRef = useRef();

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file.'); return; }
    if (file.size > 4 * 1024 * 1024) { toast.error('Image must be under 4MB.'); return; }
    const reader = new FileReader();
    reader.onload = ev => onChange(ev.target.result);
    reader.readAsDataURL(file);
  }

  function handleClear(e) {
    e.stopPropagation();
    onChange(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  const isDataUri  = value && value.startsWith('data:');
  const isExisting = value && !isDataUri;
  const preview    = isDataUri ? value : isExisting ? value : null;

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${preview ? '#6366f1' : 'var(--border)'}`,
          borderRadius: 10,
          padding: preview ? 6 : '18px 12px',
          textAlign: 'center',
          cursor: 'pointer',
          background: preview ? 'var(--bg-base)' : 'var(--bg-subtle, #f8fafc)',
          position: 'relative',
          transition: 'border-color 0.15s',
        }}
      >
        {preview ? (
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <img
              src={preview}
              alt="Brand"
              style={{ height: 72, maxWidth: '100%', objectFit: 'contain', borderRadius: 7, display: 'block', margin: '0 auto' }}
            />
            <button
              type="button"
              onClick={handleClear}
              style={{
                position: 'absolute', top: -7, right: -7,
                width: 20, height: 20, borderRadius: '50%',
                background: '#ef4444', color: '#fff', border: 'none',
                fontSize: 12, fontWeight: 900, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                lineHeight: 1,
              }}
            >×</button>
          </div>
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>🖼</div>
            Click to upload brand image
            <div style={{ fontSize: 11, marginTop: 2, color: 'var(--text-faint)' }}>PNG, JPG, WEBP · max 4MB</div>
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
    </div>
  );
}

export default function BrandsPage() {
  const [brands, setBrands]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [name, setName]             = useState('');
  const [image, setImage]           = useState(null);
  const [saving, setSaving]         = useState(false);
  const [editModal, setEditModal]   = useState(false);
  const [editItem, setEditItem]     = useState(null);
  const [editName, setEditName]     = useState('');
  const [editImage, setEditImage]   = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [page, setPage]             = useState(1);
  const [search, setSearch]         = useState('');
  const { canAdd, canDelete } = useRole();

  async function load() {
    setLoading(true);
    const data = await fetch('/api/brands').then(r => r.json()).catch(() => []);
    setBrands(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res  = await fetch('/api/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, image }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success('Brand added.');
      setName('');
      setImage(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  function openEdit(b) {
    setEditItem(b);
    setEditName(b.name);
    setEditImage(b.image || null);
    setEditModal(true);
  }

  async function handleEdit(e) {
    e.preventDefault();
    if (!editName.trim()) return;
    setEditSaving(true);
    try {
      const res  = await fetch(`/api/brands/${editItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, image: editImage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success('Brand updated.');
      setEditModal(false);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(id, brandName) {
    if (!confirm(`Delete brand "${brandName}"?`)) return;
    try {
      const res  = await fetch(`/api/brands/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success('Brand deleted.');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  const colSpan = canDelete ? 6 : 5;
  const filtered = brands.filter(b => b.name?.toLowerCase().includes(search.toLowerCase()));
  const paged    = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <Layout title="Brands">
      <div className="grid-sidebar">

        {/* ── Add Brand ── */}
        {canAdd && (
          <div className="card">
            <div className="card-header"><span className="card-title">Add Brand</span></div>
            <form onSubmit={handleAdd}>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Brand Name *</label>
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Classmate, Faber-Castell" required />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Brand Image</label>
                  <ImagePicker value={image} onChange={setImage} />
                </div>
                <button className="btn btn-primary" type="submit" disabled={saving} style={{ width: '100%', justifyContent: 'center' }}>
                  {saving ? 'Adding…' : '+ Add Brand'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Brands Table ── */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">🏷️ Brands ({filtered.length}{filtered.length !== brands.length ? ` of ${brands.length}` : ''})</span>
            <div style={{ position: 'relative', flex: 1, maxWidth: 260, minWidth: 0 }}>
              <svg style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)', pointerEvents: 'none' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search brands…" style={{ paddingLeft: 28, fontSize: 13, width: '100%' }} />
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Image</th>
                  <th>Name</th>
                  <th className="hide-mobile">Products</th>
                  <th className="hide-mobile">Created</th>
                  {canDelete && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableLoader cols={colSpan} />
                ) : paged.length === 0 ? (
                  <tr><td colSpan={colSpan}><div className="empty-state"><div className="icon">🏷️</div><p>{search ? 'No brands match.' : 'No brands yet.'}</p></div></td></tr>
                ) : paged.map((b, i) => (
                  <tr key={b.id}>
                    <td>{(page - 1) * PAGE_SIZE + i + 1}</td>
                    <td>
                      {b.image ? (
                        <img
                          src={b.image}
                          alt={b.name}
                          style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 7, border: '1px solid var(--border)', background: '#fff', padding: 2 }}
                        />
                      ) : (
                        <div style={{ width: 36, height: 36, borderRadius: 7, background: 'var(--bg-subtle, #f1f5f9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                          🏷️
                        </div>
                      )}
                    </td>
                    <td><strong>{b.name}</strong></td>
                    <td className="hide-mobile">
                      <span style={{ background: b.product_count > 0 ? 'rgba(59,130,246,.15)' : 'var(--bg-base)', color: b.product_count > 0 ? '#3b82f6' : 'var(--text-faint)', borderRadius: 12, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>
                        {b.product_count}
                      </span>
                    </td>
                    <td className="hide-mobile" style={{ color: '#9ca3af', fontSize: 12 }}>{new Date(b.created_at).toLocaleDateString()}</td>
                    {canDelete && (
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => openEdit(b)}>✏️ Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(b.id, b.name)}>🗑️</button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} />
        </div>
      </div>

      {/* ── Edit Modal ── */}
      {editModal && editItem && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditModal(false)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <span className="modal-title">Edit Brand</span>
              <button className="modal-close" onClick={() => setEditModal(false)}>×</button>
            </div>
            <form onSubmit={handleEdit}>
              <div className="modal-body">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Brand Name *</label>
                    <input value={editName} onChange={e => setEditName(e.target.value)} required autoFocus />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Brand Image</label>
                    <ImagePicker value={editImage} onChange={setEditImage} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEditModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={editSaving}>{editSaving ? 'Saving…' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
