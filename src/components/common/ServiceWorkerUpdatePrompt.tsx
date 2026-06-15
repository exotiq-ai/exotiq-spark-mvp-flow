import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, X } from 'lucide-react';

/**
 * ServiceWorkerUpdatePrompt — non-intrusive "Update available" pill.
 *
 * BEHAVIOR:
 * 1. PREVIEW hosts (id-preview--*, localhost): SW disabled entirely.
 * 2. PRODUCTION hosts: When a new SW is waiting, show a small pill in the
 *    bottom-left. The reload ONLY happens when the user clicks "Update".
 *    No silent auto-activation, no surprise reloads.
 */

const isPreviewEnvironment = () => {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  return hostname.startsWith('id-preview--') || hostname.includes('localhost');
};

const clearAllCachesAndUnregisterSW = async () => {
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((reg) => reg.unregister()));
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));
    console.log('[SW] Preview mode: cleared caches and unregistered SW');
  } catch (err) {
    console.warn('[SW] Error clearing caches:', err);
  }
};

export const ServiceWorkerUpdatePrompt = () => {
  const [showUpdate, setShowUpdate] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const userInitiatedRef = useRef(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    if (isPreviewEnvironment()) {
      console.log('[SW] Preview environment — disabling service workers');
      clearAllCachesAndUnregisterSW();
      return;
    }

    // Reload exactly once after the user opts in and the new SW takes control.
    // We intentionally do NOT reload on every controllerchange — that's what
    // caused the "the app reloaded itself right after I logged in" reports.
    // The reload is gated behind userInitiatedRef which only flips when the
    // user clicks the "Reload" pill below.
    let reloading = false;
    const handleControllerChange = () => {
      if (reloading) return;
      if (!userInitiatedRef.current) return; // ignore silent SW takeovers
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    // Listen for our custom event from main.tsx
    const handleUpdateAvailable = () => {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg) setRegistration(reg);
        setShowUpdate(true);
      });
    };
    window.addEventListener('sw-update-available', handleUpdateAvailable);

    // Also check on mount in case the event fired before we mounted
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return;
      setRegistration(reg);
      if (reg.waiting) setShowUpdate(true);

      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setShowUpdate(true);
          }
        });
      });
    });

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      window.removeEventListener('sw-update-available', handleUpdateAvailable);
    };
  }, []);

  const handleUpdate = () => {
    userInitiatedRef.current = true;
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    } else {
      // Fallback: hard reload if waiting worker disappeared.
      window.location.reload();
    }
  };

  if (!showUpdate || dismissed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-3 rounded-full border border-border/60 bg-background/95 px-4 py-2 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80"
    >
      <RefreshCw className="h-4 w-4 text-primary" />
      <span className="text-sm font-medium text-foreground">Update available</span>
      <Button size="sm" variant="default" onClick={handleUpdate} className="h-7 rounded-full px-3 text-xs">
        Reload
      </Button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};
