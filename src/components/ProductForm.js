import { useState, useEffect, useRef, Fragment } from 'react';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import Layout from '@/components/Layout';
import SearchableSelect from '@/components/SearchableSelect';
import MultiSelect from '@/components/MultiSelect';
import RichTextEditor from '@/components/RichTextEditor';

const EMPTY_FORM = {
  name: '',
  sell_on_website: false,
  product_type: 'simple_product',
  category_ids: [],
  brand_ids: [],
  barcode: '',
  price: '',
  sale_price: '',
  description: '',
  image: '',
  slug: '',
  tags: [''],
  gallery: [],
  flavor_prices: [],
};

const LayersIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
    <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
    <polyline points="2 17 12 22 22 17"></polyline>
    <polyline points="2 12 12 17 22 12"></polyline>
  </svg>
);

const ZapIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
  </svg>
);

const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);

const ImageIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
    <circle cx="8.5" cy="8.5" r="1.5"></circle>
    <polyline points="21 15 16 10 5 21"></polyline>
  </svg>
);

const TrashIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
  </svg>
);

const ChevronDownIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
    <polyline points="6 9 12 15 18 9"></polyline>
  </svg>
);

const ChevronUpIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
    <polyline points="18 15 12 9 6 15"></polyline>
  </svg>
);

