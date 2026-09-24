import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useRole } from '@/hooks/useRole';
import { useTheme } from '@/context/ThemeContext';
import { useEffect, useState } from 'react';
import {
  IconDashboard, IconBox, IconTag, IconDroplet, IconBrand,
  IconTruck, IconFactory, IconReceipt, IconLogout, IconStore,
  IconUsers, IconUser, IconCalendar, IconCustomers, IconTransfer,
  IconShoppingBag, IconUserCheck,
} from './Icons';

/* ─── Navigation config ─────────────────────────────────── */
const NAV = [
  {
    section: 'Overview',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: IconDashboard, allowedRoles: ['admin', 'manager', 'store_minus', 'store_plus', 'sales'] },
    ],
  },
  {
    section: 'Online Store',
    items: [
      { href: '/orders',            label: 'Orders',            icon: IconShoppingBag, allowedRoles: ['admin', 'manager', 'sales'] },
      { href: '/website-customers', label: 'Website Customers', icon: IconUserCheck,   allowedRoles: ['admin', 'manager', 'sales'] },
      { href: '/shipping',          label: 'Shipping',          icon: IconTruck,       allowedRoles: ['admin', 'manager'] },
    ],
  },
  {
    section: 'Inventory',
    items: [
      { href: '/products',    label: 'Products',       icon: IconBox, allowedRoles: ['admin', 'manager', 'store_minus', 'store_plus', 'sales'] },
      { href: '/stock-items',      label: 'Stock & Expiry',   icon: IconCalendar, allowedRoles: ['admin', 'manager', 'store_minus', 'store_plus', 'sales'] },
      { href: '/stock-transfers',  label: 'Stock Transfers',  icon: IconTransfer, allowedRoles: ['admin', 'manager', 'sales'] },
      { href: '/stores',      label: 'Stores',         icon: IconStore, allowedRoles: ['admin'] },
      { href: '/categories',  label: 'Categories',     icon: IconTag, allowedRoles: ['admin', 'manager'] },
      { href: '/brands',      label: 'Brands',         icon: IconBrand, allowedRoles: ['admin', 'manager'] },
    ],
  },
  {
    section: 'Purchasing',
    items: [
      { href: '/purchase-orders', label: 'Product Receipt', icon: IconTruck, allowedRoles: ['admin', 'manager', 'store_plus', 'sales'] },
      { href: '/suppliers',       label: 'Suppliers',       icon: IconFactory, allowedRoles: ['admin', 'manager', 'store_plus', 'sales'] },
    ],
  },
  {
    section: 'Sales',
    items: [
      { href: '/bills',     label: 'Bills',     icon: IconReceipt, allowedRoles: ['admin', 'manager', 'store_minus', 'store_plus', 'sales'] },
      { href: '/customers', label: 'Customers', icon: IconCustomers, allowedRoles: ['admin', 'manager', 'store_minus', 'store_plus', 'sales'] },
    ],
  },
  {
    section: 'Administration',
    items: [
      { href: '/users',   label: 'User List',  icon: IconUsers, allowedRoles: ['admin'] },
      { href: '/profile', label: 'My Profile', icon: IconUser, allowedRoles: ['admin', 'manager', 'store_minus', 'store_plus', 'sales'] },
    ],
  },
];

/* Bottom nav items (mobile) — pick the most important 5 */
const BOTTOM_NAV = [
  { href: '/dashboard',      label: 'Home',     icon: IconDashboard },
  { href: '/products',       label: 'Products', icon: IconBox },
  { href: '/bills',          label: 'Bills',    icon: IconReceipt },
  { href: '/stock-items',    label: 'Stock',    icon: IconCalendar },
  { href: '/profile',        label: 'Profile',  icon: IconUser },
];

/* ─── Helpers ────────────────────────────────────────────── */
function getInitials(name = '') {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

/* ─── Icons ─────────────────────────────────────────────── */
function HamburgerIcon({ open }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      {open ? (
        <>
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </>
      ) : (
        <>
          <line x1="3" y1="6"  x2="21" y2="6"  />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </>
      )}
    </svg>
  );
}

function CollapseIcon({ collapsed }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ transition: 'transform .3s', transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)' }}>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  );
}

