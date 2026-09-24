import { useAuth } from '@/context/AuthContext';

// Normalize a single store's perm value: string → array (backward-compat)
function normalizeStorePerms(raw) {
  if (!raw) return {};
  const out = {};
  for (const [sid, v] of Object.entries(raw)) {
    if (Array.isArray(v)) out[sid] = v;
    else if (typeof v === 'string') out[sid] = [v];
    else out[sid] = [];
  }
  return out;
}

export function useRole() {
  const { user } = useAuth();

  const isAdmin      = user?.role === 'admin';
  const isManager    = user?.role === 'manager';
  const isStoreMinus = user?.role === 'store_minus';  // legacy
  const isStorePlus  = user?.role === 'store_plus';   // legacy
  const isSales      = user?.role === 'sales';

  // Only SALES uses per-store permission map (store_permissions key).
  // Managers use a plain assigned_stores list — no per-perm granularity.
  const hasPerStorePerms = isSales;

  // storePerms: { "3": ["minus","transfers"], "7": ["plus"] } — sales only
  const storePerms = (isSales && user?.storePerms && typeof user.storePerms === 'object')
    ? normalizeStorePerms(user.storePerms)
    : {};

  // assignedStores: array of store IDs the user can access
  const assignedStores = isAdmin
    ? []
    : isManager
      ? Array.isArray(user?.stores)
        ? user.stores.map(Number)
        : []
      : isSales
        ? Object.keys(storePerms).map(Number)
        : Array.isArray(user?.stores)
          ? user.stores.map(Number)
          : [];

  // ── Permission helpers ────────────────────────────────────────────────────

  /** True if this user can access (view/use) a given store */
  const hasStoreAccess = (storeId) => {
    if (isAdmin) return true;
    if (!storeId) return false;
    const id = Number(storeId);
    // Sales: must have at least one perm for the store
    if (isSales) return storePerms[String(id)] !== undefined && storePerms[String(id)].length > 0;
    // Manager + legacy: must be in assignedStores
    return assignedStores.includes(id);
  };

  /** Check if a SALES user has a specific named permission for a store */
  const hasPermForStore = (storeId, permKey) => {
    if (isAdmin) return true;
    if (!storeId) return false;
    if (isSales) {
      const arr = storePerms[String(Number(storeId))];
      return Array.isArray(arr) && arr.includes(permKey);
    }
    // Managers have implicit access to all perms for their assigned stores
    if (isManager) return assignedStores.includes(Number(storeId));
    return false;
  };

  // Check if any assigned store has a given permission (sales) or is assigned (manager)
  const hasAnyPerm = (permKey) => {
    if (isSales) return Object.values(storePerms).some(arr => arr.includes(permKey));
    // Managers implicitly have all perms for their assigned stores
    if (isManager) return assignedStores.length > 0;
    return false;
  };

  const hasAnyMinus     = isStoreMinus || hasAnyPerm('minus');
  const hasAnyPlus      = isStorePlus  || hasAnyPerm('plus');
  const hasAnyTransfers = hasAnyPerm('transfers');

  // Manager with any assigned stores = can manage inventory
  const managerCanManage = isManager && assignedStores.length > 0;

  // Sales user with the "Manage Products" toggle enabled by admin
  const salesCanManageProducts = isSales && !!user?.canManageProducts;

  // Sales user with the "Can View Orders & Website Customers" toggle enabled by admin
  const canViewOrdersCustomers = isAdmin || isManager || (isSales && !!user?.canViewOrdersCustomers);

  /**
   * True if user can edit bills/stock for this specific store.
   */
  const canEditForStore = (storeId) => {
    if (isAdmin) return true;
    if (isStoreMinus) return hasStoreAccess(storeId);
    if (isStorePlus)  return false;
    if (isSales)      return hasPermForStore(storeId, 'minus');
    if (isManager)    return assignedStores.includes(Number(storeId));
    return false;
  };

  /** True if user has 'plus' access for this store */
  const isPlusForStore = (storeId) => {
    if (isAdmin) return false;
    if (isSales) return hasPermForStore(storeId, 'plus');
    if (isStorePlus) return hasStoreAccess(storeId);
    if (isManager) return assignedStores.includes(Number(storeId));
    return false;
  };

  return {
    isAdmin,
    isManager,
    isStoreMinus,
    isStorePlus,
    isSales,
    hasPerStorePerms,
    storePerms,
    assignedStores,
    hasAnyMinus,
    hasAnyPlus,
    hasAnyTransfers,
    hasStoreAccess,
    hasPermForStore,
    canEditForStore,
    isPlusForStore,

    // ── Inventory management ──
    canDelete:      isAdmin,
    canAdd:         isAdmin || isManager,
    canEdit:        isAdmin,

    canAddProduct:  isAdmin || managerCanManage || salesCanManageProducts,
    canEditProduct: isAdmin || managerCanManage || salesCanManageProducts,

    // Stock editing — manager always, sales with PLUS perm, legacy store_minus
    canEditStock:   isAdmin || isStoreMinus || isManager || (isSales && hasAnyPlus),

    // Bills — manager always, sales with at least one MINUS store, legacy roles
    canAddBill:     isAdmin || isStoreMinus || isStorePlus || isManager ||
                    (isSales && hasAnyMinus),
    canEditBill:    isAdmin || isStoreMinus ||
                    (isManager && assignedStores.length > 0) ||
                    (isSales && hasAnyMinus),

    // Customers
    canAddCustomer:  isAdmin || managerCanManage,
    canEditCustomer: isAdmin || managerCanManage,

    // Suppliers
    canAddSupplier:  isAdmin || managerCanManage,
    canEditSupplier: isAdmin || managerCanManage,

    // Purchase Orders — manager always (they manage stock receipts)
    canAddPurchaseOrder:  isAdmin || isStorePlus || isManager || (isSales && hasAnyPlus),
    canEditPurchaseOrder: isAdmin || isStorePlus || isManager || (isSales && hasAnyPlus),

    // Stock Transfers — admin always, sales/manager with 'transfers' permission
    canViewTransfers:   isAdmin || (isSales && hasAnyTransfers) || (isManager && hasAnyTransfers),
    canCreateTransfer:  isAdmin || (isSales && hasAnyTransfers) || (isManager && hasAnyTransfers),

    // Shipping Management — admin and manager only
    canManageShipping:  isAdmin || isManager,

    role: user?.role,
    canManageProducts: salesCanManageProducts,
    canViewOrdersCustomers,
  };
}
