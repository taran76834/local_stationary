import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  /**
   * Handle session expiration — when session becomes invalid, clear user and redirect to login
   */
  const handleSessionExpired = () => {
    setUser(null);
    toast.error('Session expired. Please log in again.');
    router.push('/login');
  };

  // Verify session is still valid periodically
  useEffect(() => {
    // Check session every 15 seconds for near-instant role/permission updates
    const interval = setInterval(() => {
      fetch('/api/auth/me')
        .then(r => {
          if (r.status === 401 && user) {
            handleSessionExpired();
          } else if (r.ok) {
            return r.json().then(data => {
              if (data?.user) {
                // If the role changed, force a full page reload so the sidebar
                // and route guards instantly reflect the new role without a logout.
                if (user && data.user.role !== user.role) {
                  setUser(data.user);
                  window.location.reload();
                } else {
                  setUser(data.user);
                }
              }
            });
          }
        })
        .catch(() => {});
    }, 15 * 1000); // every 15 seconds

    return () => clearInterval(interval);
  }, [user, router]);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.user) setUser(data.user);
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    let data = {};
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      // Server returned HTML (crash/500) — read as text for debugging
      const text = await res.text();
      console.error('Login API returned non-JSON:', res.status, text.slice(0, 200));
      throw new Error(`Server error (${res.status}). Please try again.`);
    }

    if (!res.ok) throw new Error(data.message || 'Login failed');
    setUser(data.user);
    return data.user;
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    router.push('/login');
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
