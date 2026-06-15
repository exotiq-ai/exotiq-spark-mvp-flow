import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { initStaleAssetRecovery, rescueStuckServiceWorker } from '@/lib/staleBuildRecovery'
import { registerSW } from 'virtual:pwa-register'

// Initialize stale asset auto-recovery BEFORE React renders
// This catches chunk load errors and auto-reloads once
initStaleAssetRecovery();

// One-time rescue for users with a stuck pre-fix service worker.
// Runs only on production hosts and only once per browser.
rescueStuckServiceWorker();

// Properly register the service worker so vite-plugin-pwa's update flow actually runs.
// Without this call, the SW never checks for new versions and users get stuck on
// stale cached bundles indefinitely.
const isPreviewHost =
  typeof window !== 'undefined' &&
  (window.location.hostname.startsWith('id-preview--') ||
    window.location.hostname.includes('lovableproject.com') ||
    window.location.hostname.includes('localhost'));

if (!isPreviewHost) {
  // Register the SW but DO NOT auto-activate updates. Auto-activation triggers
  // `controllerchange` → silent page reload, which users perceive as "the app
  // randomly reloaded". Instead we expose the waiting SW on a window event so
  // `ServiceWorkerUpdatePrompt` can show a non-intrusive "Update available"
  // pill and the reload only happens when the user clicks it.
  registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      // Poll for updates every 60 minutes — catches long-lived tabs / installed PWAs
      setInterval(() => {
        registration.update().catch(() => {
          // Silent — network errors here are expected and harmless
        });
      }, 60 * 60 * 1000);
    },
    onNeedRefresh() {
      // Tell the in-app prompt a new version is waiting. Do NOT call
      // updateSW(true) here — that would silently reload the tab.
      window.dispatchEvent(new CustomEvent('sw-update-available'));
    },
    onRegisterError(error) {
      console.warn('[SW] Registration failed:', error);
    },
  });
}

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
);