function slugify(text) {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function formatAttributesLabel(attributes) {
  if (!attributes) return '';
  if (typeof attributes === 'string') {
    try { attributes = JSON.parse(attributes); } catch (e) { return attributes; }
  }
  if (typeof attributes !== 'object' || attributes === null) return String(attributes);
  const parts = Object.entries(attributes)
    .filter(([_, v]) => v !== undefined && v !== null && String(v).trim() !== '')
    .map(([k, v]) => `${k}: ${v}`);
  return parts.join(', ') || 'Default Variation';
}

// Modern Tag Input component for variation option values
function TagInput({ value = '', onChange, onRemoveTag, placeholder = 'Type value and press Enter' }) {
  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef(null);

  const tags = String(value || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  function updateTags(newTags) {
    onChange(newTags.join(', '));
  }

  function addTagsFromInput(text) {
    if (!text || !text.trim()) return;
    const itemsToAdd = text
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    if (itemsToAdd.length === 0) return;

    const existingLower = new Set(tags.map(t => t.toLowerCase()));
    const uniqueToAdd = itemsToAdd.filter(item => !existingLower.has(item.toLowerCase()));

    if (uniqueToAdd.length > 0) {
      updateTags([...tags, ...uniqueToAdd]);
    }
    setInputValue('');
  }

  function removeTag(indexToRemove) {
    const tagToRemove = tags[indexToRemove];
    if (onRemoveTag) {
      const proceed = onRemoveTag(tagToRemove);
      if (proceed === false) return;
    }
    const updated = tags.filter((_, idx) => idx !== indexToRemove);
    updateTags(updated);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTagsFromInput(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      e.preventDefault();
      removeTag(tags.length - 1);
    }
  }

  function handleBlur() {
    setIsFocused(false);
    if (inputValue.trim()) {
      addTagsFromInput(inputValue);
    }
  }

  function handlePaste(e) {
    const pastedText = e.clipboardData?.getData('text');
    if (pastedText && pastedText.includes(',')) {
      e.preventDefault();
      addTagsFromInput(pastedText);
    }
  }

  return (
    <div
      ref={containerRef}
      onClick={() => containerRef.current?.querySelector('input')?.focus()}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 6,
        padding: '5px 8px',
        minHeight: 38,
        background: '#ffffff',
        border: `1px solid ${isFocused ? '#0284c7' : '#cbd5e1'}`,
        borderRadius: 6,
        boxShadow: isFocused ? '0 0 0 3px rgba(2, 132, 199, 0.15)' : 'none',
        transition: 'border-color .15s, box-shadow .15s',
        cursor: 'text',
      }}
    >
      {tags.map((tag, idx) => (
        <span
          key={`${tag}_${idx}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            background: '#e0f2fe',
            color: '#0369a1',
            border: '1px solid #bae6fd',
            borderRadius: 5,
            padding: '2px 8px',
            fontSize: 12,
            fontWeight: 600,
            lineHeight: 1.4,
          }}
        >
          <span>{tag}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              removeTag(idx);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#0284c7',
              cursor: 'pointer',
              padding: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 700,
              lineHeight: 1,
              marginLeft: 2,
              borderRadius: '50%',
              width: 14,
              height: 14,
            }}
            title="Remove"
          >
            ×
          </button>
        </span>
      ))}
      <input
        type="text"
        value={inputValue}
        onChange={e => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onFocus={() => setIsFocused(true)}
        onPaste={handlePaste}
        placeholder={tags.length === 0 ? placeholder : 'Add option value…'}
        style={{
          flex: 1,
          minWidth: 120,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontSize: 13,
          color: 'var(--text-base, #1e293b)',
          padding: '2px 0',
        }}
      />
    </div>
  );
}

function generateCartesianCombinations(configs) {
  const activeConfigs = (configs || []).filter(c => c.type && String(c.type).trim() && Array.isArray(c.values) && c.values.length > 0);
  if (activeConfigs.length === 0) return [];
  let combinations = [{}];
  for (const config of activeConfigs) {
    const typeName = String(config.type).trim();
    const nextCombos = [];
    for (const combo of combinations) {
      for (const val of config.values) {
        const strVal = String(val || '').trim();
        if (strVal) {
          nextCombos.push({ ...combo, [typeName]: strVal });
        }
      }
    }
    combinations = nextCombos;
  }
  return combinations.filter(c => Object.keys(c).length > 0);
}

function sortVariationsByWeight(variations) {
  return [...(variations || [])].sort((a, b) => {
    const attrA = a.attributes || {};
    const attrB = b.attributes || {};
    const weightA = attrA.Weight || attrA['Size / Weight'] || '';
    const weightB = attrB.Weight || attrB['Size / Weight'] || '';

    const numA = parseFloat(weightA);
    const numB = parseFloat(weightB);

    if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
      return numA - numB;
    }

    if (weightA && weightB && weightA !== weightB) {
      return String(weightA).localeCompare(String(weightB));
    }

    return JSON.stringify(attrA).localeCompare(JSON.stringify(attrB));
  });
}

function cleanPriceValue(val) {
  if (val === null || val === undefined || val === '' || val === 0 || val === '0' || val === '0.00' || val === '0.0' || Number(val) === 0) {
    return '';
  }
  return String(val);
}

export default function ProductForm({ productId }) {
  const router = useRouter();
  const isEdit = Boolean(productId);

  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);

  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [masterVariationTypes, setMasterVariationTypes] = useState(['Flavor', 'Weight', 'Strength']);
  const [variationConfigs, setVariationConfigs] = useState([{ type: 'Flavor', valuesStr: '' }]);

  const [showAddMasterType, setShowAddMasterType] = useState(false);
  const [newMasterTypeName, setNewMasterTypeName] = useState('');

  const [showAddCat, setShowAddCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [addingCat, setAddingCat] = useState(false);

  const [showAddBrand, setShowAddBrand] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [addingBrand, setAddingBrand] = useState(false);

  // Manual variation modal states
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualAttrValues, setManualAttrValues] = useState({});
  const [manualPrice, setManualPrice] = useState('');
  const [manualSalePrice, setManualSalePrice] = useState('');
  const [manualBarcode, setManualBarcode] = useState('');

  // Expandable variation rows state
  const [expandedRows, setExpandedRows] = useState({});

  function toggleExpandRow(varId) {
    setExpandedRows(prev => ({ ...prev, [varId]: !prev[varId] }));
  }

  function handleVariationImageUpload(varId, file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setForm(f => ({
        ...f,
        flavor_prices: (f.flavor_prices || []).map(item => item.id === varId ? { ...item, image: event.target.result } : item)
      }));
    };
    reader.readAsDataURL(file);
  }

  function handleVariationGalleryUpload(varId, files) {
    const fileList = Array.from(files || []);
    fileList.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setForm(f => ({
          ...f,
          flavor_prices: (f.flavor_prices || []).map(item => {
            if (item.id !== varId) return item;
            const gal = item.gallery || [];
            return { ...item, gallery: [...gal, event.target.result] };
          })
        }));
      };
      reader.readAsDataURL(file);
    });
  }

  function removeVariationGalleryItem(varId, galIdx) {
    setForm(f => ({
      ...f,
      flavor_prices: (f.flavor_prices || []).map(item => {
        if (item.id !== varId) return item;
        const gal = item.gallery || [];
        return { ...item, gallery: gal.filter((_, gI) => gI !== galIdx) };
      })
    }));
  }

  // Load master data (categories, brands, master variation types)
  async function loadMasterData() {
    try {
      const [c, b, vt] = await Promise.all([
        fetch('/api/categories').then(r => r.json()).catch(() => []),
        fetch('/api/brands').then(r => r.json()).catch(() => []),
        fetch('/api/variation-types').then(r => r.json()).catch(() => []),
      ]);
      setCategories(Array.isArray(c) ? c : []);
      setBrands(Array.isArray(b) ? b : []);

      if (Array.isArray(vt) && vt.length > 0) {
        const typeNames = vt.map(d => d.name).filter(Boolean);
        setMasterVariationTypes(Array.from(new Set(typeNames.length > 0 ? typeNames : ['Flavor', 'Weight', 'Strength'])));
      }
    } catch (e) {
      console.error(e);
    }
  }

  // Load product if in edit mode
  async function loadProduct(targetId) {
    const idToUse = targetId || productId;
    if (!idToUse || idToUse === 'id' || idToUse === 'undefined' || idToUse === 'null' || idToUse === 'new') {
      setLoading(false);
      return;
    }
    const numericId = parseInt(idToUse, 10);
    if (isNaN(numericId)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/products/${numericId}`);
      if (!res.ok) {
        toast.error('Product not found.');
        router.push('/products');
        return;
      }
      const p = await res.json();

      const fpList = (p.flavor_prices || []).map((fp, idx) => ({
        id: fp.id || `var_${idx}_${Date.now()}`,
        attributes: fp.attributes || {},
        barcode: fp.barcode || '',
        price: cleanPriceValue(fp.price),
        sale_price: cleanPriceValue(fp.sale_price),
        image: fp.image || '',
        gallery: fp.gallery || [],
        isNew: false,
      }));

      // Extract or restore variation configs for configurator UI
      let configsArray = [];
      if (Array.isArray(p.product_attributes) && p.product_attributes.length > 0) {
        configsArray = p.product_attributes.map(attr => ({
          type: attr.type || '',
          valuesStr: Array.isArray(attr.values) ? attr.values.join(', ') : (attr.valuesStr || '')
        }));
      } else if (p.product_attributes && typeof p.product_attributes === 'object') {
        configsArray = Object.entries(p.product_attributes).map(([type, vals]) => ({
          type,
          valuesStr: Array.isArray(vals) ? vals.join(', ') : String(vals || '')
        }));
      }

      // Merge any attribute values present in fpList into configsArray
      const mergedMap = {};
      configsArray.forEach(cfg => {
        const t = (cfg.type || '').trim();
        if (t) {
          if (!mergedMap[t]) mergedMap[t] = [];
          const vals = (cfg.valuesStr || '').split(',').map(s => s.trim()).filter(Boolean);
          vals.forEach(v => {
            if (!mergedMap[t].some(x => x.toLowerCase() === v.toLowerCase())) {
              mergedMap[t].push(v);
            }
          });
        }
      });

      fpList.forEach(fp => {
        if (fp.attributes && typeof fp.attributes === 'object') {
          Object.entries(fp.attributes).forEach(([t, val]) => {
            const trimmedT = (t || '').trim();
            const trimmedV = (val || '').trim();
            if (trimmedT && trimmedV) {
              if (!mergedMap[trimmedT]) mergedMap[trimmedT] = [];
              if (!mergedMap[trimmedT].some(x => x.toLowerCase() === trimmedV.toLowerCase())) {
                mergedMap[trimmedT].push(trimmedV);
              }
            }
          });
        }
      });

      configsArray = Object.entries(mergedMap).map(([type, vals]) => ({
        type,
        valuesStr: vals.join(', ')
      }));

      if (configsArray.length === 0) {
        configsArray.push({ type: masterVariationTypes[0] || 'Weight', valuesStr: '' });
      }

      setVariationConfigs(configsArray);

      setForm({
        name: p.name || '',
        sell_on_website: p.sell_on_website !== undefined && p.sell_on_website !== null ? Boolean(Number(p.sell_on_website)) : false,
        product_type: (fpList.length > 0 || p.product_type === 'variable_product') ? 'variable_product' : 'simple_product',
        category_ids: (p.categories || []).map(c => String(c.id)),
        brand_ids: (p.brands && p.brands.length > 0) ? [String(p.brands[0].id)] : [],
        barcode: p.barcode || '',
        price: cleanPriceValue(p.price),
        sale_price: cleanPriceValue(p.sale_price),
        description: p.description || '',
        image: p.image || '',
        slug: p.slug || '',
        tags: p.tags && p.tags.length > 0 ? p.tags : [''],
        gallery: p.gallery || [],
        flavor_prices: sortVariationsByWeight(fpList),
      });
      setSlugTouched(true);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load product details.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMasterData();
  }, []);

  useEffect(() => {
    if (productId) {
      loadProduct();
    }
  }, [productId]);

  // Name change auto slug logic
  function handleNameChange(val) {
    setForm(f => {
      const next = { ...f, name: val };
      if (!slugTouched) {
        next.slug = slugify(val);
      }
      return next;
    });
  }

  // Categories & Brands inline handlers
  async function handleAddCat() {
    if (!newCatName.trim()) return;
    setAddingCat(true);
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCatName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.message || 'Failed'); setAddingCat(false); return; }
      toast.success(`Category "${newCatName}" created.`);
      const catsRes = await fetch('/api/categories').then(r => r.json());
      setCategories(catsRes);
      setForm(f => ({ ...f, category_ids: [...f.category_ids, String(data.id)] }));
      setNewCatName(''); setShowAddCat(false);
    } catch (e) {
      toast.error('Failed to create category');
    } finally {
      setAddingCat(false);
    }
  }

  async function handleAddBrand() {
    if (!newBrandName.trim()) return;
    setAddingBrand(true);
    try {
      const res = await fetch('/api/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newBrandName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.message || 'Failed'); setAddingBrand(false); return; }
      toast.success(`Brand "${newBrandName}" created.`);
      const brandsRes = await fetch('/api/brands').then(r => r.json());
      setBrands(brandsRes);
      setForm(f => ({ ...f, brand_ids: [String(data.id)] }));
      setNewBrandName(''); setShowAddBrand(false);
    } catch (e) {
      toast.error('Failed to create brand');
    } finally {
      setAddingBrand(false);
    }
  }

  // Variation handlers
  async function handleAddMasterTypeSubmit() {
    const trimmed = newMasterTypeName.trim();
    if (!trimmed) return;
    if (!masterVariationTypes.includes(trimmed)) {
      setMasterVariationTypes(prev => [...prev, trimmed]);
      try {
        const res = await fetch('/api/variation-types', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: trimmed })
        });
        if (res.ok) {
          toast.success(`Variation type "${trimmed}" added.`);
        } else {
          const data = await res.json().catch(() => null);
          toast.error(data?.message || 'Failed to save variation type.');
        }
      } catch (e) {
        console.error(e);
        toast.error('Failed to save variation type.');
      }
    }
    setNewMasterTypeName('');
    setShowAddMasterType(false);
  }

  function handleGenerateVariations() {
    const parsedConfigs = variationConfigs.map(c => ({
      type: (c.type || '').trim(),
      values: (c.valuesStr || '').split(',').map(s => s.trim()).filter(Boolean)
    })).filter(c => c.type && c.values.length > 0);

    if (parsedConfigs.length === 0) {
      toast.error('Please configure at least one variation type with option values (e.g. Flavor: Chocolate, Vanilla).');
      return;
    }

    const cartesianCombos = generateCartesianCombinations(parsedConfigs);
    if (cartesianCombos.length === 0) {
      toast.error('No valid variation combinations could be generated.');
      return;
    }

    const existingMap = new Map();
    (form.flavor_prices || []).forEach(fp => {
      const key = JSON.stringify(fp.attributes || {});
      existingMap.set(key, fp);
    });

    const newRows = cartesianCombos.map((attributes, idx) => {
      const key = JSON.stringify(attributes);
      const existing = existingMap.get(key);
      if (existing) return existing;
      return {
        id: `var_${idx}_${Date.now()}`,
        attributes,
        barcode: form.barcode || '',
        price: cleanPriceValue(form.price),
        sale_price: cleanPriceValue(form.sale_price),
        image: '',
        gallery: [],
        isNew: true,
      };
    });

    const sortedNewRows = sortVariationsByWeight(newRows);
    setForm(f => ({ ...f, flavor_prices: sortedNewRows, product_type: 'variable_product' }));
    toast.success(`Generated ${newRows.length} variation combinations.`);
  }

  function handleRemoveOptionTag(cfg, tagToRemove) {
    const typeName = (cfg.type || '').trim();
    if (!typeName || !tagToRemove) return true;

    const affected = (form.flavor_prices || []).filter(fp => {
      const attrVal = fp.attributes?.[typeName];
      return attrVal && String(attrVal).trim().toLowerCase() === String(tagToRemove).trim().toLowerCase();
    });

    if (affected.length > 0) {
      const confirmed = window.confirm(
        `Removing option value "${tagToRemove}" will also remove ${affected.length} related variation combination(s) from the matrix below.\n\nDo you want to proceed?`
      );
      if (!confirmed) return false;

      setForm(f => ({
        ...f,
        flavor_prices: (f.flavor_prices || []).filter(fp => {
          const attrVal = fp.attributes?.[typeName];
          return !attrVal || String(attrVal).trim().toLowerCase() !== String(tagToRemove).trim().toLowerCase();
        })
      }));
      toast.success(`Removed "${tagToRemove}" and ${affected.length} related variation combination(s).`);
    }
    return true;
  }

  function handleRemoveDimensionRow(idx) {
    const cfg = variationConfigs[idx];
    if (!cfg) return;

    const typeName = (cfg.type || '').trim();
    const affected = (form.flavor_prices || []).filter(fp => Boolean(fp.attributes?.[typeName]));

    if (affected.length > 0) {
      const confirmed = window.confirm(
        `Removing variation dimension "${typeName}" will also remove ${affected.length} related variation combination(s) from the matrix below.\n\nDo you want to proceed?`
      );
      if (!confirmed) return;

      setForm(f => ({
        ...f,
        flavor_prices: (f.flavor_prices || []).filter(fp => !fp.attributes?.[typeName])
      }));
      toast.success(`Removed "${typeName}" dimension and related variation combination(s).`);
    }

    setVariationConfigs(list => list.filter((_, i) => i !== idx));
  }

  // Manual Variation Handlers
  function openManualModal() {
    const initial = {};
    variationConfigs.forEach(c => {
      if (c.type) {
        const firstVal = (c.valuesStr || '').split(',').map(s => s.trim()).filter(Boolean)[0] || '';
        initial[c.type.trim()] = firstVal;
      }
    });
    setManualAttrValues(initial);
    setManualPrice(cleanPriceValue(form.price));
    setManualSalePrice(cleanPriceValue(form.sale_price));
    setManualBarcode('');
    setShowManualModal(true);
  }

  function handleAddManualVariationSubmit(e) {
    if (e) e.preventDefault();

    const cleanAttrValues = {};
    Object.entries(manualAttrValues || {}).forEach(([k, v]) => {
      const trimmedK = (k || '').trim();
      const trimmedV = (v || '').trim();
      if (trimmedK && trimmedV) {
        cleanAttrValues[trimmedK] = trimmedV;
      }
    });

    if (Object.keys(cleanAttrValues).length === 0) {
      toast.error('Please specify at least one attribute value.');
      return;
    }

    const key = JSON.stringify(cleanAttrValues);
    const exists = (form.flavor_prices || []).some(fp => JSON.stringify(fp.attributes || {}) === key);
    if (exists) {
      toast.error('This exact variation combination already exists in the table.');
      return;
    }

    if (manualBarcode && manualBarcode.trim()) {
      const code = manualBarcode.trim().toLowerCase();
      if (form.barcode && form.barcode.trim().toLowerCase() === code) {
        toast.error(`Barcode "${manualBarcode.trim()}" is already used for the main product barcode.`);
        return;
      }
      const dupFp = (form.flavor_prices || []).find(fp => fp.barcode && fp.barcode.trim().toLowerCase() === code);
      if (dupFp) {
        const attrLabel = formatAttributesLabel(dupFp.attributes);
        toast.error(`Barcode "${manualBarcode.trim()}" is already used by variation (${attrLabel || 'existing variation'}).`);
        return;
      }
    }

    const newRow = {
      id: `manual_${Date.now()}`,
      attributes: cleanAttrValues,
      price: cleanPriceValue(manualPrice),
      sale_price: cleanPriceValue(manualSalePrice),
      barcode: manualBarcode ? manualBarcode.trim() : '',
      image: '',
      gallery: [],
      isNew: true,
    };

    setForm(f => ({
      ...f,
      flavor_prices: [...(f.flavor_prices || []), newRow],
      product_type: 'variable_product'
    }));

    // Automatically sync new attribute values to Section 1 (variationConfigs / Option Values)
    setVariationConfigs(prevConfigs => {
      const updatedConfigs = prevConfigs.map(c => ({ ...c }));

      Object.entries(cleanAttrValues).forEach(([typeName, val]) => {
        const configIdx = updatedConfigs.findIndex(c => (c.type || '').trim().toLowerCase() === typeName.toLowerCase());

        if (configIdx >= 0) {
          const cfg = updatedConfigs[configIdx];
          const existingTags = (cfg.valuesStr || '').split(',').map(s => s.trim()).filter(Boolean);
          const hasTag = existingTags.some(t => t.toLowerCase() === val.toLowerCase());
          if (!hasTag) {
            const newTags = [...existingTags, val];
            updatedConfigs[configIdx] = {
              ...cfg,
              valuesStr: newTags.join(', ')
            };
          }
        } else {
          updatedConfigs.push({
            type: typeName,
            valuesStr: val
          });
        }
      });

      return updatedConfigs;
    });

    toast.success('Manual variation added.');
    setShowManualModal(false);
  }

  // Image Upload Handlers
  function handleMainImageFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setForm(f => ({ ...f, image: event.target.result }));
    };
    reader.readAsDataURL(file);
  }

  function handleGalleryFileUpload(e) {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setForm(f => ({ ...f, gallery: [...(f.gallery || []), event.target.result] }));
      };
      reader.readAsDataURL(file);
    });
  }

  function removeGalleryItem(index) {
    setForm(f => ({
      ...f,
      gallery: (f.gallery || []).filter((_, i) => i !== index)
    }));
  }

  // Save Product
  async function handleSave(e) {
    if (e) e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Product name is required.');
      return;
    }

    const isVariable = form.product_type === 'variable_product' || (form.flavor_prices || []).length > 0;
    let flavorPricesPayload = [];

    if (isVariable) {
      flavorPricesPayload = (form.flavor_prices || []).map(fp => {
        return {
          attributes: fp.attributes || {},
          barcode: fp.barcode ? fp.barcode.trim() : null,
          price: fp.price !== undefined && fp.price !== '' ? parseFloat(fp.price) : (parseFloat(form.price) || 0),
          sale_price: fp.sale_price !== undefined && fp.sale_price !== '' ? parseFloat(fp.sale_price) : (form.sale_price ? parseFloat(form.sale_price) : null),
          image: fp.image || '',
          gallery: fp.gallery || [],
        };
      });
    }

    // Client-side barcode duplication check within form itself
    const formBarcodes = [];
    if (form.barcode && form.barcode.trim()) {
      formBarcodes.push({ source: 'Main Product Barcode', code: form.barcode.trim() });
    }
    (flavorPricesPayload || []).forEach((fp, idx) => {
      if (fp.barcode && fp.barcode.trim()) {
        const code = fp.barcode.trim();
        const label = formatAttributesLabel(fp.attributes) || `Variation #${idx + 1}`;
        formBarcodes.push({ source: `Variation (${label})`, code });
      }
    });

    const seenBarcodes = {};
    for (const b of formBarcodes) {
      const lower = b.code.toLowerCase();
      if (seenBarcodes[lower]) {
        toast.error(`Duplicate barcode "${b.code}" found in form (${seenBarcodes[lower]} and ${b.source}). Barcodes must be unique.`);
        return;
      }
      seenBarcodes[lower] = b.source;
    }

    setSaving(true);
    try {

      const parsedProductAttributes = variationConfigs
        .map(c => ({
          type: (c.type || '').trim(),
          values: (c.valuesStr || '').split(',').map(s => s.trim()).filter(Boolean)
        }))
        .filter(c => c.type && c.values.length > 0);

      const payload = {
        ...form,
        sell_on_website: Boolean(form.sell_on_website),
        product_type: isVariable ? 'variable_product' : 'simple_product',
        flavor_prices: flavorPricesPayload,
        product_attributes: isVariable ? parsedProductAttributes : null,
        price: parseFloat(form.price) || 0,
        sale_price: form.sale_price ? parseFloat(form.sale_price) : null,
      };

      const url = isEdit ? `/api/products/${productId}` : '/api/products';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        toast.error(data?.message || 'Failed to save product.');
        setSaving(false);
        return;
      }

      toast.success(isEdit ? 'Product updated successfully!' : 'Product created successfully!');

      if (!isEdit && data?.id) {
        router.replace(`/products/edit/${data.id}`);
        await loadProduct(data.id);
      } else {
        await loadProduct();
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to save product.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Layout>
        <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
          <div className="spinner" style={{ margin: '0 auto 12px auto' }}></div>
          Loading product details…
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div style={{ width: '100%', paddingBottom: 60 }}>

        {/* TOP BAR / NAVIGATION */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <button
              type="button"
              onClick={() => router.push('/products')}
              style={{ background: 'none', border: 'none', color: 'var(--primary, #2563eb)', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: 0, marginBottom: 4 }}
            >
              ← Back to Products
            </button>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: 'var(--text-base)' }}>
              {isEdit ? `Edit Product: ${form.name}` : 'Add New Product'}
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => router.push('/products')}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving}
              style={{ minWidth: 120 }}
            >
              {saving ? (isEdit ? 'Updating…' : 'Saving…') : (isEdit ? 'Update Product' : 'Publish Product')}
            </button>
          </div>
        </div>

        {/* 2-COLUMN GRID LAYOUT (Main Content Left, Right Sidebar Right) */}
        <form onSubmit={handleSave} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 24, alignItems: 'start' }}>

          {/* LEFT MAIN COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* CARD 1: GENERAL INFORMATION */}
            <div style={{ background: 'var(--bg-card, #ffffff)', padding: 22, borderRadius: 12, border: '1px solid var(--border, #e2e8f0)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px 0', borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                General Information
              </h3>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label style={{ fontWeight: 600 }}>Product Title / Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => handleNameChange(e.target.value)}
                  placeholder="e.g. A4 Spiral Notebook 200 Pages"
                  required
                  style={{ width: '100%', fontSize: 15, padding: '10px 12px' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label style={{ fontWeight: 600 }}>Slug (URL Fragment)</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    value={form.slug}
                    onChange={e => { setSlugTouched(true); setForm({ ...form, slug: e.target.value }); }}
                    placeholder="e.g. a4-spiral-notebook-200-pages"
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setForm(f => ({ ...f, slug: slugify(f.name) }))}
                  >
                    Auto Generate
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontWeight: 600 }}>Description</label>
                <RichTextEditor
                  value={form.description}
                  onChange={html => setForm({ ...form, description: html })}
                  placeholder="Detailed product description, specifications, features..."
                />
              </div>
            </div>

            {/* CARD 2: PRODUCT TYPE & PRICING / VARIATIONS */}
            <div style={{ background: 'var(--bg-card, #ffffff)', padding: 22, borderRadius: 12, border: '1px solid var(--border, #e2e8f0)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px 0', borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                Product Type & Pricing
              </h3>

              <div className="form-group" style={{ marginBottom: 20 }}>
                <label style={{ fontWeight: 600 }}>Product Type</label>
                <select
                  value={form.product_type}
                  onChange={e => setForm({ ...form, product_type: e.target.value })}
                  style={{ width: '100%', fontSize: 14, padding: '9px 12px' }}
                >
                  <option value="simple_product">Simple Product (Single price & barcode)</option>
                  <option value="variable_product">Variable Product (Multiple variations: Size, Flavor, Strength, etc.)</option>
                </select>
              </div>

              {/* SIMPLE PRODUCT PRICING & BARCODE */}
              {form.product_type === 'simple_product' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, background: '#f8fafc', padding: 16, borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div className="form-group">
                    <label style={{ fontWeight: 600 }}>Default Price (₹) *</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={cleanPriceValue(form.price)}
                      onChange={e => setForm({ ...form, price: e.target.value })}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ fontWeight: 600 }}>Sale Price (₹)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={cleanPriceValue(form.sale_price)}
                      onChange={e => setForm({ ...form, sale_price: e.target.value })}
                      placeholder="Optional sale price…"
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ fontWeight: 600 }}>Default Barcode</label>
                    <input
                      value={form.barcode}
                      onChange={e => setForm({ ...form, barcode: e.target.value })}
                      placeholder="e.g. 1234567890"
                    />
                  </div>
                </div>
              )}

              {/* STEP 1: VARIATION ATTRIBUTES BUILDER CARD */}
              {form.product_type === 'variable_product' && (
                <div style={{ background: '#f0f9ff', padding: 20, borderRadius: 12, border: '1px solid #bae6fd', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h4 style={{ fontSize: 15, fontWeight: 700, color: '#0369a1', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <LayersIcon /> 1. Define Variation Attributes
                      </h4>
                      <p style={{ margin: '2px 0 0 0', fontSize: 12, color: '#0284c7' }}>
                        Specify attribute types (e.g. Size, Flavor, Strength) and comma-separated option values.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary btn-xs"
                      onClick={() => setShowAddMasterType(v => !v)}
                      style={{ background: '#fff', borderColor: '#93c5fd', color: '#0369a1' }}
                    >
                      + Add New Master Type
                    </button>
                  </div>

                  {showAddMasterType && (
                    <div style={{ display: 'flex', gap: 6, background: '#fff', padding: 10, borderRadius: 8, border: '1px solid #93c5fd', boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
                      <input
                        value={newMasterTypeName}
                        onChange={e => setNewMasterTypeName(e.target.value)}
                        placeholder="e.g. Color, Material, Pack Size…"
                        style={{ flex: 1, fontSize: 13 }}
                      />
                      <button type="button" className="btn btn-primary btn-sm" onClick={handleAddMasterTypeSubmit}>Add Type</button>
                    </div>
                  )}

                  {/* Variation Config Rows */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {variationConfigs.map((cfg, idx) => (
                      <div key={idx} style={{ display: 'grid', gridTemplateColumns: '200px 1fr 36px', gap: 12, alignItems: 'center', background: '#fff', padding: 12, borderRadius: 8, border: '1px solid #e0f2fe', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                        <div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 3 }}>Variation Type</span>
                          <select
                            value={cfg.type}
                            onChange={e => {
                              const val = e.target.value;
                              setVariationConfigs(list => list.map((c, i) => i === idx ? { ...c, type: val } : c));
                            }}
                            style={{ width: '100%', fontSize: 13, padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                          >
                            {masterVariationTypes.map(t => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 3 }}>Option Values (Press Enter or comma to add)</span>
                          <TagInput
                            value={cfg.valuesStr}
                            onChange={newStr => {
                              setVariationConfigs(list => list.map((c, i) => i === idx ? { ...c, valuesStr: newStr } : c));
                            }}
                            onRemoveTag={tagToRemove => handleRemoveOptionTag(cfg, tagToRemove)}
                            placeholder="Type value (e.g. Blue, Pack of 5, A4) and press Enter"
                          />
                        </div>

                        {variationConfigs.length > 1 && (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 14 }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-xs"
                              onClick={() => handleRemoveDimensionRow(idx)}
                              style={{
                                color: '#ef4444',
                                borderColor: '#fca5a5',
                                background: '#fff',
                                width: 32,
                                height: 32,
                                borderRadius: 6,
                                padding: 0,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer'
                              }}
                              title="Remove Attribute Dimension"
                            >
                              <TrashIcon />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setVariationConfigs(list => [...list, { type: masterVariationTypes[0] || 'Weight', valuesStr: '' }])}
                      style={{ background: '#fff' }}
                    >
                      <PlusIcon /> Add Attribute Dimension
                    </button>


                  </div>
                </div>
              )}

              {/* STEP 2: GENERATED VARIATION COMBINATIONS MATRIX CARD */}
              {form.product_type === 'variable_product' && (
                <div style={{ background: 'var(--bg-card, #ffffff)', padding: 22, borderRadius: 12, border: '1px solid var(--border, #e2e8f0)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginTop: "30px" }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 10, flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-base)' }}>
                        2. Variation Pricing & Barcodes
                      </h3>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        Set custom price, sale price, and barcode for each generated variation combination.
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={handleGenerateVariations}
                        style={{ background: '#0284c7', borderColor: '#0284c7', color: '#fff', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px' }}
                      >
                        <ZapIcon /> Generate All Variations
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={openManualModal}
                        style={{ background: '#fff', borderColor: '#0284c7', color: '#0369a1', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px' }}
                      >
                        <PlusIcon /> Add Manual Variation
                      </button>
                      {(form.flavor_prices || []).length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#0369a1', background: '#e0f2fe', padding: '4px 10px', borderRadius: 20 }}>
                            {form.flavor_prices.length} {form.flavor_prices.length === 1 ? 'Combination' : 'Combinations'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {(form.flavor_prices || []).length > 0 ? (
                    <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10, background: '#fff' }}>
                      <table className="table" style={{ margin: 0, fontSize: 13, borderCollapse: 'collapse', width: '100%' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc' }}>
                            <th style={{ padding: '10px 14px' }}>Combination Attributes</th>
                            <th style={{ width: 140, padding: '10px 14px' }}>Price (₹) *</th>
                            <th style={{ width: 140, padding: '10px 14px' }}>Sale Price (₹)</th>
                            <th style={{ width: 160, padding: '10px 14px' }}>Barcode</th>
                            <th style={{ width: 80, textAlign: 'center', padding: '10px 14px' }}>Details</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortVariationsByWeight(form.flavor_prices).map((fp, idx) => {
                            const isExpanded = Boolean(expandedRows[fp.id]);
                            const isUnsaved = Boolean(
                              fp.isNew ||
                              !fp.id ||
                              (typeof fp.id === 'string' && (fp.id.startsWith('var_') || fp.id.startsWith('manual_')))
                            );

                            const rowBg = isUnsaved
                              ? (isExpanded ? '#fef3c7' : '#fffbeb')
                              : (isExpanded ? '#f0f9ff' : '#ffffff');
                            const borderLeftStyle = isUnsaved
                              ? '4px solid #f59e0b'
                              : (isExpanded ? '4px solid #0284c7' : '4px solid transparent');

                            return (
                              <Fragment key={fp.id || idx}>
                                <tr style={{
                                  borderBottom: isExpanded ? 'none' : '1px solid #e2e8f0',
                                  background: rowBg,
                                  borderLeft: borderLeftStyle,
                                  transition: 'background-color .15s',
                                }}>
                                  <td style={{ fontWeight: 600, color: '#0f172a', padding: '12px 14px' }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                      {fp.image && (
                                        <img src={fp.image} alt="" style={{ width: 34, height: 34, borderRadius: 6, objectFit: 'cover', border: '1px solid #cbd5e1', flexShrink: 0, marginTop: 2 }} />
                                      )}
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                          <span style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a', lineHeight: 1.3 }}>
                                            {form.name || 'Product Name'}
                                          </span>
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
                                          {Object.entries(fp.attributes || {}).map(([key, val]) => (
                                            val ? (
                                              <span key={key} style={{ fontSize: 11.5, fontWeight: 600, color: '#334155', background: isUnsaved ? '#ffffff' : '#f8fafc', border: `1px solid ${isUnsaved ? '#fde68a' : '#e2e8f0'}`, padding: '2px 8px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                                <span style={{ color: '#0284c7', fontWeight: 700 }}>{key}:</span>
                                                <span>{val}</span>
                                              </span>
                                            ) : null
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td style={{ padding: '8px 14px' }}>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={cleanPriceValue(fp.price)}
                                      onChange={e => {
                                        const val = e.target.value;
                                        setForm(f => ({
                                          ...f,
                                          flavor_prices: (f.flavor_prices || []).map(item => item.id === fp.id ? { ...item, price: val } : item)
                                        }));
                                      }}
                                      placeholder="0.00"
                                      style={{ width: '100%', padding: '6px 10px', fontSize: 13, borderRadius: 6 }}
                                      required
                                    />
                                  </td>
                                  <td style={{ padding: '8px 14px' }}>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={cleanPriceValue(fp.sale_price)}
                                      onChange={e => {
                                        const val = e.target.value;
                                        setForm(f => ({
                                          ...f,
                                          flavor_prices: (f.flavor_prices || []).map(item => item.id === fp.id ? { ...item, sale_price: val } : item)
                                        }));
                                      }}
                                      placeholder="Sale price"
                                      style={{ width: '100%', padding: '6px 10px', fontSize: 13, borderRadius: 6 }}
                                    />
                                  </td>
                                  <td style={{ padding: '8px 14px' }}>
                                    <input
                                      value={fp.barcode}
                                      onChange={e => {
                                        const val = e.target.value;
                                        setForm(f => ({
                                          ...f,
                                          flavor_prices: (f.flavor_prices || []).map(item => item.id === fp.id ? { ...item, barcode: val } : item)
                                        }));
                                      }}
                                      placeholder="Barcode"
                                      style={{ width: '100%', padding: '6px 10px', fontSize: 13, borderRadius: 6 }}
                                    />
                                  </td>
                                  <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '8px 14px' }}>
                                    <button
                                      type="button"
                                      className="btn btn-secondary btn-xs"
                                      onClick={() => toggleExpandRow(fp.id)}
                                      style={{
                                        background: isExpanded ? '#0284c7' : '#fff',
                                        borderColor: '#0284c7',
                                        color: isExpanded ? '#fff' : '#0284c7',
                                        fontWeight: 600,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: 30,
                                        height: 30,
                                        borderRadius: 6,
                                        padding: 0,
                                        margin: '0 auto',
                                        cursor: 'pointer'
                                      }}
                                      title={isExpanded ? 'Collapse variation details' : 'Expand variation details (Images, Prices)'}
                                    >
                                      {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
                                    </button>
                                  </td>
                                </tr>

                                {/* EXPANDED VARIATION DRAWER */}
                                {isExpanded && (
                                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                    <td colSpan={5} style={{ padding: 16 }}>
                                      <div style={{ background: '#ffffff', borderRadius: 10, padding: 18, border: '1px solid #cbd5e1', boxShadow: '0 2px 6px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: 16 }}>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: 10 }}>
                                          <div>
                                            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                                              Variation Options: {formatAttributesLabel(fp.attributes)}
                                            </h4>
                                            <span style={{ fontSize: 11, color: '#64748b' }}>
                                              Configure main image, gallery images, and prices for this specific variation.
                                            </span>
                                          </div>
                                        </div>

                                        {/* IMAGES GRID */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

                                          {/* VARIATION FEATURED IMAGE */}
                                          <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                                            <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 8, color: '#334155' }}>
                                              Variation Product Image
                                            </label>
                                            {fp.image ? (
                                              <div style={{ position: 'relative', width: 90, height: 90, borderRadius: 8, overflow: 'hidden', border: '1px solid #cbd5e1' }}>
                                                <img src={fp.image} alt="Variation image" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                <button
                                                  type="button"
                                                  onClick={() => setForm(f => ({
                                                    ...f,
                                                    flavor_prices: (f.flavor_prices || []).map(item => item.id === fp.id ? { ...item, image: '' } : item)
                                                  }))}
                                                  style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(239,68,68,0.9)', color: '#fff', border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                  title="Remove image"
                                                >
                                                  ✕
                                                </button>
                                              </div>
                                            ) : (
                                              <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16, border: '2px dashed #cbd5e1', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>
                                                <ImageIcon />
                                                <span style={{ fontSize: 12, color: '#0284c7', fontWeight: 600, marginTop: 4 }}>Upload Image</span>
                                                <input
                                                  type="file"
                                                  accept="image/*"
                                                  onChange={e => handleVariationImageUpload(fp.id, e.target.files?.[0])}
                                                  style={{ display: 'none' }}
                                                />
                                              </label>
                                            )}
                                          </div>

                                          {/* VARIATION GALLERY IMAGES */}
                                          <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                                            <label style={{ fontWeight: 600, fontSize: 13, display: 'block', marginBottom: 8, color: '#334155' }}>
                                              Variation Gallery Images
                                            </label>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                                              {(fp.gallery || []).map((gImg, gIdx) => (
                                                <div key={gIdx} style={{ position: 'relative', width: 54, height: 54, borderRadius: 6, overflow: 'hidden', border: '1px solid #cbd5e1' }}>
                                                  <img src={gImg} alt="Gallery" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                  <button
                                                    type="button"
                                                    onClick={() => removeVariationGalleryItem(fp.id, gIdx)}
                                                    style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(239,68,68,0.9)', color: '#fff', border: 'none', borderRadius: '50%', width: 18, height: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}
                                                  >
                                                    ✕
                                                  </button>
                                                </div>
                                              ))}
                                              <label style={{ width: 54, height: 54, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '2px dashed #cbd5e1', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>
                                                <span style={{ fontSize: 16, color: '#0284c7', lineHeight: 1, fontWeight: 700 }}>+</span>
                                                <span style={{ fontSize: 10, color: '#0284c7' }}>Add</span>
                                                <input
                                                  type="file"
                                                  accept="image/*"
                                                  multiple
                                                  onChange={e => handleVariationGalleryUpload(fp.id, e.target.files)}
                                                  style={{ display: 'none' }}
                                                />
                                              </label>
                                            </div>
                                          </div>
                                        </div>

                                        {/* EXPANDED DRAWER FOOTER */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: 10 }}>
                                          <button
                                            type="button"
                                            className="btn btn-secondary btn-xs"
                                            onClick={() => {
                                              setForm(f => ({ ...f, flavor_prices: (f.flavor_prices || []).filter(item => item.id !== fp.id) }));
                                              toggleExpandRow(fp.id);
                                            }}
                                            style={{ color: '#ef4444', borderColor: '#fca5a5', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                          >
                                            <TrashIcon /> Delete Variation
                                          </button>

                                          <button
                                            type="button"
                                            className="btn btn-secondary btn-xs"
                                            onClick={() => toggleExpandRow(fp.id)}
                                            style={{ color: '#0284c7', borderColor: '#93c5fd' }}
                                          >
                                            Close Details ▲
                                          </button>
                                        </div>

                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: 24, background: '#f8fafc', borderRadius: 10, border: '1px dashed var(--border)', color: '#64748b', fontSize: 13 }}>
                      <p style={{ margin: '0 0 12px 0' }}>⚡ No variation combinations generated yet.</p>
                      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={openManualModal}
                        >
                          + Add Manual Variation
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={handleGenerateVariations}
                          style={{ background: '#0284c7', borderColor: '#0284c7' }}
                        >
                          ⚡ Generate Combination Matrix
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT SIDEBAR COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* SELL ON WEBSITE CARD (TOP OF SIDEBAR) */}
            <div style={{ background: 'var(--bg-card, #ffffff)', padding: 20, borderRadius: 12, border: '1px solid var(--border, #e2e8f0)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 14px 0', borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                Storefront Visibility
              </h3>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.sell_on_website}
                    onChange={e => setForm({ ...form, sell_on_website: e.target.checked })}
                    style={{ width: 18, height: 18, accentColor: 'var(--primary, #2563eb)' }}
                  />
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 14, display: 'block', color: 'var(--text-base)' }}>Sell on Website</span>
                    <span style={{ fontSize: 12, color: '#64748b' }}>Make this product visible & purchasable on the online shop</span>
                  </div>
                </label>
              </div>
            </div>

            {/* FEATURED MAIN IMAGE CARD */}
            <div style={{ background: 'var(--bg-card, #ffffff)', padding: 20, borderRadius: 12, border: '1px solid var(--border, #e2e8f0)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 14px 0', borderBottom: '1px solid var(--border)', paddingBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <ImageIcon /> Featured Product Image
              </h3>

              <div style={{ textAlign: 'center', marginBottom: 14 }}>
                {form.image ? (
                  <div style={{ position: 'relative', width: '100%', height: 200, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', background: '#f8fafc' }}>
                    <img src={form.image} alt="Featured Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, image: '' }))}
                      style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(239, 68, 68, 0.9)', color: '#fff', border: 'none', borderRadius: '50%', width: 26, height: 26, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}
                      title="Remove Image"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div style={{ width: '100%', height: 160, borderRadius: 8, border: '2px dashed var(--border)', background: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                    <ImageIcon />
                    <span style={{ fontSize: 13, marginTop: 6 }}>No Featured Image</span>
                  </div>
                )}
              </div>

              {/* Upload File Input */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Upload Main Image File</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleMainImageFileUpload}
                  style={{ fontSize: 12, width: '100%' }}
                />
              </div>
            </div>

            {/* PRODUCT GALLERY IMAGES CARD */}
            <div style={{ background: 'var(--bg-card, #ffffff)', padding: 20, borderRadius: 12, border: '1px solid var(--border, #e2e8f0)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 14px 0', borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                Product Gallery Images
              </h3>

              {/* Gallery Grid */}
              {(form.gallery || []).length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
                  {form.gallery.map((img, idx) => (
                    <div key={idx} style={{ position: 'relative', width: '100%', height: 80, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)', background: '#f8fafc' }}>
                      <img src={img} alt={`Gallery ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button
                        type="button"
                        onClick={() => removeGalleryItem(idx)}
                        style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(239, 68, 68, 0.9)', color: '#fff', border: 'none', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}
                        title="Remove Image"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic', marginBottom: 12, textAlign: 'center' }}>
                  No gallery images added yet.
                </div>
              )}

              {/* Upload Gallery Files */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Upload Multiple Gallery Files</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleGalleryFileUpload}
                  style={{ fontSize: 12, width: '100%' }}
                />
              </div>
            </div>

            {/* CATEGORIES CARD */}
            <div style={{ background: 'var(--bg-card, #ffffff)', padding: 20, borderRadius: 12, border: '1px solid var(--border, #e2e8f0)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 14px 0', borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                Categories
              </h3>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <div style={{ marginBottom: 6 }}>
                  <MultiSelect
                    options={categories.map(c => ({ value: String(c.id), label: c.name }))}
                    value={form.category_ids}
                    onChange={vals => setForm({ ...form, category_ids: vals })}
                    placeholder="Select categories…"
                  />
                </div>
                <div style={{ textAlign: 'right' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-xs"
                    onClick={() => setShowAddCat(v => !v)}
                  >
                    {showAddCat ? 'Close' : '+ Add New Category'}
                  </button>
                </div>

                {showAddCat && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, background: '#f8fafc', padding: 8, borderRadius: 6 }}>
                    <input
                      value={newCatName}
                      onChange={e => setNewCatName(e.target.value)}
                      placeholder="Category name…"
                      style={{ flex: 1, fontSize: 12 }}
                    />
                    <button type="button" className="btn btn-primary btn-xs" onClick={handleAddCat} disabled={addingCat}>Add</button>
                  </div>
                )}
              </div>
            </div>

            {/* BRAND CARD */}
            <div style={{ background: 'var(--bg-card, #ffffff)', padding: 20, borderRadius: 12, border: '1px solid var(--border, #e2e8f0)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 14px 0', borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                Brand
              </h3>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <div style={{ flex: 1 }}>
                    <SearchableSelect
                      options={brands.map(b => ({ value: String(b.id), label: b.name }))}
                      value={form.brand_ids[0] || ''}
                      onChange={v => setForm({ ...form, brand_ids: v ? [String(v)] : [] })}
                      placeholder="Select brand…"
                    />
                  </div>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAddBrand(v => !v)}>{showAddBrand ? '✕' : '+'}</button>
                </div>
                {showAddBrand && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, background: '#f8fafc', padding: 8, borderRadius: 6 }}>
                    <input
                      value={newBrandName}
                      onChange={e => setNewBrandName(e.target.value)}
                      placeholder="New brand…"
                      style={{ flex: 1, fontSize: 12 }}
                    />
                    <button type="button" className="btn btn-primary btn-xs" onClick={handleAddBrand} disabled={addingBrand}>Add</button>
                  </div>
                )}
              </div>
            </div>

            {/* TAGS CARD */}
            <div style={{ background: 'var(--bg-card, #ffffff)', padding: 20, borderRadius: 12, border: '1px solid var(--border, #e2e8f0)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 14px 0', borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                Product Tags
              </h3>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(form.tags || ['']).map((t, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 6 }}>
                      <input
                        value={t}
                        onChange={e => {
                          const val = e.target.value;
                          setForm(f => ({ ...f, tags: f.tags.map((item, i) => i === idx ? val : item) }));
                        }}
                        placeholder="Tag (e.g. Notebooks, Pens, Office)"
                        style={{ flex: 1, fontSize: 13 }}
                      />
                      {form.tags.length > 1 && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setForm(f => ({ ...f, tags: f.tags.filter((_, i) => i !== idx) }))}
                          style={{ color: '#ef4444' }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn btn-secondary btn-xs"
                    onClick={() => setForm(f => ({ ...f, tags: [...f.tags, ''] }))}
                    style={{ alignSelf: 'flex-start', marginTop: 4 }}
                  >
                    + Add Tag
                  </button>
                </div>
              </div>
            </div>

          </div>
        </form>

        {/* MANUAL VARIATION MODAL */}
        {showManualModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 520, padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--text-base)' }}>
                  + Add Manual Variation Combination
                </h3>
                <button type="button" onClick={() => setShowManualModal(false)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}>✕</button>
              </div>

              <form onSubmit={handleAddManualVariationSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                  Select or enter attribute values (e.g. Size: 1kg, Flavor: Chocolate, Strength: 100mg) to add a single custom variation row to the matrix.
                </p>

                {/* Dynamic Attribute Inputs */}
                {variationConfigs.map((cfg, idx) => {
                  const typeName = (cfg.type || '').trim();
                  if (!typeName) return null;
                  const options = (cfg.valuesStr || '').split(',').map(s => s.trim()).filter(Boolean);
                  const currentVal = manualAttrValues[typeName] || '';

                  return (
                    <div key={idx} className="form-group">
                      <label style={{ fontSize: 13, fontWeight: 600 }}>{typeName} *</label>
                      {options.length > 0 ? (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <select
                            value={options.includes(currentVal) ? currentVal : '_custom'}
                            onChange={e => {
                              const val = e.target.value;
                              if (val === '_custom') {
                                setManualAttrValues(prev => ({ ...prev, [typeName]: '' }));
                              } else {
                                setManualAttrValues(prev => ({ ...prev, [typeName]: val }));
                              }
                            }}
                            style={{ flex: 1, padding: '7px 10px', fontSize: 13, borderRadius: 6, border: '1px solid var(--border)' }}
                          >
                            {options.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                            <option value="_custom">+ Custom Value…</option>
                          </select>
                          {(!options.includes(currentVal) || currentVal === '') && (
                            <input
                              type="text"
                              value={currentVal}
                              onChange={e => {
                                const v = e.target.value;
                                setManualAttrValues(prev => ({ ...prev, [typeName]: v }));
                              }}
                              placeholder={`Custom ${typeName}`}
                              style={{ flex: 1, padding: '7px 10px', fontSize: 13, borderRadius: 6, border: '1px solid var(--border)' }}
                              required
                            />
                          )}
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={currentVal}
                          onChange={e => {
                            const v = e.target.value;
                            setManualAttrValues(prev => ({ ...prev, [typeName]: v }));
                          }}
                          placeholder={`e.g. ${typeName} value`}
                          style={{ width: '100%', padding: '7px 10px', fontSize: 13, borderRadius: 6, border: '1px solid var(--border)' }}
                          required
                        />
                      )}
                    </div>
                  );
                })}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 4 }}>
                  <div className="form-group">
                    <label style={{ fontSize: 13, fontWeight: 600 }}>Price (₹) *</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={cleanPriceValue(manualPrice)}
                      onChange={e => setManualPrice(e.target.value)}
                      placeholder="0.00"
                      required
                      style={{ width: '100%', padding: '7px 10px', fontSize: 13, borderRadius: 6, border: '1px solid var(--border)' }}
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ fontSize: 13, fontWeight: 600 }}>Sale Price (₹)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={cleanPriceValue(manualSalePrice)}
                      onChange={e => setManualSalePrice(e.target.value)}
                      placeholder="Optional"
                      style={{ width: '100%', padding: '7px 10px', fontSize: 13, borderRadius: 6, border: '1px solid var(--border)' }}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label style={{ fontSize: 13, fontWeight: 600 }}>Barcode</label>
                  <input
                    type="text"
                    value={manualBarcode}
                    onChange={e => setManualBarcode(e.target.value)}
                    placeholder="e.g. 1234567890"
                    style={{ width: '100%', padding: '7px 10px', fontSize: 13, borderRadius: 6, border: '1px solid var(--border)' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowManualModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" style={{ background: '#0284c7', borderColor: '#0284c7' }}>
                    + Add Variation to Matrix
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {/* Modern Saving Overlay */}
        {saving && (
          <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 99999,
            background: 'rgba(255, 255, 255, 0.75)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <div style={{
              background: '#ffffff',
              padding: '32px 48px',
              borderRadius: 16,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.18), 0 0 0 1px rgba(99, 102, 241, 0.1)',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 16,
              maxWidth: 380,
            }}>
              <div style={{ position: 'relative', width: 52, height: 52 }}>
                <div style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  border: '4px solid #e0e7ff',
                  borderTopColor: '#0284c7',
                  borderRightColor: '#4f46e5',
                  animation: 'spin .8s linear infinite',
                }} />
              </div>
              <div>
                <h3 style={{ margin: '0 0 6px 0', fontSize: 17, fontWeight: 700, color: '#0f172a' }}>
                  {isEdit ? 'Updating Product…' : 'Saving New Product…'}
                </h3>
                <p style={{ margin: 0, fontSize: 13, color: '#64748b', lineHeight: 1.4 }}>
                  Please wait while product details and variations are saved.
                </p>
              </div>
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}
      </div>
    </Layout>
  );
}
