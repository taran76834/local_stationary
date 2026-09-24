import Layout from '@/components/Layout';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useRole } from '@/hooks/useRole';
import Pagination from '@/components/Pagination';
import TableLoader from '@/components/TableLoader';
import {
  IconTag, IconEdit, IconTrash, IconBox,
  IconCalendar, IconPlus, IconRefresh, IconSearch,
} from '@/components/Icons';

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
  const [categories, setCategories]   = useState([]);
  const [loading, setLoading]         = useState(true);

  // Add modal states
  const [addModal, setAddModal]       = useState(false);
  const [name, setName]               = useState('');
  const [slug, setSlug]               = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [image, setImage]             = useState('');
  const [saving, setSaving]           = useState(false);

  // Edit modal states
  const [editModal, setEditModal]     = useState(false);
  const [editItem, setEditItem]       = useState(null);
  const [editName, setEditName]       = useState('');
  const [editSlug, setEditSlug]       = useState('');
  const [editImage, setEditImage]     = useState('');
  const [editSaving, setEditSaving]   = useState(false);

  const [page, setPage]               = useState(1);
  const [search, setSearch]           = useState('');
  const { canAdd, canDelete }         = useRole();

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
      toast.success('Category added successfully.');
      setName('');
      setSlug('');
      setSlugTouched(false);
      setImage('');
      setAddModal(false);
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
    if (!confirm(`Are you sure you want to delete category "${catName}"?`)) return;
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

  const filtered = categories.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    (c.slug || '').toLowerCase().includes(search.toLowerCase())
  );
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalProducts = categories.reduce((acc, c) => acc + (parseInt(c.product_count, 10) || 0), 0);

  return (
    <Layout title="Categories">
      {/* ── Top Header with Action ───────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-base)', display: 'flex', alignItems: 'center', gap: 10, letterSpacing: '-0.02em', margin: 0 }}>
            Stationery Categories
            <span className="badge badge-indigo" style={{ fontSize: 13, fontWeight: 700, padding: '3px 10px' }}>
              {categories.length} {categories.length === 1 ? 'Category' : 'Categories'}
            </span>
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginTop: 4 }}>
            Organize stationery items, papers, art supplies, and writing instruments
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            className="btn btn-secondary"
            onClick={load}
            disabled={loading}
            title="Refresh Category List"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 42, padding: '0 14px' }}
          >
            <IconRefresh size={15} /> Refresh
          </button>
          {canAdd && (
            <button
              className="btn btn-primary"
              onClick={() => {
                setName('');
                setSlug('');
                setSlugTouched(false);
                setImage('');
                setAddModal(true);
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 42, padding: '0 18px', fontWeight: 700 }}
            >
              <IconPlus size={16} /> Add Category
            </button>
          )}
        </div>
      </div>

      {/* ── Top Summary Stats Pills ──────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 20 }}>
        <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: 'var(--primary-light)',
            color: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <IconTag size={22} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
              Total Categories
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-base)', lineHeight: 1.2 }}>
              {loading ? '—' : categories.length}
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: 'rgba(16,185,129,.12)',
            color: '#10b981',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <IconBox size={22} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
              Assigned Products
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-base)', lineHeight: 1.2 }}>
              {loading ? '—' : totalProducts}
            </div>
          </div>
        </div>
      </div>

      {/* ── Full Width Modern Categories Data Table ──────────────── */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="card-header" style={{ flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-base)' }}>Category Directory</span>
            {search && (
              <span className="badge badge-gray" style={{ fontSize: 11.5 }}>
                {filtered.length} found
              </span>
            )}
          </div>

          <div style={{ position: 'relative', width: 300, maxWidth: '100%' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)', pointerEvents: 'none', display: 'flex' }}>
              <IconSearch size={14} />
            </span>
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by category name or slug…"
              style={{ paddingLeft: 36, fontSize: 13, height: 40, borderRadius: 10 }}
            />
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 50, textAlign: 'center' }}>#</th>
                <th style={{ width: 70 }}>Image</th>
                <th style={{ minWidth: 220 }}>Category Name</th>
                <th style={{ minWidth: 180 }}>URL Slug</th>
                <th style={{ minWidth: 130, textAlign: 'center' }}>Products</th>
                <th style={{ minWidth: 140 }}>Created Date</th>
                {canDelete && <th style={{ width: 140, textAlign: 'right' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableLoader cols={canDelete ? 7 : 6} />
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={canDelete ? 7 : 6}>
                    <div className="empty-state" style={{ padding: '48px 20px' }}>
                      <div className="empty-state-icon" style={{ width: 56, height: 56 }}>
                        <IconTag size={28} />
                      </div>
                      <p style={{ fontSize: 16, fontWeight: 700, marginTop: 12 }}>{search ? 'No categories match your search' : 'No categories created yet'}</p>
                      <span style={{ color: 'var(--text-muted)' }}>{search ? 'Try adjusting your search query' : 'Click "+ Add Category" above to create your first stationery category'}</span>
                    </div>
                  </td>
                </tr>
              ) : paged.map((c, i) => (
                <tr key={c.id} style={{ transition: 'background 0.15s ease' }}>
                  <td style={{ textAlign: 'center', color: 'var(--text-faint)', fontSize: 12.5, fontWeight: 600 }}>
                    {(page - 1) * PAGE_SIZE + i + 1}
                  </td>
                  <td>
                    {c.image ? (
                      <img
                        src={c.image}
                        alt={c.name}
                        style={{ width: 42, height: 42, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-base)', display: 'block' }}
                      />
                    ) : (
                      <div style={{ width: 42, height: 42, borderRadius: 8, background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-light)' }}>
                        <IconTag size={18} />
                      </div>
                    )}
                  </td>
                  <td>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-base)' }}>
                      {c.name}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 2 }}>
                      Category ID #{c.id}
                    </div>
                  </td>
                  <td>
                    <code style={{ fontSize: 12, background: 'var(--bg-base)', padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                      {c.slug || slugify(c.name)}
                    </code>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`badge ${c.product_count > 0 ? 'badge-indigo' : 'badge-gray'}`} style={{ padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>
                      {c.product_count || 0} products
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 12.5 }}>
                      <IconCalendar size={13} color="var(--text-faint)" />
                      {new Date(c.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </td>
                  {canDelete && (
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => openEdit(c)}
                          title="Edit Category"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', fontSize: 12 }}
                        >
                          <IconEdit size={13} /> Edit
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(c.id, c.name)}
                          title="Delete Category"
                          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '5px 8px', fontSize: 12 }}
                        >
                          <IconTrash size={13} />
                        </button>
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

      {/* ── Add Category Modal ───────────────────────────────────── */}
      {addModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setAddModal(false)}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: 'var(--primary-light)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <IconTag size={20} />
                </div>
                <div>
                  <span className="modal-title" style={{ fontSize: 17, fontWeight: 800 }}>Add New Category</span>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Create a stationery product category</div>
                </div>
              </div>
              <button className="modal-close" onClick={() => setAddModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAdd}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 22 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-base)', marginBottom: 6, display: 'block' }}>
                    Category Name <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    value={name}
                    onChange={e => {
                      const val = e.target.value;
                      setName(val);
                      if (!slugTouched) setSlug(slugify(val));
                    }}
                    placeholder="e.g. Notebooks & Registers"
                    required
                    style={{ height: 42, borderRadius: 8 }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-base)', marginBottom: 6, display: 'block' }}>
                    URL Slug
                  </label>
                  <input
                    value={slug}
                    onChange={e => {
                      setSlugTouched(true);
                      setSlug(e.target.value);
                    }}
                    placeholder="e.g. notebooks-registers"
                    style={{ height: 42, borderRadius: 8 }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-base)', marginBottom: 6, display: 'block' }}>
                    Category Image
                  </label>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                    <div style={{ position: 'relative', width: 68, height: 68, borderRadius: 10, border: '2px dashed var(--border)', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                      {image ? (
                        <>
                          <img src={image} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <button
                            type="button"
                            onClick={() => setImage('')}
                            style={{ position: 'absolute', top: 3, right: 3, background: 'rgba(239, 68, 68, 0.95)', color: '#fff', border: 'none', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, lineHeight: 1 }}
                            title="Remove image"
                          >
                            ✕
                          </button>
                        </>
                      ) : (
                        <IconTag size={24} color="var(--text-faint)" />
                      )}
                    </div>
                    <div>
                      <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, margin: 0, height: 36, padding: '0 12px' }}>
                        Upload Image
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
                      <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 4 }}>PNG, JPG, WEBP recommended</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer" style={{ borderTop: '1px solid var(--border-light)', padding: '16px 22px', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setAddModal(false)} style={{ height: 40 }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ height: 40, fontWeight: 700 }}>
                  {saving ? 'Creating…' : '+ Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Category Modal ──────────────────────────────────── */}
      {editModal && editItem && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditModal(false)}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: 'var(--primary-light)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <IconTag size={20} />
                </div>
                <div>
                  <span className="modal-title" style={{ fontSize: 17, fontWeight: 800 }}>Edit Category</span>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Update details for {editItem.name}</div>
                </div>
              </div>
              <button className="modal-close" onClick={() => setEditModal(false)}>✕</button>
            </div>
            <form onSubmit={handleEdit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 22 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-base)', marginBottom: 6, display: 'block' }}>
                    Category Name <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    required
                    style={{ height: 42, borderRadius: 8 }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-base)', marginBottom: 6, display: 'block' }}>
                    URL Slug
                  </label>
                  <input
                    value={editSlug}
                    onChange={e => setEditSlug(e.target.value)}
                    style={{ height: 42, borderRadius: 8 }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-base)', marginBottom: 6, display: 'block' }}>
                    Category Image
                  </label>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                    <div style={{ position: 'relative', width: 68, height: 68, borderRadius: 10, border: '2px dashed var(--border)', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                      {editImage ? (
                        <>
                          <img src={editImage} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <button
                            type="button"
                            onClick={() => setEditImage('')}
                            style={{ position: 'absolute', top: 3, right: 3, background: 'rgba(239, 68, 68, 0.95)', color: '#fff', border: 'none', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, lineHeight: 1 }}
                            title="Remove image"
                          >
                            ✕
                          </button>
                        </>
                      ) : (
                        <IconTag size={24} color="var(--text-faint)" />
                      )}
                    </div>
                    <div>
                      <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, margin: 0, height: 36, padding: '0 12px' }}>
                        Upload Image
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
                      <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 4 }}>PNG, JPG, WEBP recommended</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer" style={{ borderTop: '1px solid var(--border-light)', padding: '16px 22px', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditModal(false)} style={{ height: 40 }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={editSaving} style={{ height: 40, fontWeight: 700 }}>
                  {editSaving ? 'Saving Changes…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