/* ─── Sidebar Install Button ─────────────────────────────── */
function SidebarInstallBtn({ collapsed }) {
  const [prompt, setPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Already running as installed PWA
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setInstalled(true);
      return;
    }

    // Pick up the prompt captured globally in _app.js
    if (window.__pwaInstallPrompt) {
      setPrompt(window.__pwaInstallPrompt);
    }

    const onReady = () => {
      if (window.__pwaInstallPrompt) setPrompt(window.__pwaInstallPrompt);
    };
    const handler = (e) => { e.preventDefault(); setPrompt(e); };

    window.addEventListener('pwaPromptReady', onReady);
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => { setInstalled(true); window.__pwaInstallPrompt = null; });
    return () => {
      window.removeEventListener('pwaPromptReady', onReady);
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  // Hide if already installed or no prompt available
  if (installed || !prompt) return null;

  async function install() {
    const p = prompt || window.__pwaInstallPrompt;
    if (!p) return;
    p.prompt();
    const { outcome } = await p.userChoice;
    if (outcome === 'accepted') {
      setInstalled(true);
      window.__pwaInstallPrompt = null;
    }
  }

  if (collapsed) {
    return (
      <button
        className="sidebar-install-icon-btn"
        onClick={install}
        title="Install App"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
      </button>
    );
  }

  return (
    <button className="sidebar-install-btn" onClick={install}>
      <span className="sidebar-install-icon">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
      </span>
      <span className="sidebar-install-text">
        <span className="sidebar-install-label">Install App</span>
        <span className="sidebar-install-sub">Add to home screen</span>
      </span>
    </button>
  );
}

function getRoleLabel(role) {
  if (role === 'admin')       return 'Administrator';
  if (role === 'manager')     return 'Manager';
  if (role === 'store_minus') return 'Store Minus';
  if (role === 'store_plus')  return 'Store Plus';
  if (role === 'sales')       return 'Sales';
  return role || '';
}

