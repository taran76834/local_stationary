import Layout from '@/components/Layout';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useRole } from '@/hooks/useRole';
import Pagination from '@/components/Pagination';
import TableLoader from '@/components/TableLoader';

const PAGE_SIZE = 10;
const EMPTY = { name: '', phone: '' };

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [modal,     setModal]     = useState(false);
  const [editing,   setEditing]   = useState(null);
  const [form,      setForm]      = useState(EMPTY);
  const [saving,    setSaving]    = useState(false);
  const [page,      setPage]      = useState(1);

  const { isAdmin, isManager } = useRole();
  const canAdd = isAdmin || isManager;
  const canEdit = isAdmin || isManager;

  async function load() {
    setLoading(true);
    const data = await fetch('/api/customers').then(r => r.json());
    setCustomers(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openAdd()    { setEditing(null); setForm(EMPTY); setModal(true); }
  function openEdit(c)  { setEditing(c); setForm({ name: c.name, phone: c.phone || '' }); setModal(true); }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Name is required.'); return; }
    setSaving(true);
    try {
      const url    = editing ? `/api/customers/${editing.id}` : '/api/customers';
      const method = editing ? 'PUT' : 'POST';
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success(editing ? 'Customer updated.' : 'Customer added.');
      setModal(false);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this customer?')) return;
    const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
    if (res.ok) { toast.success('Deleted.'); load(); }
    else toast.error('Failed to delete.');
  }

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || '').includes(search)
  );
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <Layout title="Customers">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Customers ({filtered.length})</div>
            <div className="card-sub">Saved from bills — searchable by name or phone</div>
          </div>
          {canAdd && (
            <button className="btn btn-primary" onClick={openAdd}>+ Add Customer</button>
          )}
        </div>

        {/* Search bar */}
        <div className="search-bar">
          <input
            placeholder="Search by name or phone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Added On</th>
                {canEdit && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableLoader cols={canEdit ? 5 : 4} />
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 5 : 4}>
                    <div className="empty-state">
                      <div className="empty-state-icon">👤</div>
                      <p>{search ? 'No customers match your search.' : 'No customers yet.'}</p>
                      {!search && <span>Customers are saved automatically when bills are created.</span>}
                    </div>
                  </td>
                </tr>
              ) : paged.map((c, i) => (
                <tr key={c.id}>
                  <td style={{ color: '#94a3b8', fontSize: 12 }}>{(page - 1) * PAGE_SIZE + i + 1}</td>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text-base)' }}>{c.name}</div>
                  </td>
                  <td>
                    {c.phone
                      ? <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>📞 {c.phone}</span>
                      : <span style={{ color: 'var(--text-faint)' }}>—</span>}
                  </td>
                  <td style={{ fontSize: 12, color: '#94a3b8' }}>
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                  {canEdit && (
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(c)}>✏️ Edit</button>
                        {isAdmin && <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c.id)}>🗑️</button>}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onChange={p => { setPage(p); }} />
      </div>

      {/* Add / Edit Modal */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <span className="modal-title">{editing ? 'Edit Customer' : 'Add Customer'}</span>
              <button className="modal-close" onClick={() => setModal(false)}>×</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group full">
                    <label>Name *</label>
                    <input
                      value={form.name}
                      onChange={e => setForm({ ...form, name: e.target.value })}
                      required
                      placeholder="Customer name"
                      autoFocus
                    />
                  </div>
                  <div className="form-group full">
                    <label>Phone</label>
                    <input
                      value={form.phone}
                      onChange={e => setForm({ ...form, phone: e.target.value })}
                      placeholder="9876543210"
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : editing ? 'Update' : 'Add Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
