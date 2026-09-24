import '@/styles/globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { Toaster } from 'react-hot-toast';
import Head from 'next/head';
import { useEffect } from 'react';

export default function App({ Component, pageProps }) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    // Capture the beforeinstallprompt event globally as early as possible.
    // The event fires once (often before any page component mounts), so we
    // store it on window so any component can retrieve it later.
    const onBeforeInstall = (e) => {
      e.preventDefault();
      window.__pwaInstallPrompt = e;
      // Notify any listener that may already be waiting
      window.dispatchEvent(new Event('pwaPromptReady'));
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', () => {
      window.__pwaInstallPrompt = null;
    });
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <Head>
          <title>Invincible Stationary</title>
          <meta name="description" content="Invincible Stationary Management System" />
          <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />

          {/* PWA */}
          <link rel="manifest" href="/manifest.json" />
          <meta name="theme-color" content="#6366f1" />
          <meta name="mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
          <meta name="apple-mobile-web-app-title" content="InvStationary" />

          {/* Icons */}
          <link rel="icon" href="/favicon.ico" />
          <link rel="apple-touch-icon" sizes="192x192" href="/icons/icon-192x192.png" />
          <link rel="apple-touch-icon" sizes="512x512" href="/icons/icon-512x512.png" />
        </Head>
        <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
        <Component {...pageProps} />
      </AuthProvider>
    </ThemeProvider>
  );
}
