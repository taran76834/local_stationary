import Layout from '@/components/Layout';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useRole } from '@/hooks/useRole';
import Pagination from '@/components/Pagination';
import TableLoader from '@/components/TableLoader';

const PAGE_SIZE = 10;

export default function FlavorsPage() {
  const [flavors, setFlavors]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [name, setName]             = useState('');
  const [saving, setSaving]         = useState(false);
  const [editModal, setEditModal]   = useState(false);
  const [editItem, setEditItem]     = useState(null);
  const [editName, setEditName]     = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [page, setPage]             = useState(1);
  const [search, setSearch]         = useState('');
  const { canAdd, canDelete } = useRole();

  async function load() {
    setLoading(true);
    const data = await fetch('/api/flavors').then(r => r.json()).catch(() => []);
    setFlavors(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res  = await fetch('/api/flavors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success('Flavor added.');
      setName('');
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  function openEdit(f) {
    setEditItem(f);
    setEditName(f.name);
    setEditModal(true);
  }

  async function handleEdit(e) {
    e.preventDefault();
    if (!editName.trim()) return;
    setEditSaving(true);
    try {
      const res  = await fetch(`/api/flavors/${editItem.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: editName }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success('Flavor updated.');
      setEditModal(false);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(id, flavorName) {
    if (!confirm(`Delete flavor "${flavorName}"?`)) return;
    try {
      const res  = await fetch(`/api/flavors/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success('Flavor deleted.');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  const colSpan = canDelete ? 5 : 4;
  const filtered = flavors.filter(f => f.name?.toLowerCase().includes(search.toLowerCase()));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <Layout title="Flavors">
      <div className="grid-sidebar">
        {canAdd && (
          <div className="card">
            <div className="card-header"><span className="card-title">Add Flavor</span></div>
            <form onSubmit={handleAdd}>
              <div className="card-body">
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label>Flavor Name *</label>
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Strawberry" required />
                </div>
                <button className="btn btn-primary" type="submit" disabled={saving} style={{ width: '100%', justifyContent: 'center' }}>
                  {saving ? 'Adding…' : '+ Add Flavor'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="card">
          <div className="card-header">
            <span className="card-title">🍬 Flavors ({filtered.length}{filtered.length !== flavors.length ? ` of ${flavors.length}` : ''})</span>
            <div style={{ position: 'relative', flex: 1, maxWidth: 260, minWidth: 0 }}>
              <svg style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)', pointerEvents: 'none' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search flavors…" style={{ paddingLeft: 28, fontSize: 13, width: '100%' }} />
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th className="hide-mobile">Products</th>
                  <th className="hide-mobile">Created</th>
                  {canDelete && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableLoader cols={colSpan} />
                ) : flavors.length === 0 ? (
                  <tr><td colSpan={colSpan}><div className="empty-state"><div className="icon">🍬</div><p>{search ? 'No flavors match.' : 'No flavors yet.'}</p></div></td></tr>
                ) : paged.map((f, i) => (
                  <tr key={f.id}>
                    <td>{(page - 1) * PAGE_SIZE + i + 1}</td>
                    <td><strong>{f.name}</strong></td>
                    <td className="hide-mobile">
                      <span style={{ background: f.product_count > 0 ? 'rgba(59,130,246,.15)' : 'var(--bg-base)', color: f.product_count > 0 ? '#3b82f6' : 'var(--text-faint)', borderRadius: 12, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>
                        {f.product_count}
                      </span>
                    </td>
                    <td className="hide-mobile" style={{ color: '#9ca3af', fontSize: 12 }}>{new Date(f.created_at).toLocaleDateString()}</td>
                    {canDelete && (
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => openEdit(f)}>✏️ Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(f.id, f.name)}>🗑️</button>
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
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <span className="modal-title">Edit Flavor</span>
              <button className="modal-close" onClick={() => setEditModal(false)}>×</button>
            </div>
            <form onSubmit={handleEdit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Flavor Name *</label>
                  <input value={editName} onChange={e => setEditName(e.target.value)} required autoFocus />
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
