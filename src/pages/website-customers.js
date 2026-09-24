import Layout from '@/components/Layout';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import { useRole } from '@/hooks/useRole';
import Pagination from '@/components/Pagination';
import TableLoader from '@/components/TableLoader';
import { IconUserCheck, IconEdit, IconUser, IconShoppingBag, IconTrash } from '@/components/Icons';

const PAGE_SIZE = 10;
const EMPTY_CUSTOMER = { name: '', email: '', phone: '', password: '' };

export default function WebsiteCustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Edit / Add Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [form, setForm] = useState(EMPTY_CUSTOMER);
  const [saving, setSaving] = useState(false);

  // Detail View Modal (Customer Orders & Details)
  const [detailModal, setDetailModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const { isAdmin, isManager } = useRole();
  const canManage = isAdmin || isManager;

  async function loadCustomers() {
    setLoading(true);
    try {
      const res = await fetch('/api/website-customers');
      const data = await res.json();
      setCustomers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load website customers.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCustomers();
  }, []);

  // Auto-open customer detail if ?customer=ID is in the URL (coming from order page)
  useEffect(() => {
    if (!router.isReady || loading || customers.length === 0) return;
    const customerId = router.query.customer;
    if (customerId) {
      openCustomerDetail(Number(customerId));
      // Clean URL without reloading
      router.replace('/website-customers', undefined, { shallow: true });
    }
  }, [router.isReady, router.query.customer, loading, customers]);

  function openAddModal() {
    setEditingCustomer(null);
    setForm(EMPTY_CUSTOMER);
    setModalOpen(true);
  }

  function openEditModal(c) {
    setEditingCustomer(c);
    setForm({
      name: c.name || '',
      email: c.email || '',
      phone: c.phone || '',
      password: '',
    });
    setModalOpen(true);
  }

  async function openCustomerDetail(customerId) {
    setDetailLoading(true);
    setDetailModal(true);
    try {
      const res = await fetch(`/api/website-customers/${customerId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load customer profile.');
      setSelectedCustomer(data);
    } catch (err) {
      toast.error(err.message);
      setDetailModal(false);
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Name is required.'); return; }
    if (!form.email.trim()) { toast.error('Email is required.'); return; }

    setSaving(true);
    try {
      const url = editingCustomer ? `/api/website-customers/${editingCustomer.id}` : '/api/website-customers';
      const method = editingCustomer ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      toast.success(editingCustomer ? 'Customer updated.' : 'Customer created.');
      setModalOpen(false);
      loadCustomers();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Are you sure you want to delete this customer? Their previous orders will be preserved.')) return;
    try {
      const res = await fetch(`/api/website-customers/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Customer deleted.');
        if (selectedCustomer?.id === id) setDetailModal(false);
        loadCustomers();
      } else {
        const data = await res.json();
        toast.error(data.message || 'Failed to delete customer.');
      }
    } catch (err) {
      toast.error('Error deleting customer.');
    }
  }

  const filteredCustomers = useMemo(() => {
    return customers.filter(c =>
      (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.email || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.phone || '').includes(search)
    );
  }, [customers, search]);

  const pagedCustomers = useMemo(() => {
    return filteredCustomers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [filteredCustomers, page]);

  return (
    <Layout title="Website Customers" subtitle="Manage registered e-commerce accounts from your website">

      {/* Main Table Card */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Website Customers ({filteredCustomers.length})</div>
            <div className="card-sub">Manage website accounts, view purchase history & edit profiles</div>
          </div>
          {canManage && (
            <button className="btn btn-primary" onClick={openAddModal}>
              + Add Customer
            </button>
          )}
        </div>

        {/* Search Bar */}
        <div className="search-bar">
          <input
            placeholder="Search customer by name, email, or phone…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        {/* Customers Table */}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Orders</th>
                <th>Total Spent</th>
                <th>Joined Date</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableLoader cols={8} />
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-state" style={{ padding: '40px 20px', textAlign: 'center' }}>
                      <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'center' }}>
                        <IconUserCheck size={36} color="var(--text-muted)" />
                      </div>
                      <p style={{ fontWeight: 600, margin: 0, color: 'var(--text-base)' }}>No website customers found.</p>
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        {search ? 'No results match your search term.' : 'Customers who sign up on your Next.js site will appear here.'}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                pagedCustomers.map((c, i) => (
                  <tr key={c.id}>
                    <td style={{ color: '#94a3b8', fontSize: '12px' }}>
                      {(page - 1) * PAGE_SIZE + i + 1}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--text-base)' }}>{c.name}</div>
                    </td>
                    <td>
                      <span style={{ fontSize: '13px', color: 'var(--text-base)' }}>{c.email}</span>
                    </td>
                    <td>
                      {c.phone ? (
                        <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>Ph: {c.phone}</span>
                      ) : (
                        <span style={{ color: 'var(--text-faint)' }}>—</span>
                      )}
                    </td>
                    <td>
                      <span style={{
                        padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 600,
                        backgroundColor: c.total_orders > 0 ? '#e0e7ff' : '#f1f5f9',
                        color: c.total_orders > 0 ? '#4338ca' : '#64748b'
                      }}>
                        {c.total_orders} {c.total_orders === 1 ? 'order' : 'orders'}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--text-base)' }}>
                        ₹{parseFloat(c.total_spent || 0).toFixed(2)}
                      </div>
                    </td>
                    <td style={{ fontSize: '12px', color: '#94a3b8' }}>
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => openCustomerDetail(c.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <IconShoppingBag size={13} /> History
                        </button>
                        {canManage && (
                          <button className="btn btn-secondary btn-sm" onClick={() => openEditModal(c)} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <IconEdit size={13} /> Edit
                          </button>
                        )}
                        {isAdmin && (
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c.id)} title="Delete Customer">
                            <IconTrash size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination page={page} total={filteredCustomers.length} pageSize={PAGE_SIZE} onChange={p => setPage(p)} />
      </div>

      {/* Add / Edit Customer Modal */}
      {modalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)',
          zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            background: 'var(--bg-card, #fff)', borderRadius: '12px',
            maxWidth: '500px', width: '100%', padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)', border: '1px solid var(--border)'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '18px', color: 'var(--text-base)' }}>
              {editingCustomer ? 'Edit Website Customer' : 'Add New Website Customer'}
            </h3>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Full Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Customer Full Name"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-base)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Email Address *</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="customer@example.com"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-base)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Phone Number</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  placeholder="Phone number"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-base)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  {editingCustomer ? 'Reset Password (leave empty to keep unchanged)' : 'Password (default: 123456)'}
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  placeholder="Enter new password"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-base)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : editingCustomer ? 'Update Customer' : 'Create Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Detail & Order History Modal */}
      {detailModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)',
          zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            background: 'var(--bg-card, #fff)', borderRadius: '12px',
            maxWidth: '800px', width: '100%', maxHeight: '85vh', overflowY: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)', border: '1px solid var(--border)'
          }}>
            <div style={{
              padding: '16px 24px', borderBottom: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-base)' }}>
                  Customer Profile & Purchase History
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {selectedCustomer?.name} ({selectedCustomer?.email})
                </span>
              </div>
              <button
                onClick={() => setDetailModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            {detailLoading || !selectedCustomer ? (
              <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
                Loading customer profile…
              </div>
            ) : (
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* Profile Summary Card */}
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px',
                  padding: '16px', borderRadius: '8px', background: 'var(--bg-card-subtle, #f8fafc)', border: '1px solid var(--border)'
                }}>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Customer Name</span>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-base)' }}>{selectedCustomer.name}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Email Address</span>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-base)' }}>{selectedCustomer.email}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Phone</span>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-base)' }}>{selectedCustomer.phone || 'N/A'}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total Orders / Lifetime Spend</span>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: '#16a34a' }}>
                      {selectedCustomer.total_orders} orders / ₹{selectedCustomer.total_spent}
                    </div>
                  </div>
                </div>

                {/* Orders History Table */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '14px', marginBottom: '8px', color: 'var(--text-base)' }}>
                    <IconShoppingBag size={16} color="#6366f1" /> Order History ({selectedCustomer.orders?.length || 0})
                  </div>
                  <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', fontSize: '13px' }}>
                      <thead style={{ background: 'var(--bg-card-subtle, #f8fafc)' }}>
                        <tr>
                          <th style={{ padding: '8px 12px', textAlign: 'left' }}>Order #</th>
                          <th style={{ padding: '8px 12px', textAlign: 'left' }}>Date</th>
                          <th style={{ padding: '8px 12px', textAlign: 'left' }}>Payment</th>
                          <th style={{ padding: '8px 12px', textAlign: 'left' }}>Status</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedCustomer.orders || []).length === 0 ? (
                          <tr>
                            <td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                              No orders placed yet by this customer.
                            </td>
                          </tr>
                        ) : (
                          selectedCustomer.orders.map(o => (
                            <tr key={o.id} style={{ borderTop: '1px solid var(--border)' }}>
                              <td style={{ padding: '10px 12px', fontWeight: 600, color: '#6366f1' }}>
                                {o.order_number}
                              </td>
                              <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: '12px' }}>
                                {new Date(o.created_at).toLocaleDateString()}
                              </td>
                              <td style={{ padding: '10px 12px' }}>
                                <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'capitalize' }}>
                                  {o.payment_method} ({o.payment_status})
                                </span>
                              </td>
                              <td style={{ padding: '10px 12px' }}>
                                <span style={{
                                  padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600,
                                  backgroundColor: o.status === 'completed' ? '#dcfce7' : o.status === 'processing' ? '#e0f2fe' : '#fef3c7',
                                  color: o.status === 'completed' ? '#16a34a' : o.status === 'processing' ? '#0284c7' : '#d97706'
                                }}>
                                  {o.status}
                                </span>
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>
                                ₹{parseFloat(o.total_amount).toFixed(2)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}

            <div style={{ padding: '12px 24px', borderTop: '1px solid var(--border)', textAlign: 'right' }}>
              <button className="btn btn-secondary" onClick={() => setDetailModal(false)}>
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </Layout>
  );
}
