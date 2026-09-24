import Layout from '@/components/Layout';
import { useEffect, useState, useRef } from 'react';
import toast from 'react-hot-toast';
import { useRole } from '@/hooks/useRole';
import Pagination from '@/components/Pagination';
import TableLoader from '@/components/TableLoader';
import {
  IconBrand, IconEdit, IconTrash, IconBox,
  IconCalendar, IconPlus, IconRefresh, IconSearch,
} from '@/components/Icons';

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
          border: `2px dashed ${preview ? 'var(--primary)' : 'var(--border)'}`,
          borderRadius: 10,
          padding: preview ? 10 : '20px 14px',
          textAlign: 'center',
          cursor: 'pointer',
          background: preview ? 'var(--bg-base)' : 'var(--bg-base)',
          position: 'relative',
          transition: 'border-color 0.15s',
        }}
      >
        {preview ? (
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <img
              src={preview}
              alt="Brand Logo"
              style={{ height: 72, maxWidth: '100%', objectFit: 'contain', borderRadius: 8, display: 'block', margin: '0 auto' }}
            />
            <button
              type="button"
              onClick={handleClear}
              style={{
                position: 'absolute', top: -7, right: -7,
                width: 22, height: 22, borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.95)', color: '#fff', border: 'none',
                fontSize: 12, fontWeight: 900, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                lineHeight: 1,
              }}
            >×</button>
          </div>
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconBrand size={20} />
              </div>
            </div>
            <div style={{ fontWeight: 600, color: 'var(--text-base)' }}>Click to upload brand logo</div>
            <div style={{ fontSize: 11.5, marginTop: 2, color: 'var(--text-faint)' }}>PNG, JPG, WEBP · max 4MB</div>
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
  const [addModal, setAddModal]     = useState(false);
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
  const { canAdd, canDelete }       = useRole();

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
      toast.success('Brand added successfully.');
      setName('');
      setImage(null);
      setAddModal(false);
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
    if (!confirm(`Are you sure you want to delete brand "${brandName}"?`)) return;
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

  const filtered = brands.filter(b => b.name?.toLowerCase().includes(search.toLowerCase()));
  const paged    = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalProducts = brands.reduce((acc, b) => acc + (parseInt(b.product_count, 10) || 0), 0);

  return (
    <Layout title="Brands">
      {/* ── Top Header with Action ───────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-base)', display: 'flex', alignItems: 'center', gap: 10, letterSpacing: '-0.02em', margin: 0 }}>
            Stationery Brands & Makers
            <span className="badge badge-indigo" style={{ fontSize: 13, fontWeight: 700, padding: '3px 10px' }}>
              {brands.length} {brands.length === 1 ? 'Brand' : 'Brands'}
            </span>
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginTop: 4 }}>
            Manage stationery manufacturers, notebook brands, and pen makers
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            className="btn btn-secondary"
            onClick={load}
            disabled={loading}
            title="Refresh Brand List"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 42, padding: '0 14px' }}
          >
            <IconRefresh size={15} /> Refresh
          </button>
          {canAdd && (
            <button
              className="btn btn-primary"
              onClick={() => {
                setName('');
                setImage(null);
                setAddModal(true);
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 42, padding: '0 18px', fontWeight: 700 }}
            >
              <IconPlus size={16} /> Add Brand
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
            <IconBrand size={22} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
              Total Brands
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-base)', lineHeight: 1.2 }}>
              {loading ? '—' : brands.length}
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
              Branded Inventory Items
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-base)', lineHeight: 1.2 }}>
              {loading ? '—' : totalProducts}
            </div>
          </div>
        </div>
      </div>

      {/* ── Full Width Modern Brands Data Table ─────────────────── */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="card-header" style={{ flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-base)' }}>Brand Directory</span>
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
              placeholder="Search by brand name…"
              style={{ paddingLeft: 36, fontSize: 13, height: 40, borderRadius: 10 }}
            />
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 50, textAlign: 'center' }}>#</th>
                <th style={{ width: 70 }}>Logo</th>
                <th style={{ minWidth: 240 }}>Brand / Manufacturer Name</th>
                <th style={{ minWidth: 130, textAlign: 'center' }}>Products</th>
                <th style={{ minWidth: 140 }}>Created Date</th>
                {canDelete && <th style={{ width: 140, textAlign: 'right' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableLoader cols={canDelete ? 6 : 5} />
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={canDelete ? 6 : 5}>
                    <div className="empty-state" style={{ padding: '48px 20px' }}>
                      <div className="empty-state-icon" style={{ width: 56, height: 56 }}>
                        <IconBrand size={28} />
                      </div>
                      <p style={{ fontSize: 16, fontWeight: 700, marginTop: 12 }}>{search ? 'No brands match your search' : 'No stationery brands added yet'}</p>
                      <span style={{ color: 'var(--text-muted)' }}>{search ? 'Try adjusting your search keywords' : 'Click "+ Add Brand" above to register stationery manufacturers'}</span>
                    </div>
                  </td>
                </tr>
              ) : paged.map((b, i) => (
                <tr key={b.id} style={{ transition: 'background 0.15s ease' }}>
                  <td style={{ textAlign: 'center', color: 'var(--text-faint)', fontSize: 12.5, fontWeight: 600 }}>
                    {(page - 1) * PAGE_SIZE + i + 1}
                  </td>
                  <td>
                    {b.image ? (
                      <img
                        src={b.image}
                        alt={b.name}
                        style={{ width: 42, height: 42, objectFit: 'contain', borderRadius: 8, border: '1px solid var(--border)', background: '#ffffff', padding: 3, display: 'block' }}
                      />
                    ) : (
                      <div style={{ width: 42, height: 42, borderRadius: 8, background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-light)' }}>
                        <IconBrand size={18} />
                      </div>
                    )}
                  </td>
                  <td>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-base)' }}>
                      {b.name}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 2 }}>
                      Brand ID #{b.id}
                    </div>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`badge ${b.product_count > 0 ? 'badge-indigo' : 'badge-gray'}`} style={{ padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>
                      {b.product_count || 0} products
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 12.5 }}>
                      <IconCalendar size={13} color="var(--text-faint)" />
                      {new Date(b.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </td>
                  {canDelete && (
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => openEdit(b)}
                          title="Edit Brand"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', fontSize: 12 }}
                        >
                          <IconEdit size={13} /> Edit
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(b.id, b.name)}
                          title="Delete Brand"
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

      {/* ── Add Brand Modal ──────────────────────────────────────── */}
      {addModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setAddModal(false)}>
          <div className="modal" style={{ maxWidth: 460 }}>
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
                  <IconBrand size={20} />
                </div>
                <div>
                  <span className="modal-title" style={{ fontSize: 17, fontWeight: 800 }}>Add New Brand</span>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Register a manufacturer or brand</div>
                </div>
              </div>
              <button className="modal-close" onClick={() => setAddModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAdd}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 22 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-base)', marginBottom: 6, display: 'block' }}>
                    Brand Name <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Classmate, Faber-Castell, Camlin"
                    required
                    style={{ height: 42, borderRadius: 8 }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-base)', marginBottom: 6, display: 'block' }}>
                    Brand Logo
                  </label>
                  <ImagePicker value={image} onChange={setImage} />
                </div>
              </div>
              <div className="modal-footer" style={{ borderTop: '1px solid var(--border-light)', padding: '16px 22px', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setAddModal(false)} style={{ height: 40 }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ height: 40, fontWeight: 700 }}>
                  {saving ? 'Adding…' : '+ Create Brand'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Brand Modal ─────────────────────────────────────── */}
      {editModal && editItem && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditModal(false)}>
          <div className="modal" style={{ maxWidth: 460 }}>
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
                  <IconBrand size={20} />
                </div>
                <div>
                  <span className="modal-title" style={{ fontSize: 17, fontWeight: 800 }}>Edit Brand</span>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Update information for {editItem.name}</div>
                </div>
              </div>
              <button className="modal-close" onClick={() => setEditModal(false)}>✕</button>
            </div>
            <form onSubmit={handleEdit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 22 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-base)', marginBottom: 6, display: 'block' }}>
                    Brand Name <span style={{ color: 'var(--danger)' }}>*</span>
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
                    Brand Logo
                  </label>
                  <ImagePicker value={editImage} onChange={setEditImage} />
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
