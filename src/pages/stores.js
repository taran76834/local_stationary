import Layout from '@/components/Layout';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useRole } from '@/hooks/useRole';
import Pagination from '@/components/Pagination';
import TableLoader from '@/components/TableLoader';

const PAGE_SIZE = 10;
const EMPTY = { name: '', address: '', phone: '' };

export default function StoresPage() {
  const [stores, setStores]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm]       = useState(EMPTY);
  const [saving, setSaving]   = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [editStore, setEditStore] = useState(null);
  const [editForm, setEditForm]   = useState(EMPTY);
  const [editSaving, setEditSaving] = useState(false);
  const [page, setPage]             = useState(1);
  const [search, setSearch]         = useState('');
  const { canAdd, canEdit } = useRole();

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

  async function handleAdd(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res  = await fetch('/api/stores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success('Store added.');
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
      toast.success('Store updated.');
      setEditModal(false);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(id, storeName) {
    if (!confirm(`Delete store "${storeName}"?`)) return;
    try {
      const res  = await fetch(`/api/stores/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success('Store deleted.');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <Layout title="Stores">
      <div className="grid-sidebar">
        {canAdd && (
          <div className="card">
            <div className="card-header"><span className="card-title">Add Store</span></div>
            <form onSubmit={handleAdd}>
              <div className="card-body">
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label>Store Name *</label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Main Branch" required />
                </div>
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label>Phone</label>
                  <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="e.g. +91 98765 43210" />
                </div>
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label>Address</label>
                  <textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Store address…" rows={2} />
                </div>
                <button className="btn btn-primary" type="submit" disabled={saving} style={{ width: '100%', justifyContent: 'center' }}>
                  {saving ? 'Adding…' : '+ Add Store'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="card">
          <div className="card-header" style={{ flexWrap: 'wrap', gap: 10 }}>
            <span className="card-title">🏪 Stores ({filtered.length}{filtered.length !== stores.length ? ` of ${stores.length}` : ''})</span>
            <div style={{ position: 'relative', flex: 1, maxWidth: 260, minWidth: 140 }}>
              <svg style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)', pointerEvents: 'none' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search stores…" style={{ paddingLeft: 28, fontSize: 13, width: '100%' }} />
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th className="hide-mobile">Phone</th>
                  <th className="hide-mobile">Address</th>
                  <th className="hide-mobile">Products</th>
                  <th className="hide-mobile">Created</th>
                  {canEdit && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableLoader cols={canEdit ? 7 : 6} />
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={canEdit ? 7 : 6}><div className="empty-state"><div className="icon">🏪</div><p>{search ? 'No stores match your search.' : 'No stores yet.'}</p></div></td></tr>
                ) : paged.map((s, i) => (
                  <tr key={s.id}>
                    <td>{(page - 1) * PAGE_SIZE + i + 1}</td>
                    <td><strong>{s.name}</strong></td>
                    <td className="hide-mobile" style={{ color: 'var(--text-muted)', fontSize: 13 }}>{s.phone || <span style={{ color: 'var(--text-faint)' }}>—</span>}</td>
                    <td className="hide-mobile" style={{ color: 'var(--text-muted)', fontSize: 13 }}>{s.address || <span style={{ color: 'var(--text-faint)' }}>—</span>}</td>
                    <td className="hide-mobile">
                      <span style={{ background: s.product_count > 0 ? 'rgba(59,130,246,.15)' : 'var(--bg-base)', color: s.product_count > 0 ? '#3b82f6' : 'var(--text-faint)', borderRadius: 12, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>
                        {s.product_count}
                      </span>
                    </td>
                    <td className="hide-mobile" style={{ color: '#9ca3af', fontSize: 12 }}>{new Date(s.created_at).toLocaleDateString()}</td>
                    {canEdit && (
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => openEdit(s)}>✏️ Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(s.id, s.name)}>🗑️</button>
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

      {/* Edit Modal */}
      {editModal && editStore && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditModal(false)}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <span className="modal-title">Edit Store</span>
              <button className="modal-close" onClick={() => setEditModal(false)}>×</button>
            </div>
            <form onSubmit={handleEdit}>
              <div className="modal-body">
                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label>Store Name *</label>
                  <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} required />
                </div>
                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label>Phone</label>
                  <input value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} placeholder="e.g. +91 98765 43210" />
                </div>
                <div className="form-group">
                  <label>Address</label>
                  <textarea value={editForm.address} onChange={e => setEditForm({ ...editForm, address: e.target.value })} rows={3} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEditModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={editSaving}>{editSaving ? 'Saving…' : 'Save Store'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
