import Layout from '@/components/Layout';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useRole } from '@/hooks/useRole';
import Pagination from '@/components/Pagination';
import TableLoader from '@/components/TableLoader';

const PAGE_SIZE = 10;

function slugify(text) {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function compressAndResizeImage(file, maxDimension = 800, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const dataUrl = canvas.toDataURL(mime, quality);
        resolve(dataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading]       = useState(true);

  // Add form states
  const [name, setName]             = useState('');
  const [slug, setSlug]             = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [image, setImage]           = useState('');
  const [saving, setSaving]         = useState(false);

  // Edit modal states
  const [editModal, setEditModal]   = useState(false);
  const [editItem, setEditItem]     = useState(null);
  const [editName, setEditName]     = useState('');
  const [editSlug, setEditSlug]     = useState('');
  const [editImage, setEditImage]   = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const [page, setPage]             = useState(1);
  const [search, setSearch]         = useState('');
  const { canAdd, canDelete } = useRole();

  async function load() {
    setLoading(true);
    const data = await fetch('/api/categories').then(r => r.json()).catch(() => []);
    setCategories(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res  = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug: slug || slugify(name), image }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || `Server error (${res.status})`);
      toast.success('Category added.');
      setName('');
      setSlug('');
      setSlugTouched(false);
      setImage('');
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  function openEdit(c) {
    setEditItem(c);
    setEditName(c.name);
    setEditSlug(c.slug || slugify(c.name));
    setEditImage(c.image || '');
    setEditModal(true);
  }

  async function handleEdit(e) {
    e.preventDefault();
    if (!editName.trim()) return;
    setEditSaving(true);
    try {
      const res  = await fetch(`/api/categories/${editItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, slug: editSlug || slugify(editName), image: editImage }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || `Server error (${res.status})`);
      toast.success('Category updated.');
      setEditModal(false);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(id, catName) {
    if (!confirm(`Delete category "${catName}"?`)) return;
    try {
      const res  = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || `Server error (${res.status})`);
      toast.success('Category deleted.');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  const colSpan = canDelete ? 7 : 6;
  const filtered = categories.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    (c.slug || '').toLowerCase().includes(search.toLowerCase())
  );
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <Layout title="Categories">
      <div className="grid-sidebar">
        {canAdd && (
          <div className="card">
            <div className="card-header"><span className="card-title">Add Category</span></div>
            <form onSubmit={handleAdd}>
              <div className="card-body">
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label>Category Name *</label>
                  <input
                    value={name}
                    onChange={e => {
                      const val = e.target.value;
                      setName(val);
                      if (!slugTouched) {
                        setSlug(slugify(val));
                      }
                    }}
                    placeholder="e.g. Beverages"
                    required
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label>Slug</label>
                  <input
                    value={slug}
                    onChange={e => {
                      setSlugTouched(true);
                      setSlug(e.target.value);
                    }}
                    placeholder="e.g. beverages"
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label>Category Image</label>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ position: 'relative', width: 60, height: 60, borderRadius: 8, border: '2px dashed var(--border)', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                      {image ? (
                        <>
                          <img src={image} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <button
                            type="button"
                            onClick={() => setImage('')}
                            style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(239, 68, 68, 0.9)', color: '#fff', border: 'none', borderRadius: '50%', width: 18, height: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, lineHeight: 1 }}
                            title="Remove image"
                          >
                            ✕
                          </button>
                        </>
                      ) : (
                        <span style={{ fontSize: 22, color: 'var(--text-muted)' }}>📷</span>
                      )}
                    </div>
                    <div>
                      <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, margin: 0 }}>
                        📤 Upload Image
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={async e => {
                            const file = e.target.files[0];
                            if (!file) return;
                            try {
                              const dataUrl = await compressAndResizeImage(file);
                              setImage(dataUrl);
                            } catch (err) {
                              toast.error('Failed to process image file.');
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </div>
                <button className="btn btn-primary" type="submit" disabled={saving} style={{ width: '100%', justifyContent: 'center' }}>
                  {saving ? 'Adding…' : '+ Add Category'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="card">
          <div className="card-header">
            <span className="card-title">🏷️ Categories ({filtered.length}{filtered.length !== categories.length ? ` of ${categories.length}` : ''})</span>
            <div style={{ position: 'relative', flex: 1, maxWidth: 260, minWidth: 0 }}>
              <svg style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)', pointerEvents: 'none' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search categories…" style={{ paddingLeft: 28, fontSize: 13, width: '100%' }} />
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Image</th>
                  <th>Name</th>
                  <th>Slug</th>
                  <th className="hide-mobile">Products</th>
                  <th className="hide-mobile">Created</th>
                  {canDelete && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableLoader cols={colSpan} />
                ) : categories.length === 0 ? (
                  <tr><td colSpan={colSpan}><div className="empty-state"><div className="icon">🏷️</div><p>{search ? 'No categories match.' : 'No categories yet.'}</p></div></td></tr>
                ) : paged.map((c, i) => (
                  <tr key={c.id}>
                    <td style={{ color: '#94a3b8', fontSize: 12 }}>{(page - 1) * PAGE_SIZE + i + 1}</td>
                    <td>
                      {c.image ? (
                        <img
                          src={c.image}
                          alt={c.name}
                          style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', display: 'block' }}
                        />
                      ) : (
                        <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--bg-base)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                          🏷️
                        </div>
                      )}
                    </td>
                    <td><strong>{c.name}</strong></td>
                    <td><code style={{ fontSize: 12, color: 'var(--primary)' }}>{c.slug || '—'}</code></td>
                    <td className="hide-mobile">
                      <span style={{ background: c.product_count > 0 ? 'rgba(59,130,246,.15)' : 'var(--bg-base)', color: c.product_count > 0 ? '#3b82f6' : 'var(--text-faint)', borderRadius: 12, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>
                        {c.product_count}
                      </span>
                    </td>
                    <td className="hide-mobile" style={{ color: '#9ca3af', fontSize: 12 }}>{new Date(c.created_at).toLocaleDateString()}</td>
                    {canDelete && (
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => openEdit(c)}>✏️ Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c.id, c.name)}>🗑️</button>
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

      {editModal && editItem && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditModal(false)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <span className="modal-title">Edit Category</span>
              <button className="modal-close" onClick={() => setEditModal(false)}>×</button>
            </div>
            <form onSubmit={handleEdit}>
              <div className="modal-body">
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label>Category Name *</label>
                  <input value={editName} onChange={e => setEditName(e.target.value)} required autoFocus />
                </div>
                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label>Slug</label>
                  <input value={editSlug} onChange={e => setEditSlug(e.target.value)} placeholder="e.g. beverages" />
                </div>
                <div className="form-group">
                  <label>Category Image</label>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ position: 'relative', width: 64, height: 64, borderRadius: 8, border: '2px dashed var(--border)', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                      {editImage ? (
                        <>
                          <img src={editImage} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <button
                            type="button"
                            onClick={() => setEditImage('')}
                            style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(239, 68, 68, 0.9)', color: '#fff', border: 'none', borderRadius: '50%', width: 18, height: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, lineHeight: 1 }}
                            title="Remove image"
                          >
                            ✕
                          </button>
                        </>
                      ) : (
                        <span style={{ fontSize: 22, color: 'var(--text-muted)' }}>📷</span>
                      )}
                    </div>
                    <div>
                      <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, margin: 0 }}>
                        📤 Upload Image
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={async e => {
                            const file = e.target.files[0];
                            if (!file) return;
                            try {
                              const dataUrl = await compressAndResizeImage(file);
                              setEditImage(dataUrl);
                            } catch (err) {
                              toast.error('Failed to process image file.');
                            }
                          }}
                        />
                      </label>
                    </div>
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
