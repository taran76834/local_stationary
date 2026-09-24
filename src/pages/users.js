import Layout from '@/components/Layout';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import { IconUsers, IconEdit, IconTrash, IconShield, IconStore } from '@/components/Icons';
import Pagination from '@/components/Pagination';
import TableLoader from '@/components/TableLoader';

const PAGE_SIZE = 10;

const EMPTY = {
  name: '',
  email: '',
  password: '',
  role: 'sales',
  stores: [],
  storePerms: {},
  canManageProducts: false,
  canViewOrdersCustomers: false,
};

function getInitials(name = '') {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function roleBadgeClass(role) {
  if (role === 'admin')       return 'badge-green';
  if (role === 'manager')     return 'badge-blue';
  if (role === 'store_minus') return 'badge-green';
  if (role === 'store_plus')  return 'badge-amber';
  if (role === 'sales')       return 'badge-blue';
  return 'badge-green';
}

function roleBadgeColor(role) {
  if (role === 'admin')       return '#10b981';
  if (role === 'manager')     return '#3b82f6';
  if (role === 'store_minus') return '#10b981';
  if (role === 'store_plus')  return '#f59e0b';
  if (role === 'sales')       return '#3b82f6';
  return '#10b981';
}

function roleLabel(role) {
  if (role === 'admin')       return 'Admin';
  if (role === 'manager')     return 'Manager';
  if (role === 'store_minus') return 'Store Minus';
  if (role === 'store_plus')  return 'Store Plus';
  if (role === 'sales')       return 'Sales';
  return role;
}

// ── Store picker with checkboxes (for manager role) ───────────────────────────
function StoreCheckboxPicker({ stores, selectedStores, onChange }) {
  function toggleStore(storeId) {
    const next = new Set(selectedStores.map(String));
    const sidStr = String(storeId);
    if (next.has(sidStr)) {
      next.delete(sidStr);
    } else {
      next.add(sidStr);
    }
    onChange(Array.from(next));
  }

  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: 10,
      overflow: 'hidden',
      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
    }}>
      {stores.map((s, idx) => {
        const isSelected = selectedStores.includes(String(s.id));
        return (
          <div
            key={s.id}
            onClick={() => toggleStore(s.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '12px 16px',
              background: isSelected ? '#ecfdf5' : (idx % 2 === 0 ? 'transparent' : 'var(--bg-base)'),
              borderBottom: idx < stores.length - 1 ? '1px solid var(--border)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              borderLeft: isSelected ? '3px solid #10b981' : '3px solid transparent',
              paddingLeft: isSelected ? '13px' : '16px',
            }}
            onMouseEnter={(e) => !isSelected && (e.currentTarget.style.background = 'var(--bg-hover, #f9fafb)')}
            onMouseLeave={(e) => {
              if (!isSelected) e.currentTarget.style.background = idx % 2 === 0 ? 'transparent' : 'var(--bg-base)';
            }}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggleStore(s.id)}
              style={{
                accentColor: '#10b981',
                marginRight: 12,
                cursor: 'pointer',
                width: 18,
                height: 18,
              }}
            />
            <IconStore size={15} color={isSelected ? '#10b981' : 'var(--text-muted)'} style={{ marginRight: 10, flexShrink: 0 }} />
            <span style={{
              fontSize: 14,
              fontWeight: 500,
              color: isSelected ? '#059669' : 'var(--text-base)',
              flex: 1,
              transition: 'color 0.2s ease',
            }}>
              {s.name}
            </span>
            {isSelected && (
              <span style={{
                fontSize: 11,
                color: '#065f46',
                fontWeight: 700,
                background: '#d1fae5',
                padding: '4px 10px',
                borderRadius: 6,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                ✓ Selected
              </span>
            )}
          </div>
        );
      })}

      {stores.length === 0 && (
        <div style={{
          padding: '24px 16px',
          textAlign: 'center',
          color: 'var(--text-faint)',
          fontSize: 14,
        }}>
          No stores available
        </div>
      )}
    </div>
  );
}

// ── Store picker with checkboxes for Minus / Plus / Transfers (for sales role) ──
// storePerms format: { "storeId": ["minus", "plus", "transfers"] }
// Backward-compat: old string value "minus"|"plus" is treated as [value]
const PERM_OPTIONS = [
  { key: 'minus',     label: 'Minus',     color: '#10b981', desc: 'Create bills' },
  { key: 'plus',      label: 'Plus',      color: '#f59e0b', desc: 'Edit stock & receipts' },
  { key: 'transfers', label: 'Transfers', color: '#0284c7', desc: 'Stock transfers' },
];

