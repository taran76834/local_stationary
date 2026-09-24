import Layout from '@/components/Layout';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useRole } from '@/hooks/useRole';
import Pagination from '@/components/Pagination';
import TableLoader from '@/components/TableLoader';
import {
  IconStore, IconEdit, IconTrash, IconMapPin, IconBox,
  IconCalendar, IconPlus,
} from '@/components/Icons';

const PAGE_SIZE = 10;
const EMPTY = { name: '', address: '', phone: '' };

const IconPhone = ({ size = 15, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

const IconSearch = ({ size = 15, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

export default function StoresPage() {
  const [stores, setStores]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [form, setForm]           = useState(EMPTY);
  const [saving, setSaving]       = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [editStore, setEditStore] = useState(null);
  const [editForm, setEditForm]   = useState(EMPTY);
  const [editSaving, setEditSaving] = useState(false);
  const [page, setPage]           = useState(1);
  const [search, setSearch]       = useState('');
  const { canAdd, canEdit }       = useRole();

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
      {/* ── Top Overview Banner / Stats ────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
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
              Total Stores
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
              Assigned Stock Items
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-base)', lineHeight: 1.2 }}>
              {loading ? '—' : totalProducts}
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Layout: Create Form + Stores Table ──────────────── */}
      <div className="grid-sidebar">
        {canAdd && (
          <div className="card" style={{ height: 'fit-content' }}>
            <div className="card-header">
              <div>
                <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <IconStore size={18} color="var(--primary)" /> Add New Store
                </span>
                <div className="card-sub" style={{ marginTop: 2 }}>Create a retail branch or stationery outlet</div>
              </div>
            </div>
            <form onSubmit={handleAdd}>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-base)', marginBottom: 6 }}>
                    Store / Branch Name <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Central City Stationery Hub"
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-base)', marginBottom: 6 }}>
                    Contact Phone Number
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)', pointerEvents: 'none' }}>
                      <IconPhone size={14} />
                    </span>
                    <input
                      style={{ paddingLeft: 34 }}
                      value={form.phone}
                      onChange={e => setForm({ ...form, phone: e.target.value })}
                      placeholder="e.g. +91 98765 43210"
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-base)', marginBottom: 6 }}>
                    Branch Location & Address
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-faint)', pointerEvents: 'none' }}>
                      <IconMapPin size={14} />
                    </span>
                    <textarea
                      style={{ paddingLeft: 34 }}
                      value={form.address}
                      onChange={e => setForm({ ...form, address: e.target.value })}
                      placeholder="Street, locality, city, pincode…"
                      rows={3}
                    />
                  </div>
                </div>

                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={saving}
                  style={{ width: '100%', justifyContent: 'center', marginTop: 6 }}
                >
                  {saving ? 'Creating Branch…' : '+ Create Store Branch'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Stores Table Card ── */}
        <div className="card">
          <div className="card-header" style={{ flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                All Registered Branches
                <span className="badge badge-indigo">
                  {filtered.length} {filtered.length === 1 ? 'branch' : 'branches'}
                </span>
              </span>
              <div className="card-sub" style={{ marginTop: 2 }}>Manage retail outlets, inventory allocations, and details</div>
            </div>

            <div style={{ position: 'relative', width: 260, maxWidth: '100%' }}>
              <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)', pointerEvents: 'none', display: 'flex' }}>
                <IconSearch size={14} />
              </span>
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search branches, phone, city…"
                style={{ paddingLeft: 34, fontSize: 13, height: 38 }}
              />
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 48 }}>#</th>
                  <th>Store Details</th>
                  <th className="hide-mobile">Contact Phone</th>
                  <th className="hide-mobile">Location Address</th>
                  <th className="hide-mobile" style={{ textAlign: 'center' }}>Products</th>
                  <th className="hide-mobile">Created</th>
                  {canEdit && <th style={{ textAlign: 'right' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableLoader cols={canEdit ? 7 : 6} />
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={canEdit ? 7 : 6}>
                      <div className="empty-state" style={{ padding: 40 }}>
                        <div className="empty-state-icon">
                          <IconStore size={26} />
                        </div>
                        <p>{search ? 'No branches match your search.' : 'No branches created yet.'}</p>
                        <span>{search ? 'Try adjusting your search terms' : 'Add your first stationery store branch from the left panel'}</span>
                      </div>
                    </td>
                  </tr>
                ) : paged.map((s, i) => {
                  const initial = (s.name || 'S').trim().charAt(0).toUpperCase();
                  return (
                    <tr key={s.id}>
                      <td style={{ color: 'var(--text-faint)', fontSize: 12 }}>
                        {(page - 1) * PAGE_SIZE + i + 1}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            background: 'var(--gradient-primary)',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 14,
                            fontWeight: 800,
                            boxShadow: '0 2px 8px rgba(79, 70, 229, 0.25)',
                            flexShrink: 0
                          }}>
                            {initial}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text-base)' }}>
                              {s.name}
                            </div>
                            <div style={{ fontSize: 11.5, color: 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: 4 }}>
                              Branch ID #{s.id}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="hide-mobile">
                        {s.phone ? (
                          <a
                            href={`tel:${s.phone}`}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--primary)', fontWeight: 600, fontSize: 13 }}
                          >
                            <IconPhone size={13} color="var(--primary)" />
                            {s.phone}
                          </a>
                        ) : (
                          <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>—</span>
                        )}
                      </td>
                      <td className="hide-mobile">
                        {s.address ? (
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, maxWidth: 260, fontSize: 12.5, color: 'var(--text-muted)' }}>
                            <IconMapPin size={14} color="var(--text-faint)" style={{ flexShrink: 0, marginTop: 2 }} />
                            <span>{s.address}</span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>—</span>
                        )}
                      </td>
                      <td className="hide-mobile" style={{ textAlign: 'center' }}>
                        <span className={`badge ${s.product_count > 0 ? 'badge-indigo' : 'badge-gray'}`}>
                          {s.product_count || 0} items
                        </span>
                      </td>
                      <td className="hide-mobile" style={{ color: 'var(--text-faint)', fontSize: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <IconCalendar size={12} />
                          {new Date(s.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                      </td>
                      {canEdit && (
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                            <button
                              className="btn btn-secondary btn-xs"
                              onClick={() => openEdit(s)}
                              title="Edit Store Branch"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 9px' }}
                            >
                              <IconEdit size={12} /> Edit
                            </button>
                            <button
                              className="btn btn-danger btn-xs"
                              onClick={() => handleDelete(s.id, s.name)}
                              title="Delete Store Branch"
                              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '5px 7px' }}
                            >
                              <IconTrash size={12} />
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
      </div>

      {/* ── Edit Store Modal ─────────────────────────────────────── */}
      {editModal && editStore && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditModal(false)}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: 'var(--primary-light)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <IconStore size={18} />
                </div>
                <div>
                  <span className="modal-title">Edit Store Branch</span>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Update details for {editStore.name}</div>
                </div>
              </div>
              <button className="modal-close" onClick={() => setEditModal(false)}>✕</button>
            </div>
            <form onSubmit={handleEdit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-base)', marginBottom: 6 }}>
                    Store / Branch Name <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    value={editForm.name}
                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-base)', marginBottom: 6 }}>
                    Phone Number
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)', pointerEvents: 'none' }}>
                      <IconPhone size={14} />
                    </span>
                    <input
                      style={{ paddingLeft: 34 }}
                      value={editForm.phone}
                      onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                      placeholder="e.g. +91 98765 43210"
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-base)', marginBottom: 6 }}>
                    Branch Location & Address
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-faint)', pointerEvents: 'none' }}>
                      <IconMapPin size={14} />
                    </span>
                    <textarea
                      style={{ paddingLeft: 34 }}
                      value={editForm.address}
                      onChange={e => setEditForm({ ...editForm, address: e.target.value })}
                      rows={3}
                      placeholder="Street, locality, city, pincode…"
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer" style={{ borderTop: '1px solid var(--border-light)', paddingTop: 16 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={editSaving}>
                  {editSaving ? 'Saving Changes…' : 'Save Store Details'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
