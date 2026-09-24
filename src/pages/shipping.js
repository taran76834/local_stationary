import Layout from '@/components/Layout';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import { useRole } from '@/hooks/useRole';
import Pagination from '@/components/Pagination';
import TableLoader from '@/components/TableLoader';

const PAGE_SIZE = 12;

export default function ShippingPage() {
  const router = useRouter();
  const { isAdmin, isManager } = useRole();

  const [loading, setLoading] = useState(true);
  const [rates, setRates] = useState([]);
  const [countries, setCountries] = useState([]);

  // Filters and pagination
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  // Toggle Add Row Visibility
  const [showAddRow, setShowAddRow] = useState(false);

  // Direct Inline Add Row State
  const [newCountryId, setNewCountryId] = useState('');
  const [newStateId, setNewStateId] = useState('');
  const [newCityId, setNewCityId] = useState('');
  const [newStatesList, setNewStatesList] = useState([]);
  const [newCitiesList, setNewCitiesList] = useState([]);
  const [newPrice, setNewPrice] = useState('');
  const [newEstimatedDays, setNewEstimatedDays] = useState('');
  const [newStatus, setNewStatus] = useState('active');
  const [addingRate, setAddingRate] = useState(false);
  const [addErrorField, setAddErrorField] = useState(null); // 'combination' | 'price' | null

  const countrySelectRef = useRef(null);
  const priceInputRef = useRef(null);

  // Inline Edit Row State
  const [editingId, setEditingId] = useState(null);
  const [editCountryId, setEditCountryId] = useState('');
  const [editStateId, setEditStateId] = useState('');
  const [editCityId, setEditCityId] = useState('');
  const [editStatesList, setEditStatesList] = useState([]);
  const [editCitiesList, setEditCitiesList] = useState([]);
  const [editPrice, setEditPrice] = useState('');
  const [editEstimatedDays, setEditEstimatedDays] = useState('');
  const [editStatus, setEditStatus] = useState('active');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editErrorField, setEditErrorField] = useState(null);

  const editCountrySelectRef = useRef(null);
  const editPriceInputRef = useRef(null);

  // Load countries once on mount
  useEffect(() => {
    async function fetchCountries() {
      try {
        const res = await fetch('/api/shipping/locations?type=countries');
        const data = await res.json();
        if (Array.isArray(data.countries)) {
          setCountries(data.countries);
        }
      } catch (err) {
        console.error('Failed to load countries:', err);
      }
    }
    fetchCountries();
  }, []);

  // Fetch states when add row country changes
  useEffect(() => {
    if (!newCountryId) {
      setNewStatesList([]);
      setNewCitiesList([]);
      setNewStateId('');
      setNewCityId('');
      return;
    }

    async function fetchStates() {
      try {
        const res = await fetch(`/api/shipping/locations?type=states&country_id=${newCountryId}`);
        const data = await res.json();
        setNewStatesList(Array.isArray(data.states) ? data.states : []);
      } catch (err) {
        console.error('Failed to load states:', err);
      }
    }
    fetchStates();
  }, [newCountryId]);

  // Fetch cities when add row state changes
  useEffect(() => {
    if (!newStateId) {
      setNewCitiesList([]);
      setNewCityId('');
      return;
    }

    async function fetchCities() {
      try {
        const res = await fetch(`/api/shipping/locations?type=cities&state_id=${newStateId}`);
        const data = await res.json();
        setNewCitiesList(Array.isArray(data.cities) ? data.cities : []);
      } catch (err) {
        console.error('Failed to load cities:', err);
      }
    }
    fetchCities();
  }, [newStateId]);

  // Fetch states when edit row country changes
  useEffect(() => {
    if (!editCountryId) {
      setEditStatesList([]);
      setEditCitiesList([]);
      setEditStateId('');
      setEditCityId('');
      return;
    }

    async function fetchEditStates() {
      try {
        const res = await fetch(`/api/shipping/locations?type=states&country_id=${editCountryId}`);
        const data = await res.json();
        setEditStatesList(Array.isArray(data.states) ? data.states : []);
      } catch (err) {
        console.error('Failed to load edit states:', err);
      }
    }
    fetchEditStates();
  }, [editCountryId]);

  // Fetch cities when edit row state changes
  useEffect(() => {
    if (!editStateId) {
      setEditCitiesList([]);
      setEditCityId('');
      return;
    }

    async function fetchEditCities() {
      try {
        const res = await fetch(`/api/shipping/locations?type=cities&state_id=${editStateId}`);
        const data = await res.json();
        setEditCitiesList(Array.isArray(data.cities) ? data.cities : []);
      } catch (err) {
        console.error('Failed to load edit cities:', err);
      }
    }
    fetchEditCities();
  }, [editStateId]);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch('/api/shipping');
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load shipping data.');

      setRates(Array.isArray(data.rates) ? data.rates : []);
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to load shipping details.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function resetAddForm() {
    setNewCountryId('');
    setNewStateId('');
    setNewCityId('');
    setNewPrice('');
    setNewEstimatedDays('');
    setNewStatus('active');
    setAddErrorField(null);
  }

  // Handle direct inline add
  async function handleAddRate(e) {
    if (e) e.preventDefault();

    const targetCountryId = newCountryId ? parseInt(newCountryId) : null;
    const targetStateId = newStateId ? parseInt(newStateId) : null;
    const targetCityId = newCityId ? parseInt(newCityId) : null;

    // Check for duplicate combination
    const isDuplicate = rates.some(r =>
      (r.country_id ?? null) === targetCountryId &&
      (r.state_id ?? null) === targetStateId &&
      (r.city_id ?? null) === targetCityId
    );

    if (isDuplicate) {
      setAddErrorField('combination');
      countrySelectRef.current?.focus();
      toast.error('A shipping rate with this geographic combination already exists.');
      return;
    }

    if (newPrice === '' || isNaN(parseFloat(newPrice)) || parseFloat(newPrice) < 0) {
      setAddErrorField('price');
      priceInputRef.current?.focus();
      toast.error('Please enter a valid shipping price.');
      return;
    }

    setAddingRate(true);
    setAddErrorField(null);

    try {
      const res = await fetch('/api/shipping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          country_id: targetCountryId,
          state_id: targetStateId,
          city_id: targetCityId,
          price: parseFloat(newPrice),
          estimated_days: newEstimatedDays.trim() || '3-5 business days',
          status: newStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 || data.errorField === 'combination') {
          setAddErrorField('combination');
          countrySelectRef.current?.focus();
        } else if (data.errorField === 'price') {
          setAddErrorField('price');
          priceInputRef.current?.focus();
        }
        throw new Error(data.message || 'Failed to add rate.');
      }

      toast.success('Shipping rate added.');
      resetAddForm();
      setShowAddRow(false);
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to add rate.');
    } finally {
      setAddingRate(false);
    }
  }

  // Start inline editing of an existing row
  async function startEdit(rate) {
    setEditingId(rate.id);
    setEditErrorField(null);
    setEditCountryId(rate.country_id ? String(rate.country_id) : '');
    setEditStateId(rate.state_id ? String(rate.state_id) : '');
    setEditCityId(rate.city_id ? String(rate.city_id) : '');
    setEditPrice(String(rate.price ?? '0'));
    setEditEstimatedDays(rate.estimated_days || '3-5 business days');
    setEditStatus(rate.status || 'active');

    // Pre-fetch states and cities for the edited row
    if (rate.country_id) {
      try {
        const sRes = await fetch(`/api/shipping/locations?type=states&country_id=${rate.country_id}`);
        const sData = await sRes.json();
        setEditStatesList(Array.isArray(sData.states) ? sData.states : []);
      } catch (err) {
        console.error(err);
      }
    }
    if (rate.state_id) {
      try {
        const cRes = await fetch(`/api/shipping/locations?type=cities&state_id=${rate.state_id}`);
        const cData = await cRes.json();
        setEditCitiesList(Array.isArray(cData.cities) ? cData.cities : []);
      } catch (err) {
        console.error(err);
      }
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setEditErrorField(null);
  }

  // Save inline edit
  async function handleSaveEdit(rateId) {
    const targetCountryId = editCountryId ? parseInt(editCountryId) : null;
    const targetStateId = editStateId ? parseInt(editStateId) : null;
    const targetCityId = editCityId ? parseInt(editCityId) : null;

    // Check for duplicate combination excluding this rate
    const isDuplicate = rates.some(r =>
      r.id !== rateId &&
      (r.country_id ?? null) === targetCountryId &&
      (r.state_id ?? null) === targetStateId &&
      (r.city_id ?? null) === targetCityId
    );

    if (isDuplicate) {
      setEditErrorField('combination');
      editCountrySelectRef.current?.focus();
      toast.error('A shipping rate with this geographic combination already exists.');
      return;
    }

    if (editPrice === '' || isNaN(parseFloat(editPrice)) || parseFloat(editPrice) < 0) {
      setEditErrorField('price');
      editPriceInputRef.current?.focus();
      toast.error('Please enter a valid shipping price.');
      return;
    }

    setSavingEdit(true);
    setEditErrorField(null);

    try {
      const res = await fetch(`/api/shipping/${rateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          country_id: targetCountryId,
          state_id: targetStateId,
          city_id: targetCityId,
          price: parseFloat(editPrice),
          estimated_days: editEstimatedDays.trim() || '3-5 business days',
          status: editStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 || data.errorField === 'combination') {
          setEditErrorField('combination');
          editCountrySelectRef.current?.focus();
        } else if (data.errorField === 'price') {
          setEditErrorField('price');
          editPriceInputRef.current?.focus();
        }
        throw new Error(data.message || 'Failed to update rate.');
      }

      toast.success('Shipping rate updated.');
      setEditingId(null);
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to update rate.');
    } finally {
      setSavingEdit(false);
    }
  }

  // Delete rate
  async function handleDeleteRate(id, label) {
    if (!confirm(`Are you sure you want to delete this shipping rate for "${label}"?`)) return;

    try {
      const res = await fetch(`/api/shipping/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to delete rate.');

      toast.success('Shipping rate deleted.');
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to delete.');
    }
  }

  // Filter rates
  const filtered = rates.filter(r => {
    if (statusFilter && r.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const countryMatch = r.country_name ? r.country_name.toLowerCase().includes(q) : false;
      const stateMatch = r.state_name ? r.state_name.toLowerCase().includes(q) : false;
      const cityMatch = r.city_name ? r.city_name.toLowerCase().includes(q) : false;
      if (!countryMatch && !stateMatch && !cityMatch) return false;
    }
    return true;
  });

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const getAddInputStyle = (isComb, isPrice) => {
    if (isComb && addErrorField === 'combination') {
      return {
        border: '2px solid #ef4444',
        boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.25)',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      };
    }
    if (isPrice && addErrorField === 'price') {
      return {
        border: '2px solid #ef4444',
        boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.25)',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      };
    }
    return {};
  };

  const getEditInputStyle = (isComb, isPrice) => {
    if (isComb && editErrorField === 'combination') {
      return {
        border: '2px solid #ef4444',
        boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.25)',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      };
    }
    if (isPrice && editErrorField === 'price') {
      return {
        border: '2px solid #ef4444',
        boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.25)',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      };
    }
    return {};
  };

  return (
    <Layout title="Shipping Management" subtitle="Manage geographic shipping rates by Country, State & City">

      {/* ── Regional Shipping Rates Table with Direct Rows & Columns ── */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🚚</span> Geographic Rates by Country, State & City ({filtered.length})
            </div>
            <div className="card-sub">Select country, state, and city to configure delivery rates</div>
          </div>

          <div>
            <button
              type="button"
              className={`btn ${showAddRow ? 'btn-secondary' : 'btn-primary'}`}
              onClick={() => {
                if (showAddRow) {
                  resetAddForm();
                  setShowAddRow(false);
                } else {
                  setShowAddRow(true);
                  setAddErrorField(null);
                }
              }}
            >
              {showAddRow ? '✕ Cancel' : '+ Add Shipping Rate'}
            </button>
          </div>
        </div>

        {/* ── Filter bar ── */}
        <div style={{ display: 'flex', gap: 12, padding: '12px 22px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', alignItems: 'center', background: 'var(--bg-base)' }}>
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search country, state or city…"
            style={{ flex: '1 1 200px', minWidth: 160, padding: '7px 12px', border: '1.5px solid var(--border)', borderRadius: 6, fontSize: 13, background: 'var(--bg-input)', color: 'var(--text-base)' }}
          />

          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { key: '', label: 'All Status' },
              { key: 'active', label: 'Active' },
              { key: 'inactive', label: 'Inactive' },
            ].map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => { setStatusFilter(tab.key); setPage(1); }}
                className={`btn btn-sm ${statusFilter === tab.key ? 'btn-primary' : 'btn-secondary'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {(search || statusFilter) && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => { setSearch(''); setStatusFilter(''); setPage(1); }}
            >
              ✕ Clear
            </button>
          )}
        </div>

        {/* ── Table with Direct Inline Add & Edit Rows ── */}
        <div className="table-wrap">
          <table style={{ width: '100%', minWidth: 900 }}>
            <thead>
              <tr style={{ background: 'var(--bg-base)' }}>
                <th style={{ width: 190 }}>Country</th>
                <th style={{ width: 190 }}>State / Region</th>
                <th style={{ width: 190 }}>City / Destination</th>
                <th style={{ width: 130 }}>Price (₹) *</th>
                <th style={{ width: 150 }}>Est. Time</th>
                <th style={{ width: 110 }}>Status</th>
                <th style={{ width: 120, textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>

              {/* ── INLINE ADD ROW (Shown only when + Add Shipping Rate is clicked) ── */}
              {showAddRow && (
                <tr style={{ background: addErrorField ? 'rgba(239,68,68,.06)' : 'rgba(99,102,241,.06)', borderBottom: `2px solid ${addErrorField ? '#ef4444' : 'var(--primary)'}` }}>
                  {/* Country Select */}
                  <td style={{ padding: '8px 10px' }}>
                    <select
                      ref={countrySelectRef}
                      value={newCountryId}
                      onChange={e => {
                        setNewCountryId(e.target.value);
                        setNewStateId('');
                        setNewCityId('');
                        setAddErrorField(null);
                      }}
                      style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1.5px solid var(--primary)', fontSize: 13, background: 'var(--bg-input)', color: 'var(--text-base)', fontWeight: 600, ...getAddInputStyle(true, false) }}
                    >
                      <option value="">— All Countries —</option>
                      {countries.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.flag ? `${c.flag} ` : ''}{c.name}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* State Select */}
                  <td style={{ padding: '8px 10px' }}>
                    <select
                      value={newStateId}
                      disabled={!newCountryId}
                      onChange={e => {
                        setNewStateId(e.target.value);
                        setNewCityId('');
                        setAddErrorField(null);
                      }}
                      style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1.5px solid var(--border)', fontSize: 13, background: 'var(--bg-input)', color: 'var(--text-base)', opacity: newCountryId ? 1 : 0.6, ...getAddInputStyle(true, false) }}
                    >
                      <option value="">— All States —</option>
                      {newStatesList.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* City Select */}
                  <td style={{ padding: '8px 10px' }}>
                    <select
                      value={newCityId}
                      disabled={!newStateId && !newCountryId}
                      onChange={e => {
                        setNewCityId(e.target.value);
                        setAddErrorField(null);
                      }}
                      style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1.5px solid var(--border)', fontSize: 13, background: 'var(--bg-input)', color: 'var(--text-base)', opacity: newCountryId ? 1 : 0.6, ...getAddInputStyle(true, false) }}
                    >
                      <option value="">— All Cities —</option>
                      {newCitiesList.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Price Input */}
                  <td style={{ padding: '8px 10px' }}>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>₹</span>
                      <input
                        ref={priceInputRef}
                        type="number"
                        min="0"
                        step="0.01"
                        value={newPrice}
                        onChange={e => {
                          setNewPrice(e.target.value);
                          if (addErrorField === 'price') setAddErrorField(null);
                        }}
                        placeholder="0.00"
                        style={{ width: '100%', padding: '7px 8px 7px 22px', borderRadius: 6, border: '1.5px solid var(--border)', fontSize: 13, background: 'var(--bg-input)', color: 'var(--text-base)', fontWeight: 600, ...getAddInputStyle(false, true) }}
                      />
                    </div>
                  </td>

                  {/* Estimated Delivery Time */}
                  <td style={{ padding: '8px 10px' }}>
                    <input
                      type="text"
                      value={newEstimatedDays}
                      onChange={e => setNewEstimatedDays(e.target.value)}
                      placeholder="e.g. 3-5 days"
                      style={{ width: '100%', padding: '7px 8px', borderRadius: 6, border: '1.5px solid var(--border)', fontSize: 12.5, background: 'var(--bg-input)', color: 'var(--text-base)' }}
                    />
                  </td>

                  {/* Status Select */}
                  <td style={{ padding: '8px 10px' }}>
                    <select
                      value={newStatus}
                      onChange={e => setNewStatus(e.target.value)}
                      style={{ width: '100%', padding: '7px 8px', borderRadius: 6, border: '1.5px solid var(--border)', fontSize: 12.5, background: 'var(--bg-input)', color: 'var(--text-base)' }}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </td>

                  {/* Action Buttons */}
                  <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={handleAddRate}
                        disabled={addingRate}
                        style={{ flex: 1, justifyContent: 'center', padding: '6px 8px' }}
                      >
                        {addingRate ? '…' : '+ Add'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => { resetAddForm(); setShowAddRow(false); }}
                        title="Cancel"
                        style={{ padding: '6px 8px' }}
                      >
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              )}

              {/* ── EXISTING RATES ROWS ── */}
              {loading ? (
                <TableLoader cols={7} />
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '36px 16px' }}>
                    <div className="empty-state" style={{ padding: 0 }}>
                      <div className="empty-state-icon">🚚</div>
                      <p>{search || statusFilter ? 'No shipping rates match your filters.' : 'No geographic shipping rates configured yet.'}</p>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        Click &quot;+ Add Shipping Rate&quot; above to configure your first delivery rate.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                paged.map(rate => {
                  const isEditing = editingId === rate.id;

                  if (isEditing) {
                    return (
                      <tr key={rate.id} style={{ background: editErrorField ? 'rgba(239,68,68,.06)' : 'rgba(99,102,241,.06)', borderBottom: editErrorField ? '2px solid #ef4444' : 'none' }}>
                        {/* Edit Country Select */}
                        <td style={{ padding: '8px 10px' }}>
                          <select
                            ref={editCountrySelectRef}
                            value={editCountryId}
                            onChange={e => {
                              setEditCountryId(e.target.value);
                              setEditStateId('');
                              setEditCityId('');
                              setEditErrorField(null);
                            }}
                            style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1.5px solid var(--border)', fontSize: 12.5, background: 'var(--bg-input)', color: 'var(--text-base)', fontWeight: 600, ...getEditInputStyle(true, false) }}
                          >
                            <option value="">— All Countries —</option>
                            {countries.map(c => (
                              <option key={c.id} value={c.id}>
                                {c.flag ? `${c.flag} ` : ''}{c.name}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Edit State Select */}
                        <td style={{ padding: '8px 10px' }}>
                          <select
                            value={editStateId}
                            disabled={!editCountryId}
                            onChange={e => {
                              setEditStateId(e.target.value);
                              setEditCityId('');
                              setEditErrorField(null);
                            }}
                            style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1.5px solid var(--border)', fontSize: 12.5, background: 'var(--bg-input)', color: 'var(--text-base)', opacity: editCountryId ? 1 : 0.6, ...getEditInputStyle(true, false) }}
                          >
                            <option value="">— All States —</option>
                            {editStatesList.map(s => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Edit City Select */}
                        <td style={{ padding: '8px 10px' }}>
                          <select
                            value={editCityId}
                            disabled={!editStateId && !editCountryId}
                            onChange={e => {
                              setEditCityId(e.target.value);
                              setEditErrorField(null);
                            }}
                            style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1.5px solid var(--border)', fontSize: 12.5, background: 'var(--bg-input)', color: 'var(--text-base)', opacity: editCountryId ? 1 : 0.6, ...getEditInputStyle(true, false) }}
                          >
                            <option value="">— All Cities —</option>
                            {editCitiesList.map(c => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Edit Price */}
                        <td style={{ padding: '8px 10px' }}>
                          <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>₹</span>
                            <input
                              ref={editPriceInputRef}
                              type="number"
                              min="0"
                              step="0.01"
                              value={editPrice}
                              onChange={e => {
                                setEditPrice(e.target.value);
                                if (editErrorField === 'price') setEditErrorField(null);
                              }}
                              style={{ width: '100%', padding: '6px 8px 6px 22px', borderRadius: 6, border: '1.5px solid var(--border)', fontSize: 12.5, background: 'var(--bg-input)', color: 'var(--text-base)', fontWeight: 600, ...getEditInputStyle(false, true) }}
                            />
                          </div>
                        </td>

                        {/* Edit Est. Delivery */}
                        <td style={{ padding: '8px 10px' }}>
                          <input
                            type="text"
                            value={editEstimatedDays}
                            onChange={e => setEditEstimatedDays(e.target.value)}
                            placeholder="3-5 days"
                            style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1.5px solid var(--border)', fontSize: 12, background: 'var(--bg-input)', color: 'var(--text-base)' }}
                          />
                        </td>

                        {/* Edit Status */}
                        <td style={{ padding: '8px 10px' }}>
                          <select
                            value={editStatus}
                            onChange={e => setEditStatus(e.target.value)}
                            style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1.5px solid var(--border)', fontSize: 12, background: 'var(--bg-input)', color: 'var(--text-base)' }}
                          >
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        </td>

                        {/* Save / Cancel Buttons */}
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => handleSaveEdit(rate.id)}
                              disabled={savingEdit}
                              title="Save changes"
                              style={{ padding: '4px 8px' }}
                            >
                              {savingEdit ? '…' : '💾'}
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={cancelEdit}
                              title="Cancel"
                              style={{ padding: '4px 8px' }}
                            >
                              ✕
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  // Normal Display Row
                  const locationLabel = rate.city_name
                    ? `${rate.city_name}${rate.state_name ? `, ${rate.state_name}` : ''}, ${rate.country_name || 'All Countries'}`
                    : rate.state_name
                    ? `${rate.state_name}, ${rate.country_name || 'All Countries'}`
                    : rate.country_name
                    ? `${rate.country_name}`
                    : 'All Countries';

                  return (
                    <tr key={rate.id}>
                      {/* Country */}
                      <td style={{ fontWeight: 600 }}>
                        {rate.country_name ? (
                          <>
                            {rate.country_flag ? `${rate.country_flag} ` : ''}
                            {rate.country_name}
                          </>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>-</span>
                        )}
                      </td>

                      {/* State */}
                      <td>
                        {rate.state_name ? (
                          <span style={{ fontWeight: 500 }}>{rate.state_name}</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>-</span>
                        )}
                      </td>

                      {/* City */}
                      <td>
                        {rate.city_name ? (
                          <span style={{ fontWeight: 500 }}>{rate.city_name}</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>-</span>
                        )}
                      </td>

                      {/* Price */}
                      <td style={{ fontWeight: 700, color: 'var(--primary)' }}>
                        ₹{parseFloat(rate.price).toFixed(2)}
                      </td>

                      {/* Est Delivery */}
                      <td style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>
                        {rate.estimated_days || '—'}
                      </td>

                      {/* Status */}
                      <td>
                        <span className={`badge ${rate.status === 'active' ? 'badge-green' : 'badge-secondary'}`}>
                          {rate.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => startEdit(rate)}
                            title="Edit Rate"
                            style={{ padding: '4px 8px', fontSize: 12 }}
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDeleteRate(rate.id, locationLabel)}
                            title="Delete Rate"
                            style={{ padding: '4px 8px', fontSize: 12 }}
                          >
                            🗑
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={filtered.length}
          onChange={setPage}
        />
      </div>

    </Layout>
  );
}