function normalizePerms(val) {
  // Accept array or legacy string
  if (Array.isArray(val)) return val;
  if (typeof val === 'string' && val) return [val];
  return [];
}

function StorePermPicker({ stores, storePerms, onChange }) {
  function togglePerm(storeId, permKey) {
    const sidStr = String(storeId);
    const current = normalizePerms(storePerms[sidStr]);
    let next;
    if (current.includes(permKey)) {
      next = current.filter(p => p !== permKey);
    } else {
      next = [...current, permKey];
    }
    const updated = { ...storePerms };
    if (next.length === 0) {
      delete updated[sidStr];
    } else {
      updated[sidStr] = next;
    }
    onChange(updated);
  }

  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: 10,
      overflow: 'hidden',
      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
    }}>
      {stores.map((s, idx) => {
        const sidStr = String(s.id);
        const currentPerms = normalizePerms(storePerms[sidStr]);
        const hasAny = currentPerms.length > 0;
        return (
          <div
            key={s.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '12px 16px',
              background: hasAny ? 'var(--bg-base)' : (idx % 2 === 0 ? 'transparent' : 'var(--bg-base)'),
              borderBottom: idx < stores.length - 1 ? '1px solid var(--border)' : 'none',
              gap: 12,
              transition: 'background 0.2s ease',
              borderLeft: hasAny ? '3px solid #10b981' : '3px solid transparent',
            }}
          >
            <IconStore size={15} color={hasAny ? '#10b981' : 'var(--text-muted)'} style={{ flexShrink: 0 }} />
            <span style={{
              fontSize: 14,
              fontWeight: 500,
              color: hasAny ? 'var(--text-base)' : 'var(--text-muted)',
              flex: 1,
              minWidth: 100,
            }}>
              {s.name}
            </span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              {PERM_OPTIONS.map(opt => {
                const checked = currentPerms.includes(opt.key);
                return (
                  <label
                    key={opt.key}
                    title={opt.desc}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      cursor: 'pointer',
                      padding: '4px 10px',
                      borderRadius: 20,
                      border: `1.5px solid ${checked ? opt.color : 'var(--border)'}`,
                      background: checked ? `${opt.color}18` : 'transparent',
                      transition: 'all 0.15s ease',
                      userSelect: 'none',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePerm(s.id, opt.key)}
                      style={{
                        accentColor: opt.color,
                        cursor: 'pointer',
                        width: 14,
                        height: 14,
                        margin: 0,
                      }}
                    />
                    <span style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: checked ? opt.color : 'var(--text-muted)',
                    }}>
                      {opt.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}

      {stores.length === 0 && (
        <div style={{
          padding: '24px 16px',
          textAlign: 'center',
          color: 'var(--text-faint)',
          fontSize: 14,
        }}>
          No stores available
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const router = useRouter();
  const [users,   setUsers]   = useState([]);
  const [stores,  setStores]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(false);
  const [editing, setEditing] = useState(null);
  const [form,    setForm]    = useState(EMPTY);
  const [saving,  setSaving]  = useState(false);
  const [page,    setPage]    = useState(1);

  useEffect(() => {
    if (currentUser && currentUser.role !== 'admin') {
      router.replace('/dashboard');
    }
  }, [currentUser, router]);

  async function load() {
    setLoading(true);
    try {
      const [uData, sData] = await Promise.all([
        fetch('/api/users').then(r => r.json()),
        fetch('/api/stores').then(r => r.json()),
      ]);
      setUsers(Array.isArray(uData) ? uData : []);
      setStores(Array.isArray(sData) ? sData : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY);
    setModal(true);
  }

  function openEdit(u) {
    setEditing(u);
    setForm({
      name:                   u.name,
      email:                  u.email,
      password:               '',
      role:                   u.role,
      stores:                 u.role === 'manager' ? (u.stores || []).map(String) : [],
      storePerms:             u.role === 'sales' ? (u.storePerms || {}) : {},
      canManageProducts:      u.role === 'sales' ? (u.canManageProducts || false) : false,
      canViewOrdersCustomers: u.role === 'sales' ? (u.canViewOrdersCustomers || false) : false,
    });
    setModal(true);
  }

  // Roles that use the per-store picker
  const PERM_ROLES = ['sales', 'manager'];

  async function handleSave(e) {
    e.preventDefault();

    // Validate store assignment
    if (form.role === 'manager' && form.stores.length === 0) {
      toast.error('Assign at least one store.');
      return;
    }
    if (form.role === 'sales' && Object.keys(form.storePerms).length === 0) {
      toast.error('Assign at least one store with permission.');
      return;
    }

    setSaving(true);
    try {
      const url    = editing ? `/api/users/${editing.id}` : '/api/users';
      const method = editing ? 'PUT' : 'POST';
      const body   = {
        name:       form.name,
        email:      form.email,
        role:       form.role,
      };
      
      // Add appropriate store data based on role
      if (form.role === 'manager') {
        body.stores = form.stores.map(Number);
      } else if (form.role === 'sales') {
        body.storePerms = form.storePerms;
        body.canManageProducts = form.canManageProducts;
        body.canViewOrdersCustomers = form.canViewOrdersCustomers;
      }
      
      if (form.password) body.password = form.password;

      const res  = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success(editing ? 'User updated.' : 'User added.');
      setModal(false);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this user?')) return;
    const res  = await fetch(`/api/users/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) { toast.success('User deleted.'); load(); }
    else toast.error(data.message);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Layout title="User List" subtitle="Manage admin and store user accounts">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Admin & Store Users</div>
            <div className="card-sub">{users.length} account{users.length !== 1 ? 's' : ''}</div>
          </div>
          <button className="btn btn-primary" onClick={openAdd}>+ Add User</button>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>User</th>
                <th>Email</th>
                <th>Role</th>
                <th>Assigned Stores</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableLoader cols={7} />
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state">
                      <div className="empty-state-icon"><IconUsers size={22} /></div>
                      <p>No users found.</p>
                    </div>
                  </td>
                </tr>
              ) : users.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((u, i) => {
                // Build store display chips
                let storeChips = [];
                if (u.role === 'admin') {
                  storeChips = null;
                } else if (u.role === 'manager') {
                  // Manager shows simple store names without permission labels
                  storeChips = (u.stores || []).map(id => {
                    const store = stores.find(s => s.id === Number(id));
                    return store ? { name: store.name, level: null } : null;
                  }).filter(Boolean);
                } else if ((u.role === 'sales') && u.storePerms && Object.keys(u.storePerms).length > 0) {
                  // Sales shows stores with permission badges (array format)
                  storeChips = Object.entries(u.storePerms).flatMap(([sid, perms]) => {
                    const store = stores.find(s => s.id === Number(sid));
                    if (!store) return [];
                    const permArr = Array.isArray(perms) ? perms : (typeof perms === 'string' ? [perms] : []);
                    return permArr.map(level => ({ name: store.name, level, storeId: sid }));
                  }).filter(Boolean);
                } else {
                  // Legacy store_minus / store_plus roles
                  storeChips = (u.stores || []).map(id => {
                    const store = stores.find(s => s.id === Number(id));
                    return store ? { name: store.name, level: u.role === 'store_minus' ? 'minus' : 'plus' } : null;
                  }).filter(Boolean);
                }

                return (
                  <tr key={u.id}>
                    <td style={{ color: '#94a3b8', fontSize: 12 }}>{(page - 1) * PAGE_SIZE + i + 1}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: '50%',
                          background: u.id === currentUser?.id ? '#10b981' : '#e2e8f0',
                          color: u.id === currentUser?.id ? '#fff' : '#64748b',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 700, flexShrink: 0,
                        }}>
                          {getInitials(u.name)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-base)', fontSize: 13.5 }}>{u.name}</div>
                          {u.id === currentUser?.id && (
                            <div style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>You</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{u.email}</td>
                    <td>
                      <span
                        className={`badge ${roleBadgeClass(u.role)}`}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                      >
                        <IconShield size={10} color={roleBadgeColor(u.role)} />
                        {roleLabel(u.role)}
                      </span>
                    </td>
                    <td>
                      {u.role === 'admin' ? (
                        <span style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>All Stores</span>
                      ) : !storeChips || storeChips.length === 0 ? (
                        <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>No store assigned</span>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {storeChips.map((chip, idx) => (
                            chip.level ? (
                              // Sales/legacy with permission badges
                              <span
                                key={idx}
                                className={
                                  chip.level === 'minus' ? 'badge badge-green' :
                                  chip.level === 'transfers' ? 'badge badge-blue' :
                                  'badge badge-amber'
                                }
                                style={{ fontSize: 11.5, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                              >
                                <IconStore size={10} color={chip.level === 'minus' ? '#10b981' : chip.level === 'transfers' ? '#0284c7' : '#f59e0b'} />
                                {chip.name}
                                <span style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  opacity: 0.8,
                                  textTransform: 'uppercase',
                                }}>
                                  {chip.level === 'minus' ? '−' : chip.level === 'transfers' ? '↔' : '+'}
                                </span>
                              </span>
                            ) : (
                              // Manager without badges
                              <span
                                key={idx}
                                className="badge badge-blue"
                                style={{ fontSize: 11.5, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                              >
                                <IconStore size={10} color="#3b82f6" />
                                {chip.name}
                              </span>
                            )
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={{ color: '#94a3b8', fontSize: 12 }}>
                      {new Date(u.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(u)}>
                          <IconEdit size={13} /> Edit
                        </button>
                        {u.id !== currentUser?.id && (
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(u.id)}>
                            <IconTrash size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={users.length} pageSize={PAGE_SIZE} onChange={setPage} />
      </div>

      {/* Add / Edit Modal */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <span className="modal-title">{editing ? 'Edit User' : 'Add New User'}</span>
              <button className="modal-close" onClick={() => setModal(false)}>×</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                  {/* Name */}
                  <div className="form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: '#10b981' }}>👤</span>
                      <span>Full Name *</span>
                    </label>
                    <input
                      value={form.name}
                      onChange={e => setForm({ ...form, name: e.target.value })}
                      placeholder="e.g. John Doe"
                      required
                      style={{
                        fontSize: 14,
                        padding: '10px 12px',
                        borderRadius: 8,
                      }}
                    />
                  </div>

                  {/* Email */}
                  <div className="form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: '#10b981' }}>📧</span>
                      <span>Email Address *</span>
                    </label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={e => setForm({ ...form, email: e.target.value })}
                      placeholder="john@store.com"
                      required
                      style={{
                        fontSize: 14,
                        padding: '10px 12px',
                        borderRadius: 8,
                      }}
                    />
                  </div>

                  {/* Role */}
                  <div className="form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: '#10b981' }}>🔐</span>
                      <span>Role *</span>
                    </label>
                    <select
                      value={form.role}
                      onChange={e => setForm({ ...form, role: e.target.value, stores: [], storePerms: {}, canManageProducts: false })}
                      style={{
                        fontSize: 14,
                        padding: '10px 12px',
                        borderRadius: 8,
                      }}
                    >
                      <option value="admin">Admin</option>
                      <option value="manager">Manager</option>
                      <option value="sales">Sales</option>
                    </select>
                  </div>

                  {/* Store picker - differs by role */}
                  {form.role === 'manager' && (
                    <div className="form-group">
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <IconStore size={14} color="#3b82f6" />
                        <span>Assigned Stores *</span>
                      </label>
                      <StoreCheckboxPicker
                        stores={stores}
                        selectedStores={form.stores}
                        onChange={stores => setForm({ ...form, stores })}
                      />
                      {form.stores.length === 0 && (
                        <span style={{
                          fontSize: 12,
                          color: '#ef4444',
                          marginTop: 8,
                          display: 'block',
                          fontWeight: 500,
                        }}>
                          ⚠ Please select at least one store
                        </span>
                      )}
                    </div>
                  )}

                  {form.role === 'sales' && (
                    <div className="form-group">
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <IconStore size={14} color="#10b981" />
                        <span>Store Permissions *</span>
                        <span style={{ marginLeft: 'auto', fontSize: 11.5, color: '#94a3b8', fontWeight: 400 }}>
                          Minus = bills &nbsp;·&nbsp; Plus = stock &nbsp;·&nbsp; Transfers = stock transfers
                        </span>
                      </label>
                      <StorePermPicker
                        stores={stores}
                        storePerms={form.storePerms}
                        onChange={storePerms => setForm({ ...form, storePerms })}
                      />
                      {Object.keys(form.storePerms).length === 0 && (
                        <span style={{
                          fontSize: 12,
                          color: '#ef4444',
                          marginTop: 8,
                          display: 'block',
                          fontWeight: 500,
                        }}>
                          ⚠ Please assign at least one store with permission
                        </span>
                      )}
                    </div>
                  )}

                  {/* Manage Products toggle — sales only */}
                  {form.role === 'sales' && (
                    <div className="form-group">
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ color: '#10b981' }}>📦</span>
                        <span>Manage Products</span>
                      </label>
                      <div
                        onClick={() => setForm({ ...form, canManageProducts: !form.canManageProducts })}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 14,
                          padding: '12px 16px',
                          border: `1.5px solid ${form.canManageProducts ? '#10b981' : 'var(--border)'}`,
                          borderRadius: 10,
                          background: form.canManageProducts ? '#ecfdf5' : 'transparent',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          userSelect: 'none',
                        }}
                      >
                        {/* Toggle pill */}
                        <div style={{
                          position: 'relative',
                          width: 42,
                          height: 24,
                          borderRadius: 12,
                          background: form.canManageProducts ? '#10b981' : '#cbd5e1',
                          transition: 'background 0.2s ease',
                          flexShrink: 0,
                        }}>
                          <div style={{
                            position: 'absolute',
                            top: 3,
                            left: form.canManageProducts ? 21 : 3,
                            width: 18,
                            height: 18,
                            borderRadius: '50%',
                            background: '#fff',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                            transition: 'left 0.2s ease',
                          }} />
                        </div>
                        <div>
                          <div style={{
                            fontSize: 13.5,
                            fontWeight: 600,
                            color: form.canManageProducts ? '#059669' : 'var(--text-base)',
                          }}>
                            {form.canManageProducts ? 'Enabled' : 'Disabled'}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
                            Allow this user to add and edit products
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* View Orders & Website Customers toggle — sales only */}
                  {form.role === 'sales' && (
                    <div className="form-group">
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ color: '#0284c7' }}>🛒</span>
                        <span>View Orders &amp; Website Customers</span>
                      </label>
                      <div
                        onClick={() => setForm({ ...form, canViewOrdersCustomers: !form.canViewOrdersCustomers })}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 14,
                          padding: '12px 16px',
                          border: `1.5px solid ${form.canViewOrdersCustomers ? '#0284c7' : 'var(--border)'}`,
                          borderRadius: 10,
                          background: form.canViewOrdersCustomers ? '#e0f2fe' : 'transparent',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          userSelect: 'none',
                        }}
                      >
                        <div style={{
                          position: 'relative',
                          width: 42,
                          height: 24,
                          borderRadius: 12,
                          background: form.canViewOrdersCustomers ? '#0284c7' : '#cbd5e1',
                          transition: 'background 0.2s ease',
                          flexShrink: 0,
                        }}>
                          <div style={{
                            position: 'absolute',
                            top: 3,
                            left: form.canViewOrdersCustomers ? 21 : 3,
                            width: 18,
                            height: 18,
                            borderRadius: '50%',
                            background: '#fff',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                            transition: 'left 0.2s ease',
                          }} />
                        </div>
                        <div>
                          <div style={{
                            fontSize: 13.5,
                            fontWeight: 600,
                            color: form.canViewOrdersCustomers ? '#0284c7' : 'var(--text-base)',
                          }}>
                            {form.canViewOrdersCustomers ? 'Enabled' : 'Disabled'}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
                            Allow this user to view online orders and website customers
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Password */}
                  <div className="form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: '#f59e0b' }}>🔑</span>
                      <span>{editing ? 'New Password' : 'Password *'}</span>
                    </label>
                    <input
                      type="password"
                      value={form.password}
                      onChange={e => setForm({ ...form, password: e.target.value })}
                      placeholder={editing ? 'Leave blank to keep current' : 'Min. 6 characters'}
                      required={!editing}
                      minLength={6}
                      style={{
                        fontSize: 14,
                        padding: '10px 12px',
                        borderRadius: 8,
                      }}
                    />
                    {editing && (
                      <span style={{
                        fontSize: 12,
                        color: '#94a3b8',
                        marginTop: 6,
                        display: 'block',
                      }}>
                        Leave blank to keep the current password
                      </span>
                    )}
                  </div>


                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : editing ? 'Update User' : 'Add User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