/* ─── Layout ─────────────────────────────────────────────── */
export default function Layout({ children, title, subtitle }) {
  const { user, loading, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const { isSales, hasAnyPlus, hasAnyMinus, hasAnyTransfers, canViewOrdersCustomers } = useRole();
  const router = useRouter();

  const [sidebarOpen,     setSidebarOpen]     = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('sidebar-expanded') === 'true';
  });
  const [sidebarAnimating, setSidebarAnimating] = useState(false);

  function toggleSidebar() {
    setSidebarAnimating(true);
    setSidebarExpanded(v => {
      localStorage.setItem('sidebar-expanded', String(!v));
      return !v;
    });
    // Remove animation class after transition completes
    setTimeout(() => setSidebarAnimating(false), 280);
  }

  function openMobileSidebar() {
    setSidebarOpen(true);
    // Always expand on mobile so text labels are visible
    if (window.innerWidth <= 768 && !sidebarExpanded) {
      setSidebarExpanded(true);
    }
  }
  useEffect(() => { setSidebarOpen(false); }, [router.pathname]);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else {
        const currentPath = router.pathname;
        const allowedPaths = ['/profile'];
        NAV.forEach(group => {
          group.items.forEach(item => {
            const roles = item.allowedRoles || (item.adminOnly ? ['admin'] : ['admin', 'manager']);
            if (!roles.includes(user.role)) return;

            // For sales role: bills only allowed if user has at least one minus store
            if (user.role === 'sales' && item.href === '/bills' && !hasAnyMinus) return;
            // For sales role: purchasing only allowed if user has at least one plus store
            if (user.role === 'sales' && (item.href === '/purchase-orders' || item.href === '/suppliers') && !hasAnyPlus) return;
            // For sales role: stock transfers only allowed with transfers permission
            if (user.role === 'sales' && item.href === '/stock-transfers' && !hasAnyTransfers) return;
            // For sales role: orders & website-customers only if toggle enabled
            if (user.role === 'sales' && (item.href === '/orders' || item.href === '/website-customers') && !canViewOrdersCustomers) return;
            // For sales role: stock-items always allowed

            allowedPaths.push(item.href);
          });
        });
        const isPathAllowed = allowedPaths.some(p => 
          currentPath === p || 
          currentPath.startsWith(p + '/') || 
          (p === '/orders' && (currentPath === '/order' || currentPath.startsWith('/order/')))
        );
        if (!isPathAllowed && currentPath !== '/login') {
          const fallbackPath = allowedPaths.find(p => p !== '/profile') || '/profile';
          router.push(fallbackPath);
        }
      }
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-base)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '3px solid var(--border)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin .7s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const sidebarClass = [
    'sidebar',
    sidebarOpen      ? 'open'       : '',
    sidebarExpanded  ? 'expanded'   : '',
    sidebarAnimating ? 'animating'  : '',
  ].filter(Boolean).join(' ');

  return (
    <div className="layout">
      {/* Mobile overlay */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* ── Sidebar ── */}
      <aside className={sidebarClass}>

        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <IconStore size={18} color="#fff" />
          </div>
          {sidebarExpanded && (
            <div className="sidebar-logo-text-wrap">
              <div className="sidebar-logo-text">Invincible Fitness</div>
              <div className="sidebar-logo-sub">Management system</div>
            </div>
          )}
        </div>

        {/* Edge toggle — sits on right edge of sidebar */}
        <button
          className="sidebar-edge-toggle"
          onClick={toggleSidebar}
          title={sidebarExpanded ? 'Collapse' : 'Expand'}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            {sidebarExpanded
              ? <polyline points="15 18 9 12 15 6" />   /* < */
              : <polyline points="9 18 15 12 9 6" />    /* > */
            }
          </svg>
        </button>

        {/* Nav */}
        <nav className="sidebar-nav">
          {NAV.map(group => {
            const visibleItems = group.items.filter(item => {
              const roles = item.allowedRoles || (item.adminOnly ? ['admin'] : ['admin', 'manager']);
              if (!roles.includes(user.role)) return false;
              
              // For sales users: show/hide items based on their store permission types
              if (isSales) {
                // Bills menu: only show if user has at least one MINUS store
                if (item.href === '/bills' && !hasAnyMinus) return false;
                // Purchase Orders, Suppliers: only show if user has at least one PLUS store
                if ((item.href === '/purchase-orders' || item.href === '/suppliers') && !hasAnyPlus) {
                  return false;
                }
                // Stock Transfers: only show if user has transfers permission
                if (item.href === '/stock-transfers' && !hasAnyTransfers) return false;
                // Orders & Website Customers: only show if toggle is enabled
                if ((item.href === '/orders' || item.href === '/website-customers') && !canViewOrdersCustomers) return false;
                // Stock & Expiry: always visible for all sales users
              }
              
              return true;
            });
            if (!visibleItems.length) return null;

            return (
              <div key={group.section} className="nav-group">
                {sidebarExpanded && (
                  <div className="nav-section-header">
                    <span className="nav-section-label">{group.section}</span>
                  </div>
                )}

                <div className="nav-items">
                  {visibleItems.map(item => {
                    const Icon   = item.icon;
                    const active = router.pathname === item.href;
                    return (
                      <Link key={item.href} href={item.href}>
                        <div
                          className={`nav-item${active ? ' active' : ''}`}
                          title={!sidebarExpanded ? item.label : undefined}
                        >
                          <span className="nav-icon"><Icon size={17} /></span>
                          {sidebarExpanded && <span className="nav-label">{item.label}</span>}

                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Footer / user */}
        <div className="sidebar-footer">
          <SidebarInstallBtn collapsed={!sidebarExpanded} />
          {sidebarExpanded ? (
            <Link href="/profile">
              <div className="sidebar-user">
                <div className="sidebar-avatar">{getInitials(user.name)}</div>
                <div className="sidebar-user-info">
                  <div className="sidebar-user-name">{user.name}</div>
                  <div className="sidebar-user-role" style={{ color: user.role === 'admin' ? '#818cf8' : user.role === 'manager' ? '#60a5fa' : '#34d399' }}>
                    {getRoleLabel(user.role)}
                  </div>
                </div>
                <button className="btn-logout-icon" onClick={e => { e.preventDefault(); logout(); }} title="Logout">
                  <IconLogout size={15} />
                </button>
              </div>
            </Link>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <Link href="/profile">
                <div className="sidebar-avatar" title={user.name} style={{ cursor: 'pointer' }}>
                  {getInitials(user.name)}
                </div>
              </Link>
              <button className="btn-logout-icon" onClick={logout} title="Logout" style={{ width: 32, height: 32, justifyContent: 'center' }}>
                <IconLogout size={15} />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main ── */}
      <div className={`main-wrap${sidebarExpanded ? ' sidebar-pinned' : ''}${sidebarAnimating ? ' animating' : ''}`}>

        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-left">
            {/* Mobile hamburger */}
            <button className="sidebar-toggle" onClick={() => { setSidebarOpen(v => !v); if (window.innerWidth <= 768) setSidebarExpanded(true); }} aria-label="Toggle menu">
              <HamburgerIcon open={sidebarOpen} />
            </button>
            <div className="topbar-title-wrap">
              <span className="topbar-title">{title || 'Dashboard'}</span>
              {subtitle && <span className="topbar-sub">{subtitle}</span>}
            </div>
          </div>

          <div className="topbar-right">
            {/* Theme toggle */}
            <button className="theme-toggle" onClick={toggle} aria-label="Toggle theme" title={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
              {dark ? <MoonIcon /> : <SunIcon />}
            </button>

            {/* User chip */}
            <Link href="/profile">
              <div className="topbar-user">
                <div className="topbar-avatar">{getInitials(user.name)}</div>
                <div className="topbar-user-info">
                  <span className="topbar-user-name">{user.name}</span>
                  <span className="topbar-user-role">{getRoleLabel(user.role)}</span>
                </div>
              </div>
            </Link>

            {/* Logout */}
            <button className="topbar-logout" onClick={logout} title="Logout">
              <IconLogout size={16} />
            </button>
          </div>
        </header>

        <main className="page-content">
          {children}
        </main>
      </div>

    </div>
  );
}
