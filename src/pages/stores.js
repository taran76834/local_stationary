import Layout from '@/components/Layout';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useRole } from '@/hooks/useRole';
import Pagination from '@/components/Pagination';
import TableLoader from '@/components/TableLoader';
import {
  IconStore, IconEdit, IconTrash, IconMapPin, IconBox,
  IconCalendar, IconPlus, IconRefresh, IconPhone, IconSearch,
} from '@/components/Icons';

const PAGE_SIZE = 10;
const EMPTY = { name: '', address: '', phone: '' };

export default function StoresPage() {
  const [stores, setStores]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [addModal, setAddModal]     = useState(false);
  const [form, setForm]             = useState(EMPTY);
  const [saving, setSaving]         = useState(false);
  const [editModal, setEditModal]   = useState(false);
  const [editStore, setEditStore]   = useState(null);
  const [editForm, setEditForm]     = useState(EMPTY);
  const [editSaving, setEditSaving] = useState(false);
  const [page, setPage]             = useState(1);
  const [search, setSearch]         = useState('');
  const { canAdd, canEdit }         = useRole();

  async function load() {
    setLoading(true);
    const data = await fetch('/api/stores').then(r => r.json()).catch(() => []);
    setStores(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = stores.filter(s =>
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.phone?.toLowerCase().includes(search.toLowerCase()) ||
    s.address?.toLowerCase().includes(search.toLowerCase())
  );
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalProducts = stores.reduce((acc, s) => acc + (parseInt(s.product_count, 10) || 0), 0);

  async function handleAdd(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res  = await fetch('/api/stores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success('Stationery store added successfully.');
      setForm(EMPTY);
      setAddModal(false);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  function openEdit(s) {
    setEditStore(s);
    setEditForm({ name: s.name, address: s.address || '', phone: s.phone || '' });
    setEditModal(true);
  }

  async function handleEdit(e) {
    e.preventDefault();
    setEditSaving(true);
    try {
      const res  = await fetch(`/api/stores/${editStore.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editForm) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success('Store details updated.');
      setEditModal(false);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(id, storeName) {
    if (!confirm(`Are you sure you want to delete store "${storeName}"?`)) return;
    try {
      const res  = await fetch(`/api/stores/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success('Store deleted successfully.');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <Layout title="Stores & Branches">
      {/* ── Top Header with Action ───────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-base)', display: 'flex', alignItems: 'center', gap: 10, letterSpacing: '-0.02em', margin: 0 }}>
            Stationery Stores & Outlets
            <span className="badge badge-indigo" style={{ fontSize: 13, fontWeight: 700, padding: '3px 10px' }}>
              {stores.length} {stores.length === 1 ? 'Location' : 'Locations'}
            </span>
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginTop: 4 }}>
            Manage physical stationery shops, retail branches, and store inventory assignments
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            className="btn btn-secondary"
            onClick={load}
            disabled={loading}
            title="Refresh Store List"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 42, padding: '0 14px' }}
          >
            <IconRefresh size={15} /> Refresh
          </button>
          {canAdd && (
            <button
              className="btn btn-primary"
              onClick={() => { setForm(EMPTY); setAddModal(true); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 42, padding: '0 18px', fontWeight: 700, boxShadow: '0 4px 14px rgba(79, 70, 229, 0.35)' }}
            >
              <IconPlus size={16} /> Add New Store
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
            <IconStore size={22} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
              Active Retail Stores
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-base)', lineHeight: 1.2 }}>
              {loading ? '—' : stores.length}
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
              Total Assigned Products
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-base)', lineHeight: 1.2 }}>
              {loading ? '—' : totalProducts}
            </div>
          </div>
        </div>
      </div>

      {/* ── Full Width Modern Stores Data Table ─────────────────── */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="card-header" style={{ flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-base)' }}>Store Directory</span>
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
              placeholder="Search store by name, phone, or address…"
              style={{ paddingLeft: 36, fontSize: 13, height: 40, borderRadius: 10 }}
            />
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 50, textAlign: 'center' }}>#</th>
                <th style={{ minWidth: 220 }}>Store / Branch Name</th>
                <th style={{ minWidth: 160 }}>Contact Phone</th>
                <th style={{ minWidth: 260 }}>Location Address</th>
                <th style={{ minWidth: 130, textAlign: 'center' }}>Stock Items</th>
                <th style={{ minWidth: 140 }}>Created Date</th>
                {canEdit && <th style={{ width: 140, textAlign: 'right' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableLoader cols={canEdit ? 7 : 6} />
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 7 : 6}>
                    <div className="empty-state" style={{ padding: '48px 20px' }}>
                      <div className="empty-state-icon" style={{ width: 56, height: 56 }}>
                        <IconStore size={28} />
                      </div>
                      <p style={{ fontSize: 16, fontWeight: 700, marginTop: 12 }}>{search ? 'No stores match your search' : 'No stationery stores found'}</p>
                      <span style={{ color: 'var(--text-muted)' }}>{search ? 'Try searching with a different keyword or clear the search' : 'Click "+ Add New Store" above to register your first branch'}</span>
                    </div>
                  </td>
                </tr>
              ) : paged.map((s, i) => {
                const initial = (s.name || 'S').trim().charAt(0).toUpperCase();
                return (
                  <tr key={s.id} style={{ transition: 'background 0.15s ease' }}>
                    <td style={{ textAlign: 'center', color: 'var(--text-faint)', fontSize: 12.5, fontWeight: 600 }}>
                      {(page - 1) * PAGE_SIZE + i + 1}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                          width: 38,
                          height: 38,
                          borderRadius: 10,
                          background: 'var(--gradient-primary)',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 15,
                          fontWeight: 800,
                          boxShadow: '0 2px 8px rgba(79, 70, 229, 0.25)',
                          flexShrink: 0
                        }}>
                          {initial}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-base)' }}>
                            {s.name}
                          </div>
                          <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 2 }}>
                            Branch ID #{s.id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {s.phone ? (
                        <a
                          href={`tel:${s.phone}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            color: 'var(--primary)',
                            fontWeight: 600,
                            fontSize: 13,
                            background: 'var(--primary-light)',
                            padding: '4px 10px',
                            borderRadius: 6,
                            textDecoration: 'none'
                          }}
                        >
                          <IconPhone size={13} color="var(--primary)" />
                          {s.phone}
                        </a>
                      ) : (
                        <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>Not provided</span>
                      )}
                    </td>
                    <td>
                      {s.address ? (
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 13, color: 'var(--text-muted)' }}>
                          <IconMapPin size={15} color="var(--text-faint)" style={{ flexShrink: 0, marginTop: 2 }} />
                          <span style={{ lineHeight: 1.4 }}>{s.address}</span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>—</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${s.product_count > 0 ? 'badge-indigo' : 'badge-gray'}`} style={{ padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>
                        {s.product_count || 0} products
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 12.5 }}>
                        <IconCalendar size={13} color="var(--text-faint)" />
                        {new Date(s.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </td>
                    {canEdit && (
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => openEdit(s)}
                            title="Edit Store Branch"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', fontSize: 12 }}
                          >
                            <IconEdit size={13} /> Edit
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete(s.id, s.name)}
                            title="Delete Store Branch"
                            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '5px 8px', fontSize: 12 }}
                          >
                            <IconTrash size={13} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} />
      </div>

      {/* ── Add New Store Modal ──────────────────────────────────── */}
      {addModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setAddModal(false)}>
          <div className="modal" style={{ maxWidth: 500 }}>
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
                  <IconStore size={20} />
                </div>
                <div>
                  <span className="modal-title" style={{ fontSize: 17, fontWeight: 800 }}>Add New Store Branch</span>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Register a retail outlet or stationery location</div>
                </div>
              </div>
              <button className="modal-close" onClick={() => setAddModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAdd}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 22 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-base)', marginBottom: 6, display: 'block' }}>
                    Store / Branch Name <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Invincible Stationary - Main Branch"
                    required
                    style={{ height: 42, borderRadius: 8 }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-base)', marginBottom: 6, display: 'block' }}>
                    Contact Phone Number
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)', pointerEvents: 'none', display: 'flex' }}>
                      <IconPhone size={15} />
                    </span>
                    <input
                      style={{ paddingLeft: 36, height: 42, borderRadius: 8 }}
                      value={form.phone}
                      onChange={e => setForm({ ...form, phone: e.target.value })}
                      placeholder="e.g. +91 98765 43210"
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-base)', marginBottom: 6, display: 'block' }}>
                    Location Address
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-faint)', pointerEvents: 'none', display: 'flex' }}>
                      <IconMapPin size={15} />
                    </span>
                    <textarea
                      style={{ paddingLeft: 36, borderRadius: 8 }}
                      value={form.address}
                      onChange={e => setForm({ ...form, address: e.target.value })}
                      placeholder="Full street address, area, city, pincode…"
                      rows={3}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer" style={{ borderTop: '1px solid var(--border-light)', padding: '16px 22px', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setAddModal(false)} style={{ height: 40 }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ height: 40, fontWeight: 700 }}>
                  {saving ? 'Creating Store…' : '+ Create Store'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Store Modal ─────────────────────────────────────── */}
      {editModal && editStore && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditModal(false)}>
          <div className="modal" style={{ maxWidth: 500 }}>
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
                  <IconStore size={20} />
                </div>
                <div>
                  <span className="modal-title" style={{ fontSize: 17, fontWeight: 800 }}>Edit Store Details</span>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Update information for {editStore.name}</div>
                </div>
              </div>
              <button className="modal-close" onClick={() => setEditModal(false)}>✕</button>
            </div>
            <form onSubmit={handleEdit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 22 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-base)', marginBottom: 6, display: 'block' }}>
                    Store / Branch Name <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    value={editForm.name}
                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                    required
                    style={{ height: 42, borderRadius: 8 }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-base)', marginBottom: 6, display: 'block' }}>
                    Contact Phone Number
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)', pointerEvents: 'none', display: 'flex' }}>
                      <IconPhone size={15} />
                    </span>
                    <input
                      style={{ paddingLeft: 36, height: 42, borderRadius: 8 }}
                      value={editForm.phone}
                      onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                      placeholder="e.g. +91 98765 43210"
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-base)', marginBottom: 6, display: 'block' }}>
                    Location Address
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-faint)', pointerEvents: 'none', display: 'flex' }}>
                      <IconMapPin size={15} />
                    </span>
                    <textarea
                      style={{ paddingLeft: 36, borderRadius: 8 }}
                      value={editForm.address}
                      onChange={e => setEditForm({ ...editForm, address: e.target.value })}
                      rows={3}
                      placeholder="Full street address, area, city, pincode…"
                    />
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
