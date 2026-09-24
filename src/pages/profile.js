import Layout from '@/components/Layout';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import { IconUser, IconKey, IconShield } from '@/components/Icons';

/* ── PWA Settings Card ───────────────────────────────────── */
function PwaSettingsCard() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installing,    setInstalling]    = useState(false);
  const [isStandalone,  setIsStandalone]  = useState(false);

  useEffect(() => {
    // Check if already running as installed PWA
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setIsStandalone(true);
      return;
    }

    // Pick up the prompt captured globally in _app.js (may already be there)
    if (window.__pwaInstallPrompt) {
      setInstallPrompt(window.__pwaInstallPrompt);
    }

    // Also listen in case the prompt fires after this component mounts
    const onReady = () => {
      if (window.__pwaInstallPrompt) setInstallPrompt(window.__pwaInstallPrompt);
    };
    // Fallback: direct beforeinstallprompt listener (covers browsers that re-fire it)
    const onPrompt = (e) => { e.preventDefault(); setInstallPrompt(e); };

    window.addEventListener('pwaPromptReady', onReady);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', () => {
      setInstallPrompt(null);
      toast.success('App installed!');
    });

    return () => {
      window.removeEventListener('pwaPromptReady', onReady);
      window.removeEventListener('beforeinstallprompt', onPrompt);
    };
  }, []);

  async function handleInstall() {
    const prompt = installPrompt || window.__pwaInstallPrompt;
    if (prompt) {
      setInstalling(true);
      try {
        prompt.prompt();
        const { outcome } = await prompt.userChoice;
        if (outcome === 'accepted') {
          window.__pwaInstallPrompt = null;
          setInstallPrompt(null);
        }
      } catch {
        // prompt may have already been used
      }
      setInstalling(false);
    } else {
      // No prompt available — guide user manually
      toast('To install: use your browser menu → "Add to Home Screen" or "Install App"', { icon: 'ℹ️', duration: 6000 });
    }
  }

  async function handleReinstall() {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
      await navigator.serviceWorker.register('/sw.js');
      toast.success('Cache cleared & service worker refreshed. Reloading…');
      setTimeout(() => window.location.reload(), 1200);
    } catch {
      toast.error('Failed. Try refreshing the page.');
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, background: '#ecfdf5', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </div>
          <div>
            <div className="card-title">App Installation</div>
            <div className="card-sub">Install this app on your device for quick access</div>
          </div>
        </div>
      </div>

      <div className="card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
          {isStandalone
            ? 'App is already installed and running in standalone mode.'
            : 'Add to your home screen for a faster, app-like experience — works offline too.'}
        </p>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {isStandalone ? (
            <span style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>✓ Installed</span>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={handleInstall} disabled={installing}>
              {installing ? 'Installing…' : (installPrompt || window.__pwaInstallPrompt) ? 'Install App' : 'Install App'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function getInitials(name = '') {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function ProfilePage() {
  const { user, login } = useAuth();

  const [name,     setName]     = useState(user?.name  || '');
  const [email,    setEmail]    = useState(user?.email || '');
  const [curPwd,   setCurPwd]   = useState('');
  const [newPwd,   setNewPwd]   = useState('');
  const [confPwd,  setConfPwd]  = useState('');
  const [saving,   setSaving]   = useState(false);

  async function handleSave(e) {
    e.preventDefault();

    if (newPwd && newPwd !== confPwd) {
      toast.error('New passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      const body = { name, email };
      if (newPwd) {
        body.current_password = curPwd;
        body.new_password     = newPwd;
      }

      const res  = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      toast.success('Profile updated successfully.');
      setCurPwd(''); setNewPwd(''); setConfPwd('');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Layout title="My Profile" subtitle="Manage your account settings">
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Profile header card */}
        <div className="card">
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: '#10b981',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26, fontWeight: 700, color: '#fff', flexShrink: 0,
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
            }}>
              {getInitials(user?.name)}
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-base)' }}>{user?.name}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{user?.email}</div>
              <div style={{ marginTop: 8 }}>
                <span className="badge badge-indigo" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <IconShield size={10} color="#059669" />
                  Administrator
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Edit form */}
        <form onSubmit={handleSave}>

          {/* Personal info */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, background: '#ecfdf5', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IconUser size={15} color="#10b981" />
                </div>
                <div>
                  <div className="card-title">Personal Information</div>
                  <div className="card-sub">Update your name and email</div>
                </div>
              </div>
            </div>
            <div className="card-body">
              <div className="profile-info-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label>Full Name *</label>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Your full name"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Email Address *</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Change password */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, background: '#fef3c7', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IconKey size={15} color="#f59e0b" />
                </div>
                <div>
                  <div className="card-title">Change Password</div>
                  <div className="card-sub">Leave blank to keep your current password</div>
                </div>
              </div>
            </div>
            <div className="card-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label>Current Password</label>
                  <input
                    type="password"
                    value={curPwd}
                    onChange={e => setCurPwd(e.target.value)}
                    placeholder="Enter current password"
                  />
                </div>
                <div className="profile-pwd-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="form-group">
                    <label>New Password</label>
                    <input
                      type="password"
                      value={newPwd}
                      onChange={e => setNewPwd(e.target.value)}
                      placeholder="Min. 6 characters"
                      minLength={newPwd ? 6 : undefined}
                    />
                  </div>
                  <div className="form-group">
                    <label>Confirm New Password</label>
                    <input
                      type="password"
                      value={confPwd}
                      onChange={e => setConfPwd(e.target.value)}
                      placeholder="Repeat new password"
                    />
                    {newPwd && confPwd && newPwd !== confPwd && (
                      <span className="error-msg">Passwords do not match.</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Save button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ padding: '10px 28px' }}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>

        {/* PWA Settings */}
        <PwaSettingsCard />

      </div>
    </Layout>
  );
}
