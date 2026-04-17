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
  const updateSW = registerSW({
    immediate: true,
    onRegisteredSW(swUrl, registration) {
      if (!registration) return;
      // Poll for updates every 60 minutes — catches long-lived tabs / installed PWAs
      setInterval(() => {
        registration.update().catch(() => {
          // Silent — network errors here are expected and harmless
        });
      }, 60 * 60 * 1000);
    },
    onNeedRefresh() {
      // Auto-activate the new SW immediately. The existing
      // ServiceWorkerUpdatePrompt listens for `controllerchange` and reloads.
      updateSW(true).catch(() => {
        // ignore
      });
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
