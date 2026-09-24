import Layout from '@/components/Layout';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useRole } from '@/hooks/useRole';
import Pagination from '@/components/Pagination';
import TableLoader from '@/components/TableLoader';

const PAGE_SIZE = 10;
const EMPTY = { name: '', contact: '', phone: '', email: '', address: '' };

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [modal,     setModal]     = useState(false);
  const [editing,   setEditing]   = useState(null);
  const [form,      setForm]      = useState(EMPTY);
  const [saving,    setSaving]    = useState(false);
  const [page,      setPage]      = useState(1);
  const [search,    setSearch]    = useState('');

  const { canEdit } = useRole();

  async function load() {
    setLoading(true);
    const data = await fetch('/api/suppliers').then(r => r.json());
    setSuppliers(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openAdd()  { setEditing(null); setForm(EMPTY); setModal(true); }
  function openEdit(s) { setEditing(s); setForm({ name: s.name, contact: s.contact || '', phone: s.phone || '', email: s.email || '', address: s.address || '' }); setModal(true); }

  const filtered = suppliers.filter(s => {
    const q = search.toLowerCase();
    return (
      s.name?.toLowerCase().includes(q) ||
      s.contact?.toLowerCase().includes(q) ||
      s.phone?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q)
    );
  });

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const url    = editing ? `/api/suppliers/${editing.id}` : '/api/suppliers';
      const method = editing ? 'PUT' : 'POST';
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data   = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success(editing ? 'Supplier updated.' : 'Supplier added.');
      setModal(false);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this supplier?')) return;
    const res = await fetch(`/api/suppliers/${id}`, { method: 'DELETE' });
    if (res.ok) { toast.success('Deleted.'); load(); }
    else toast.error('Failed to delete.');
  }

  return (
    <Layout title="Suppliers">
      <div className="card">
        <div className="card-header">
          <div>
            <span className="card-title">🏭 Suppliers ({filtered.length}{filtered.length !== suppliers.length ? ` of ${suppliers.length}` : ''})</span>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 140 }}>
              <svg style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)', pointerEvents: 'none' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search name, contact, phone…" style={{ paddingLeft: 28, fontSize: 13, width: '100%' }} />
            </div>
            {canEdit && (
              <button className="btn btn-primary" onClick={openAdd} style={{ whiteSpace: 'nowrap' }}>+ Add Supplier</button>
            )}
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th className="hide-mobile">Contact</th>
                <th className="hide-mobile">Phone</th>
                <th className="hide-mobile">Email</th>
                {canEdit && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableLoader cols={canEdit ? 6 : 5} />
              ) : filtered.length === 0 ? (
                <tr><td colSpan={canEdit ? 6 : 5}><div className="empty-state"><div className="icon">🏭</div><p>{search ? 'No suppliers match.' : 'No suppliers yet.'}</p></div></td></tr>
              ) : filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((s, i) => (
                <tr key={s.id}>
                  <td>{(page - 1) * PAGE_SIZE + i + 1}</td>
                  <td>
                    <strong>{s.name}</strong>
                    {s.email && <div className="show-mobile" style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{s.email}</div>}
                  </td>
                  <td className="hide-mobile">{s.contact || '—'}</td>
                  <td className="hide-mobile">{s.phone   || '—'}</td>
                  <td className="hide-mobile">{s.email   || '—'}</td>
                  {canEdit && (
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(s)}>✏️ Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(s.id)}>🗑️</button>
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

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">{editing ? 'Edit Supplier' : 'Add Supplier'}</span>
              <button className="modal-close" onClick={() => setModal(false)}>×</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group full">
                    <label>Supplier Name *</label>
                    <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="e.g. ABC Distributors" />
                  </div>
                  <div className="form-group">
                    <label>Contact Person</label>
                    <input value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} placeholder="John Doe" />
                  </div>
                  <div className="form-group">
                    <label>Phone</label>
                    <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="9876543210" />
                  </div>
                  <div className="form-group full">
                    <label>Email</label>
                    <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="supplier@example.com" />
                  </div>
                  <div className="form-group full">
                    <label>Address</label>
                    <textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Full address…" />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Supplier'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
