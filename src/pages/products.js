import Layout from '@/components/Layout';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import SearchableSelect from '@/components/SearchableSelect';
import { useRole } from '@/hooks/useRole';
import Pagination from '@/components/Pagination';
import TableLoader from '@/components/TableLoader';
import * as XLSX from 'xlsx';

const PAGE_SIZE = 15;
/* Flag to toggle Sell on Website column if online store is disabled */
const SHOW_ONLINE_STORE = false;

function formatAttributesLabel(attributes) {
  if (!attributes) return '';
  if (typeof attributes === 'string') {
    try { attributes = JSON.parse(attributes); } catch (e) { return attributes; }
  }
  if (typeof attributes !== 'object') return String(attributes);
  return Object.values(attributes).filter(Boolean).join(' - ');
}

// Clean SVG Icons to replace emojis
const TagIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
);

const PackageIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"></line><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
);

const EditIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
);

const TrashIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
);

const EyeIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
);

const UploadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
);

const LayersIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
);

const ImageIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', color: '#94a3b8' }}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
);

function StockInfoPopover({ product, storeFlavorStock, onEditStock, isAdmin }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);

  const flavorsList = product.flavors || [];
  const fpList = product.flavor_prices || [];
  const unitsList = product.units || [];
  const flavorStockList = storeFlavorStock[product.id] || [];

  function calcPos() {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({
      top: r.bottom + window.scrollY,
      left: Math.max(10, r.right + window.scrollX - 340),
    });
  }

  let varRows = [];
  if (fpList.length > 0) {
    varRows = fpList.map((fp, idx) => {
      let label = formatAttributesLabel(fp.attributes);
      if (!label && fp.flavor_id) {
        const flav = flavorsList.find(f => Number(f.id) === Number(fp.flavor_id));
        label = flav?.name || `Flavor #${fp.flavor_id}`;
      }

      const matchingItems = flavorStockList.filter(item => {
        if (item.variation_id && fp.id && Number(item.variation_id) === Number(fp.id)) {
          return true;
        }
        if (item.vari_attribute && fp.attributes) {
          const itemAttrStr = typeof item.vari_attribute === 'string' ? item.vari_attribute.trim() : JSON.stringify(item.vari_attribute);
          const fpAttrStr = typeof fp.attributes === 'string' ? fp.attributes.trim() : JSON.stringify(fp.attributes);
          const fpAttrLabel = formatAttributesLabel(fp.attributes).trim();
          if (itemAttrStr === fpAttrStr || itemAttrStr === fpAttrLabel) {
            return true;
          }
          try {
            const obj1 = typeof item.vari_attribute === 'string' ? JSON.parse(item.vari_attribute) : item.vari_attribute;
            const obj2 = typeof fp.attributes === 'string' ? JSON.parse(fp.attributes) : fp.attributes;
            if (obj1 && obj2 && JSON.stringify(obj1) === JSON.stringify(obj2)) {
              return true;
            }
          } catch(e) {}
        }
        return false;
      });
      const fQty = matchingItems.reduce((s, it) => s + (parseInt(it.stock) || 0), 0);

      const regPrice = fp.price !== undefined && fp.price !== null && fp.price !== '' ? parseFloat(fp.price) : (parseFloat(product.price) || 0);
      const salePrice = fp.sale_price !== undefined && fp.sale_price !== null && fp.sale_price !== '' ? parseFloat(fp.sale_price) : null;
      const effectivePrice = (salePrice && salePrice > 0 && salePrice < regPrice) ? salePrice : regPrice;

      return {
        key: `${fp.flavor_id}_${idx}`,
        label: label || 'Variation',
        qty: fQty,
        regPrice,
        salePrice: (salePrice && salePrice > 0 && salePrice < regPrice) ? salePrice : null,
        effectivePrice,
      };
    });
  } else if (flavorsList.length > 0) {
    varRows = flavorsList.map(flav => {
      const fs = flavorStockList.find(item => Number(item.flavor_id) === Number(flav.id));
      const fQty = fs ? fs.stock : 0;
      const regPrice = parseFloat(product.price) || 0;
      const salePrice = product.sale_price ? parseFloat(product.sale_price) : null;
      return {
        key: flav.id,
        label: flav.name,
        qty: fQty,
        regPrice,
        salePrice: (salePrice && salePrice > 0 && salePrice < regPrice) ? salePrice : null,
        effectivePrice: (salePrice && salePrice > 0 && salePrice < regPrice) ? salePrice : regPrice,
      };
    });
  }

  const popover = open && createPortal(
    <div
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      style={{
        position: 'absolute',
        top: pos.top,
        left: pos.left,
        paddingTop: 4,
        zIndex: 99999,
        animation: 'popIn 0.15s ease-out'
      }}
    >
      <div
        style={{
          minWidth: 320,
          maxWidth: 420,
          background: 'var(--bg-card)',
          border: '1.5px solid var(--border)',
          borderRadius: 12,
          boxShadow: '0 12px 32px rgba(0,0,0,.25)',
          padding: '14px 16px',
          fontSize: 12,
          color: 'var(--text-base)',
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: '#6366f1', borderBottom: '1px dashed var(--border)', paddingBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Variation Stock Breakdown</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto' }}>
          {varRows.map(vr => (
            <div key={vr.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5, gap: 14, paddingBottom: 6, borderBottom: '1px solid var(--border-light)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: 'var(--text-base)', lineHeight: 1.25 }}>{vr.label}</div>
                <div style={{ fontSize: 11, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <strong style={{ color: '#16a34a' }}>₹{vr.effectivePrice.toFixed(2)}</strong>
                  {vr.salePrice && (
                    <span style={{ textDecoration: 'line-through', color: '#94a3b8', fontSize: 10 }}>
                      ₹{vr.regPrice.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
              <span className={`badge ${vr.qty > 10 ? 'badge-green' : vr.qty > 0 ? 'badge-amber' : 'badge-red'}`} style={{ fontSize: 11, padding: '3px 8px', flexShrink: 0, fontWeight: 700 }}>
                {vr.qty} in stock
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );

  return (
    <div
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
      onMouseEnter={() => { calcPos(); setOpen(true); }}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        ref={btnRef}
        type="button"
        onClick={() => { calcPos(); setOpen(!open); }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '3px 8px',
          borderRadius: 6,
          border: '1.5px solid #6366f1',
          background: 'rgba(99,102,241,.08)',
          color: '#6366f1',
          fontSize: 11.5,
          fontWeight: 700,
          cursor: 'pointer',
          transition: 'all .15s',
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <span>View Stock</span>
      </button>
      {typeof document !== 'undefined' && popover}
    </div>
  );
}

function PriceInfoPopover({ product }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);

  const flavorsList = product.flavors || [];
  const fpList = product.flavor_prices || [];
  const unitsList = product.units || [];

  function calcPos() {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({
      top: r.bottom + window.scrollY,
      left: Math.max(10, r.right + window.scrollX - 320),
    });
  }

  let varRows = [];
  if (fpList.length > 0) {
    varRows = fpList.map((fp, idx) => {
      let label = formatAttributesLabel(fp.attributes);
      if (!label && fp.flavor_id) {
        const flav = flavorsList.find(f => Number(f.id) === Number(fp.flavor_id));
        label = flav?.name || `Flavor #${fp.flavor_id}`;
      }

      const regPrice = fp.price !== undefined && fp.price !== null && fp.price !== '' ? parseFloat(fp.price) : (parseFloat(product.price) || 0);
      const salePrice = fp.sale_price !== undefined && fp.sale_price !== null && fp.sale_price !== '' ? parseFloat(fp.sale_price) : null;
      const effectivePrice = (salePrice && salePrice > 0 && salePrice < regPrice) ? salePrice : regPrice;

      return {
        key: `${fp.flavor_id}_${idx}`,
        label: label || 'Variation',
        regPrice,
        salePrice: (salePrice && salePrice > 0 && salePrice < regPrice) ? salePrice : null,
        effectivePrice,
      };
    });
  } else if (flavorsList.length > 0) {
    varRows = flavorsList.map(flav => {
      const regPrice = parseFloat(product.price) || 0;
      const salePrice = product.sale_price ? parseFloat(product.sale_price) : null;
      return {
        key: flav.id,
        label: flav.name,
        regPrice,
        salePrice: (salePrice && salePrice > 0 && salePrice < regPrice) ? salePrice : null,
        effectivePrice: (salePrice && salePrice > 0 && salePrice < regPrice) ? salePrice : regPrice,
      };
    });
  }

  const popover = open && createPortal(
    <div
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      style={{
        position: 'absolute',
        top: pos.top,
        left: pos.left,
        paddingTop: 4,
        zIndex: 99999,
        animation: 'popIn 0.15s ease-out'
      }}
    >
      <div
        style={{
          minWidth: 300,
          maxWidth: 380,
          background: 'var(--bg-card)',
          border: '1.5px solid var(--border)',
          borderRadius: 12,
          boxShadow: '0 12px 32px rgba(0,0,0,.25)',
          padding: '14px 16px',
          fontSize: 12,
          color: 'var(--text-base)',
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: '#16a34a', borderBottom: '1px dashed var(--border)', paddingBottom: 8 }}>
          Variation Price List
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto' }}>
          {varRows.map(vr => (
            <div key={vr.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5, gap: 14, paddingBottom: 6, borderBottom: '1px solid var(--border-light)' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-base)' }}>{vr.label}</span>
              <div style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <strong style={{ color: '#16a34a', fontSize: 12.5 }}>₹{vr.effectivePrice.toFixed(2)}</strong>
                {vr.salePrice && (
                  <span style={{ textDecoration: 'line-through', color: '#94a3b8', fontSize: 10.5 }}>
                    ₹{vr.regPrice.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );

  return (
    <div
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
      onMouseEnter={() => { calcPos(); setOpen(true); }}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        ref={btnRef}
        type="button"
        onClick={() => { calcPos(); setOpen(!open); }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '3px 8px',
          borderRadius: 6,
          border: '1.5px solid #16a34a',
          background: 'rgba(22, 163, 74, .08)',
          color: '#16a34a',
          fontSize: 11.5,
          fontWeight: 700,
          cursor: 'pointer',
          transition: 'all .15s',
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <span>View Price</span>
      </button>
      {typeof document !== 'undefined' && popover}
    </div>
  );
}

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [flavors, setFlavors] = useState([]);
  const [units, setUnits] = useState([]);
  const [brands, setBrands] = useState([]);
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState('');
  const [storeStock, setStoreStock] = useState({});
  const [storeFlavorStock, setStoreFlavorStock] = useState({});

  const [viewProduct, setViewProduct] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  // Import Excel
  const [importModal, setImportModal] = useState(false);
  const [importRows, setImportRows] = useState([]);
  const [importFileName, setImportFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const fileInputRef = useRef(null);

  // Stock edit modal
  const [stockModal, setStockModal] = useState(false);
  const [stockProduct, setStockProduct] = useState(null);
  const [savingStock, setSavingStock] = useState(false);

  // Expiry batches: [{ qty, expiry_date }]
  const [batches, setBatches] = useState([{ qty: '', expiry_date: '' }]);

  function addBatch() {
    const opts = getStockVariationOptions(stockProduct);
    const firstOpt = opts.length > 0 ? opts[0] : null;
    setBatches(b => [...b, {
      qty: '',
      expiry_date: '',
      variation_id: firstOpt ? firstOpt.variation_id : '',
      var_key: firstOpt ? firstOpt.key : ''
    }]);
  }
  function removeBatch(i) { setBatches(b => b.filter((_, idx) => idx !== i)); }
  function updateBatch(i, field, val) {
    setBatches(b => { const n = [...b]; n[i] = { ...n[i], [field]: val }; return n; });
  }
  const batchTotal = batches.reduce((s, b) => s + (parseInt(b.qty) || 0), 0);

  const { canAddProduct, canEditProduct, canEditStock, isAdmin, assignedStores, canManageProducts } = useRole();

  const availableStores = stores;

  async function load() {
    setLoading(true);
    const [p, c, f, u, b, s] = await Promise.all([
      fetch('/api/products').then(r => r.json()).catch(() => []),
      fetch('/api/categories').then(r => r.json()).catch(() => []),
      fetch('/api/flavors').then(r => r.json()).catch(() => []),
      fetch('/api/units').then(r => r.json()).catch(() => []),
      fetch('/api/brands').then(r => r.json()).catch(() => []),
      fetch('/api/stores').then(r => r.json()).catch(() => []),
    ]);
    setProducts(Array.isArray(p) ? p : []);
    setCategories(Array.isArray(c) ? c : []);
    setFlavors(Array.isArray(f) ? f : []);
    setUnits(Array.isArray(u) ? u : []);
    setBrands(Array.isArray(b) ? b : []);
    setStores(Array.isArray(s) ? s : []);
    setLoading(false);
  }

  async function loadStoreStock(storeId) {
    const url = storeId ? `/api/store-products?store_id=${storeId}` : '/api/store-products';
    const rows = await fetch(url).then(r => r.json()).catch(() => []);
    if (Array.isArray(rows)) {
      const map = {};
      const flavorMap = {};
      rows.forEach(r => {
        map[r.product_id] = r.stock;
        flavorMap[r.product_id] = r.flavor_stocks || [];
      });
      setStoreStock(map);
      setStoreFlavorStock(flavorMap);
    }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { loadStoreStock(selectedStore); }, [selectedStore]);

  function openView(p) {
    setViewProduct(p);
  }

  function getStockVariationOptions(prod) {
    if (!prod) return [];
    const flavorsList = prod.flavors || [];
    const fpList = prod.flavor_prices || [];

    if (fpList.length > 0) {
      return fpList.map((fp, idx) => {
        let label = formatAttributesLabel(fp.attributes);
        if (!label && fp.flavor_id) {
          const flav = flavorsList.find(f => Number(f.id) === Number(fp.flavor_id));
          label = flav?.name || `Flavor #${fp.flavor_id}`;
        }

        return {
          key: String(fp.id || `var_${idx}`),
          variation_id: fp.id ? String(fp.id) : '',
          vari_attribute: fp.attributes || null,
          label: label || `Variation #${fp.id || idx + 1}`,
        };
      });
    }

    return [];
  }

  function openStockEdit(product) {
    if (!selectedStore) { toast.error('Select a store first to edit stock.'); return; }
    setStockProduct(product);
    const opts = getStockVariationOptions(product);
    const firstOpt = opts.length > 0 ? opts[0] : null;
    setBatches([{
      qty: '',
      expiry_date: '',
      variation_id: firstOpt ? firstOpt.variation_id : '',
      var_key: firstOpt ? firstOpt.key : ''
    }]);
    setStockModal(true);
  }

  async function handleSaveStock(e) {
    e.preventDefault();
    if (batchTotal === 0) { toast.error('Enter at least 1 unit.'); return; }
    setSavingStock(true);
    try {
      const res = await fetch('/api/store-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id: selectedStore,
          product_id: stockProduct.id,
          stock: (storeStock[stockProduct.id] ?? 0) + batchTotal,
          expiry_batches: batches.filter(b => parseInt(b.qty) > 0),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success(`Added ${batchTotal} unit${batchTotal > 1 ? 's' : ''} to stock.`);
      setStockModal(false);
      loadStoreStock(selectedStore);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingStock(false);
    }
  }

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target.result, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { defval: '' });
      const rows = raw.map(r => {
        const norm = {};
        Object.keys(r).forEach(k => {
          const normKey = k.trim().toLowerCase().replace(/\s+/g, ' ');
          norm[normKey] = typeof r[k] === 'string' ? r[k].trim() : String(r[k] ?? '').trim();
        });
        const trim = v => (v || '').trim();
        return {
          name: trim(norm['product description'] || norm['product name'] || norm['name']),
          category: trim(norm['category']),
          flavor: trim(norm['flavor'] || norm['flavour']),
          barcode: trim(norm['barcode'] || norm['sku']),
          price: trim(norm['price'] || norm['mrp']),
          description: trim(norm['description']),
        };
      }).filter(r => r.name);
      setImportRows(rows);
    };
    reader.readAsBinaryString(file);
  }

  async function handleImport() {
    if (importRows.length === 0) return;
    setImporting(true);
    try {
      const res = await fetch('/api/products/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: importRows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success(`Imported ${data.created} product${data.created !== 1 ? 's' : ''}. Skipped ${data.skipped.length}.`);
      if (data.errors?.length) toast.error(`${data.errors.length} row(s) had errors.`);
      setImportModal(false);
      setImportRows([]);
      setImportFileName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      load();
      if (data.skipped.length > 0 || data.errors.length > 0) {
        setImportResults(data);
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setImporting(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this product? This cannot be undone.')) return;
    const res  = await fetch(`/api/products/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) {
      toast.success('Product deleted.');
      load();
    } else {
      toast.error(data.message || 'Failed to delete.');
    }
  }

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.slug || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.barcode || '').includes(search) ||
    (p.tags || []).some(t => t.toLowerCase().includes(search.toLowerCase()))
  );
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const defaultUnitId = units.length > 0 ? String(units[0].id) : '';



  return (
    <Layout title="Products">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <PackageIcon size={20} /> Products ({products.length})
            </div>
            {selectedStore && (
              <div className="card-sub">
                Showing stock for: <strong>{stores.find(s => String(s.id) === String(selectedStore))?.name}</strong>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ minWidth: 200, flex: 1 }}>
              <SearchableSelect
                options={availableStores.map(s => ({ value: s.id, label: s.name }))}
                value={selectedStore}
                onChange={v => setSelectedStore(v)}
                placeholder={isAdmin ? "All Stores (Global Stock)" : "Select Store"}
              />
            </div>
            {canAddProduct && (
              <button className="btn btn-primary" onClick={() => router.push('/products/create')} style={{ whiteSpace: 'nowrap' }}>+ Add Product</button>
            )}
            {isAdmin && (
              <button className="btn btn-secondary" onClick={() => setImportModal(true)} style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <UploadIcon /> Import Excel
              </button>
            )}
          </div>
        </div>

        <div className="search-bar">
          <input placeholder="Search by name or barcode…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Image</th>
                <th>Name</th>
                <th>Category</th>
                <th>Variations</th>
                <th>Brand</th>
                <th>Barcode</th>
                <th>STOCK</th>
                <th>Price</th>
                {SHOW_ONLINE_STORE && <th>Sell on Website</th>}
                {canEditProduct && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableLoader cols={(canEditProduct ? 10 : 9) + (SHOW_ONLINE_STORE ? 1 : 0)} />
              ) : filtered.length === 0 ? (
                <tr><td colSpan={(canEditProduct ? 10 : 9) + (SHOW_ONLINE_STORE ? 1 : 0)}><div className="empty-state"><div className="empty-state-icon"><PackageIcon size={32} /></div><p>No products found.</p></div></td></tr>
              ) : paged.map((p, i) => {
                const stock = selectedStore ? (storeStock[p.id] ?? 0) : p.stock;
                return (
                  <tr key={p.id}>
                    <td style={{ color: '#94a3b8', fontSize: 12 }}>{(page - 1) * PAGE_SIZE + i + 1}</td>
                    <td>
                      {p.image ? (
                        <img
                          src={p.image}
                          alt={p.name}
                          style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', display: 'block' }}
                        />
                      ) : (
                        <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--bg-base)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <PackageIcon size={20} />
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <strong>{p.name}</strong>
                        {p.product_type === 'variable_product' || (p.flavors && p.flavors.length > 0) ? (
                          <span style={{ background: '#fef3c7', color: '#b45309', borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 700, border: '1px solid #fde68a' }}>
                            Variable
                          </span>
                        ) : (
                          <span style={{ background: '#f1f5f9', color: '#64748b', borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 600 }}>
                            Simple
                          </span>
                        )}
                      </div>
                      {p.slug && <div><code style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.slug}</code></div>}
                      {p.tags && p.tags.length > 0 && (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                          {p.tags.map((t, idx) => (
                            <span key={idx} style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', borderRadius: 4, padding: '1px 6px', fontSize: 10.5, fontWeight: 600, border: '1px solid rgba(99, 102, 241, 0.2)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <TagIcon /> {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td>{p.categories?.length ? p.categories.map(c => c.name).join(', ') : <span style={{ color: '#94a3b8' }}>—</span>}</td>
                    <td>{p.flavors?.length ? p.flavors.map(f => f.name).join(', ') : <span style={{ color: '#94a3b8' }}>—</span>}</td>
                    <td>{p.brands?.length ? p.brands.map(b => b.name).join(', ') : <span style={{ color: '#94a3b8' }}>—</span>}</td>
                    <td><code style={{ fontSize: 12 }}>{p.barcode || '—'}</code></td>
                    <td>
                      {selectedStore ? (
                        (p.product_type === 'variable_product' || (p.flavors && p.flavors.length > 0)) ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <StockInfoPopover
                              product={p}
                              storeFlavorStock={storeFlavorStock}
                            />
                            {isAdmin && (
                              <button
                                className="btn btn-secondary btn-xs"
                                onClick={() => openStockEdit(p)}
                              >
                                Edit Stock
                              </button>
                            )}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span className={`badge ${stock > 10 ? 'badge-green' : stock > 0 ? 'badge-amber' : 'badge-red'}`}>
                              {stock}
                            </span>
                            {isAdmin && (
                              <button
                                className="btn btn-secondary btn-xs"
                                onClick={() => openStockEdit(p)}
                              >
                                Edit Stock
                              </button>
                            )}
                          </div>
                        )
                      ) : (
                        (p.product_type === 'variable_product' || (p.flavors && p.flavors.length > 0)) ? (
                          <StockInfoPopover
                            product={p}
                            storeFlavorStock={storeFlavorStock}
                          />
                        ) : (
                          <span className={`badge ${p.stock > 10 ? 'badge-green' : p.stock > 0 ? 'badge-amber' : 'badge-red'}`}>
                            {p.stock}
                          </span>
                        )
                      )}
                    </td>
                    <td>
                      {p.product_type === 'variable_product' || (p.flavor_prices && p.flavor_prices.length > 0) || (p.flavors && p.flavors.length > 0) ? (
                        <PriceInfoPopover product={p} />
                      ) : (
                        <div>
                          {p.sale_price && parseFloat(p.sale_price) > 0 ? (
                            <>
                              <strong style={{ color: '#16a34a' }}>₹{parseFloat(p.sale_price).toFixed(2)}</strong>
                              <div style={{ fontSize: 11, color: '#94a3b8', textDecoration: 'line-through' }}>₹{parseFloat(p.price || 0).toFixed(2)}</div>
                            </>
                          ) : (
                            <strong>₹{parseFloat(p.price || 0).toFixed(2)}</strong>
                          )}
                        </div>
                      )}
                    </td>
                    {SHOW_ONLINE_STORE && (
                      <td>
                        <span className={`badge ${p.sell_on_website !== 0 && p.sell_on_website !== false ? 'badge-green' : 'badge-red'}`}>
                          {p.sell_on_website !== 0 && p.sell_on_website !== false ? 'Yes' : 'No'}
                        </span>
                      </td>
                    )}
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'nowrap' }}>
                        <button className="btn btn-secondary btn-xs" onClick={() => openView(p)} title="View Product Details" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '5px 7px' }}>
                          <EyeIcon />
                        </button>
                        {canEditProduct && (
                          <button className="btn btn-secondary btn-xs" onClick={() => router.push(`/products/edit/${p.id}`)} title="Edit Product" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '5px 7px' }}>
                            <EditIcon />
                          </button>
                        )}
                        {canEditProduct && isAdmin && (
                          <button className="btn btn-danger btn-xs" onClick={() => handleDelete(p.id)} title="Delete Product" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '5px 7px' }}>
                            <TrashIcon />
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

        {filtered.length > PAGE_SIZE && (
          <Pagination total={filtered.length} pageSize={PAGE_SIZE} page={page} onChange={setPage} />
        )}
      </div>

      {/* Edit Store Stock Modal — with expiry batches */}
      {stockModal && stockProduct && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setStockModal(false)}>
          <div className="modal" style={{ maxWidth: 720, width: '90vw' }}>
            <div className="modal-header">
              <div>
                <span className="modal-title">Add Stock</span>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  {stockProduct.name} → {stores.find(s => String(s.id) === String(selectedStore))?.name}
                </div>
              </div>
              <button className="modal-close" onClick={() => setStockModal(false)}>×</button>
            </div>
            <form onSubmit={handleSaveStock}>
              <div className="modal-body">

                {/* Current stock info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, padding: '10px 14px', background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }}>
                  <span style={{ color: '#64748b' }}>Current stock:</span>
                  <span className={`badge ${(storeStock[stockProduct.id] ?? 0) > 10 ? 'badge-green' : (storeStock[stockProduct.id] ?? 0) > 0 ? 'badge-amber' : 'badge-red'}`}>
                    {storeStock[stockProduct.id] ?? 0} units
                  </span>
                  {batchTotal > 0 && (
                    <>
                      <span style={{ color: '#94a3b8' }}>→</span>
                      <span className="badge badge-green">{(storeStock[stockProduct.id] ?? 0) + batchTotal} units after</span>
                    </>
                  )}
                </div>

                {/* Batch info */}
                <div style={{ marginBottom: 10, padding: '8px 12px', background: '#eef2ff', borderRadius: 8, fontSize: 12.5, color: '#4338ca' }}>
                  Split into batches by expiry date. Leave expiry blank if the product has no expiry.
                </div>

                {/* Batch rows */}
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
                  <thead>
                    <tr>
                      {stockProduct && (stockProduct.product_type === 'variable_product' || stockProduct.flavor_prices?.length > 0 || stockProduct.flavors?.length > 0) && (
                        <th style={{ textAlign: 'left', fontSize: 11, color: '#94a3b8', fontWeight: 600, paddingBottom: 6, textTransform: 'uppercase' }}>Variation</th>
                      )}
                      <th style={{ textAlign: 'left', fontSize: 11, color: '#94a3b8', fontWeight: 600, paddingBottom: 6, textTransform: 'uppercase' }}>Qty *</th>
                      <th style={{ textAlign: 'left', fontSize: 11, color: '#94a3b8', fontWeight: 600, paddingBottom: 6, textTransform: 'uppercase' }}>Expiry Date</th>
                      <th style={{ width: 32 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {batches.map((batch, i) => (
                      <tr key={i}>
                        {stockProduct && (stockProduct.product_type === 'variable_product' || stockProduct.flavor_prices?.length > 0 || stockProduct.flavors?.length > 0) && (
                          <td style={{ paddingBottom: 8, paddingRight: 10, minWidth: 260 }}>
                            <select
                              value={batch.var_key || batch.variation_id || ''}
                              onChange={e => {
                                const key = e.target.value;
                                const opts = getStockVariationOptions(stockProduct);
                                const match = opts.find(o => o.key === key);
                                if (match) {
                                  setBatches(b => {
                                    const next = [...b];
                                    next[i] = {
                                      ...next[i],
                                      var_key: match.key,
                                      variation_id: match.variation_id,
                                      vari_attribute: match.vari_attribute
                                    };
                                    return next;
                                  });
                                }
                              }}
                              style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1.5px solid #6366f1', fontSize: 12, background: 'var(--bg-input)', color: 'var(--text-base)', fontWeight: 600 }}
                            >
                              {getStockVariationOptions(stockProduct).map(opt => (
                                <option key={opt.key} value={opt.key}>{opt.label}</option>
                              ))}
                            </select>
                          </td>
                        )}
                        <td style={{ paddingBottom: 8, paddingRight: 10 }}>
                          <input
                            type="number"
                            min="1"
                            max="2000"
                            placeholder="0"
                            value={batch.qty}
                            onChange={e => {
                              const v = parseInt(e.target.value) || 0;
                              if (v > 2000) { toast.error('Max 2,000 units per batch.'); return; }
                              updateBatch(i, 'qty', e.target.value);
                            }}
                            style={{ width: 80 }}
                            required={i === 0}
                          />
                        </td>
                        <td style={{ paddingBottom: 8, paddingRight: 10 }}>
                          <input
                            type="date"
                            value={batch.expiry_date}
                            onChange={e => updateBatch(i, 'expiry_date', e.target.value)}
                            style={{ width: 170 }}
                          />
                        </td>
                        <td style={{ paddingBottom: 8 }}>
                          {batches.length > 1 && (
                            <button type="button" className="btn btn-danger btn-xs" onClick={() => removeBatch(i)}>✕</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => addBatch()}
                >
                  + Add Batch
                </button>

                {batchTotal > 0 && (
                  <div style={{ marginTop: 14, textAlign: 'right', fontSize: 13, fontWeight: 600, color: '#6366f1' }}>
                    Total adding: {batchTotal} unit{batchTotal > 1 ? 's' : ''}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setStockModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={savingStock || batchTotal === 0}>
                  {savingStock ? 'Saving…' : `Add ${batchTotal > 0 ? batchTotal + ' Unit' + (batchTotal > 1 ? 's' : '') : 'Stock'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Excel Modal */}
      {importModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setImportModal(false)}>
          <div className="modal" style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <span className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <UploadIcon /> Import Products from Excel
              </span>
              <button className="modal-close" onClick={() => { setImportModal(false); setImportRows([]); setImportFileName(''); if (fileInputRef.current) fileInputRef.current.value = ''; }}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: 12, padding: '10px 14px', background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12.5, color: 'var(--text-muted)' }}>
                Expected columns: <strong>Product Description</strong>, <strong>Flavor</strong> (optional), <strong>Category</strong> (optional), <strong>Price</strong> (optional).<br />
                Product names and categories will be title-cased automatically. Duplicate names are skipped.
              </div>
              <div className="form-group">
                <label>Select Excel File (.xlsx / .xls)</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                />
              </div>
              {importRows.length > 0 && (
                <>
                  <div style={{ marginBottom: 8, fontSize: 13, color: 'var(--text-muted)' }}>
                    Preview — <strong>{importRows.length}</strong> product{importRows.length !== 1 ? 's' : ''} found:
                  </div>
                  <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                    <table style={{ width: '100%', fontSize: 12.5 }}>
                      <thead>
                        <tr>
                          <th style={{ padding: '6px 10px', textAlign: 'left', background: 'var(--bg-base)', position: 'sticky', top: 0 }}>Name</th>
                          <th style={{ padding: '6px 10px', textAlign: 'left', background: 'var(--bg-base)', position: 'sticky', top: 0 }}>Category</th>
                          <th style={{ padding: '6px 10px', textAlign: 'left', background: 'var(--bg-base)', position: 'sticky', top: 0 }}>Flavor</th>
                          <th style={{ padding: '6px 10px', textAlign: 'left', background: 'var(--bg-base)', position: 'sticky', top: 0 }}>Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importRows.slice(0, 50).map((r, i) => (
                          <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                            <td style={{ padding: '5px 10px' }}>{r.name}</td>
                            <td style={{ padding: '5px 10px', color: r.category ? 'inherit' : '#94a3b8' }}>{r.category || '—'}</td>
                            <td style={{ padding: '5px 10px', color: r.flavor ? 'inherit' : '#94a3b8' }}>{r.flavor || '—'}</td>
                            <td style={{ padding: '5px 10px', color: r.price ? 'inherit' : '#94a3b8' }}>{r.price ? `₹${r.price}` : '—'}</td>
                          </tr>
                        ))}
                        {importRows.length > 50 && (
                          <tr><td colSpan={4} style={{ padding: '6px 10px', color: '#94a3b8', textAlign: 'center' }}>…and {importRows.length - 50} more</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => { setImportModal(false); setImportRows([]); setImportFileName(''); if (fileInputRef.current) fileInputRef.current.value = ''; }}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleImport} disabled={importing || importRows.length === 0}>
                {importing ? 'Importing…' : `Import ${importRows.length} Product${importRows.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Product Detail Modal */}
      {viewProduct && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setViewProduct(null)}>
          <div className="modal" style={{ maxWidth: 720, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <span className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <EyeIcon /> Product Details: <strong>{viewProduct.name}</strong>
              </span>
              <button className="modal-close" onClick={() => setViewProduct(null)}>×</button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Summary Header */}
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', background: 'var(--bg-base)', padding: 16, borderRadius: 12, border: '1px solid var(--border)' }}>
                <div style={{ width: 84, height: 84, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--bg-card)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {viewProduct.image ? (
                    <img src={viewProduct.image} alt={viewProduct.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <PackageIcon size={36} />
                  )}
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-base)' }}>{viewProduct.name}</h3>
                    <span className="badge badge-amber" style={{ fontSize: 11 }}>
                      {viewProduct.product_type === 'variable_product' || (viewProduct.flavors?.length > 0) ? 'Variable Product' : 'Simple Product'}
                    </span>
                  </div>
                  {viewProduct.slug && <code style={{ fontSize: 12, color: 'var(--text-muted)' }}>{viewProduct.slug}</code>}
                  <div style={{ fontSize: 12.5, marginTop: 4 }}>
                    <strong>Barcode: </strong> <code>{viewProduct.barcode || '—'}</code>
                  </div>
                </div>
              </div>

              {/* Taxonomy Info Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                <div style={{ padding: 12, background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Categories</div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2, color: 'var(--text-base)' }}>
                    {viewProduct.categories?.length ? viewProduct.categories.map(c => c.name).join(', ') : '—'}
                  </div>
                </div>
                <div style={{ padding: 12, background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Flavors</div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2, color: 'var(--text-base)' }}>
                    {viewProduct.flavors?.length ? viewProduct.flavors.map(f => f.name).join(', ') : '—'}
                  </div>
                </div>
                <div style={{ padding: 12, background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Brand</div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2, color: 'var(--text-base)' }}>
                    {viewProduct.brands?.length ? viewProduct.brands.map(b => b.name).join(', ') : '—'}
                  </div>
                </div>
              </div>

              {/* Variations Table */}
              {viewProduct.flavor_prices && viewProduct.flavor_prices.length > 0 ? (
                <div>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: 14, fontWeight: 700, color: '#6366f1' }}>
                    Variations, Prices & Available Stock
                  </h4>
                  <div className="table-wrap">
                    <table style={{ width: '100%', fontSize: 12.5 }}>
                      <thead>
                        <tr>
                          <th>Variation</th>
                          <th>Barcode</th>
                          <th>Regular Price</th>
                          <th>Sale Price</th>
                          <th>Available Stock ({selectedStore ? stores.find(s => String(s.id) === String(selectedStore))?.name : 'Global'})</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewProduct.flavor_prices.map((fp, idx) => {
                          let label = formatAttributesLabel(fp.attributes);
                          if (!label && fp.flavor_id) {
                            const flavName = viewProduct.flavors?.find(f => Number(f.id) === Number(fp.flavor_id))?.name || `Flavor #${fp.flavor_id}`;
                            label = flavName;
                          }
                          if (!label) label = `Variation #${fp.id || idx + 1}`;

                          const flavorStockList = storeFlavorStock[viewProduct.id] || [];
                          const matchingItems = flavorStockList.filter(item => {
                            if (item.variation_id && fp.id && Number(item.variation_id) === Number(fp.id)) {
                              return true;
                            }
                            if (item.vari_attribute && fp.attributes) {
                              const itemAttrStr = typeof item.vari_attribute === 'string' ? item.vari_attribute.trim() : JSON.stringify(item.vari_attribute);
                              const fpAttrStr = typeof fp.attributes === 'string' ? fp.attributes.trim() : JSON.stringify(fp.attributes);
                              const fpAttrLabel = formatAttributesLabel(fp.attributes).trim();
                              if (itemAttrStr === fpAttrStr || itemAttrStr === fpAttrLabel) return true;
                              try {
                                const obj1 = typeof item.vari_attribute === 'string' ? JSON.parse(item.vari_attribute) : item.vari_attribute;
                                const obj2 = typeof fp.attributes === 'string' ? JSON.parse(fp.attributes) : fp.attributes;
                                if (obj1 && obj2 && JSON.stringify(obj1) === JSON.stringify(obj2)) return true;
                              } catch(e) {}
                            }
                            return false;
                          });
                          const fQty = matchingItems.reduce((s, it) => s + (parseInt(it.stock) || 0), 0);

                          const regPrice = fp.price !== undefined && fp.price !== null && fp.price !== '' ? parseFloat(fp.price) : (parseFloat(viewProduct.price) || 0);
                          const salePrice = fp.sale_price !== undefined && fp.sale_price !== null && fp.sale_price !== '' ? parseFloat(fp.sale_price) : null;

                          return (
                            <tr key={idx}>
                              <td><strong>{label}</strong></td>
                              <td><code style={{ fontSize: 11.5 }}>{fp.barcode || '—'}</code></td>
                              <td>₹{regPrice.toFixed(2)}</td>
                              <td>
                                {salePrice ? (
                                  <strong style={{ color: '#16a34a' }}>₹{salePrice.toFixed(2)}</strong>
                                ) : '—'}
                              </td>
                              <td>
                                <span className={`badge ${fQty > 10 ? 'badge-green' : fQty > 0 ? 'badge-amber' : 'badge-red'}`}>
                                  {fQty} in stock
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 24, padding: 14, background: 'var(--bg-base)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Regular Price</div>
                    <strong style={{ fontSize: 16 }}>₹{parseFloat(viewProduct.price || 0).toFixed(2)}</strong>
                  </div>
                  {viewProduct.sale_price && (
                    <div>
                      <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Sale Price</div>
                      <strong style={{ fontSize: 16, color: '#16a34a' }}>₹{parseFloat(viewProduct.sale_price).toFixed(2)}</strong>
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Available Stock</div>
                    <span className={`badge ${viewProduct.stock > 10 ? 'badge-green' : viewProduct.stock > 0 ? 'badge-amber' : 'badge-red'}`} style={{ marginTop: 2 }}>
                      {selectedStore ? (storeStock[viewProduct.id] ?? 0) : viewProduct.stock} in stock
                    </span>
                  </div>
                </div>
              )}

              {/* Tags */}
              {viewProduct.tags && viewProduct.tags.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>Tags</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {viewProduct.tags.map((t, idx) => (
                      <span key={idx} style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', borderRadius: 6, padding: '3px 10px', fontSize: 11.5, fontWeight: 600, border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              {viewProduct.description && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>Description</div>
                  <div
                    style={{ padding: 14, background: 'var(--bg-base)', borderRadius: 10, border: '1px solid var(--border)', fontSize: 13, lineHeight: 1.6 }}
                    dangerouslySetInnerHTML={{ __html: viewProduct.description }}
                  />
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setViewProduct(null)}>Close</button>
              {canEditProduct && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    const p = viewProduct;
                    setViewProduct(null);
                    router.push(`/products/edit/${p.id}`);
                  }}
                >
                  <EditIcon /> Edit Product
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </Layout>
  );
}
