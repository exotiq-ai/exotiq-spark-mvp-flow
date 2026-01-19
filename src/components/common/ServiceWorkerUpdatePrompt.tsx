import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

/**
 * ServiceWorkerUpdatePrompt - Manages PWA service worker updates.
 * 
 * CRITICAL BEHAVIOR:
 * 1. On PREVIEW hosts (id-preview--*): Completely disable SW to prevent stale cache loops
 * 2. On PRODUCTION hosts: Auto-activate waiting service workers immediately
 */

const isPreviewEnvironment = () => {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  // Lovable preview URLs start with "id-preview--"
  return hostname.startsWith('id-preview--') || hostname.includes('localhost');
};

const clearAllCachesAndUnregisterSW = async () => {
  try {
    // Unregister all service workers
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(reg => reg.unregister()));
    
    // Clear all caches
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
    
    console.log('[SW] Preview mode: Cleared all caches and unregistered service workers');
  } catch (err) {
    console.warn('[SW] Error clearing caches:', err);
  }
};

export const ServiceWorkerUpdatePrompt = () => {
  const [showUpdate, setShowUpdate] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // PREVIEW MODE: Disable service workers entirely for stability
    if (isPreviewEnvironment()) {
      console.log('[SW] Preview environment detected - disabling service workers for stability');
      clearAllCachesAndUnregisterSW();
      return; // Don't set up any SW listeners
    }

    // PRODUCTION MODE: Normal SW handling with auto-activation
    const handleControllerChange = () => {
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    // Check for waiting service worker - AUTO-ACTIVATE if found
    navigator.serviceWorker.ready.then((reg) => {
      setRegistration(reg);
      
      if (reg.waiting) {
        console.log('[SW] Found waiting service worker, auto-activating...');
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        toast.info('Updating to latest version...', { duration: 3000 });
      }

      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[SW] New service worker installed, auto-activating...');
              newWorker.postMessage({ type: 'SKIP_WAITING' });
              toast.info('Updating to latest version...', { duration: 3000 });
            }
          });
        }
      });
    });

    // Also check immediately on page load
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg?.waiting) {
        console.log('[SW] Page load: Found waiting SW, forcing activation...');
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    });

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  const handleUpdate = () => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  };

  // UI is mostly hidden since we auto-activate, but keep as fallback
  if (!showUpdate) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 p-4 bg-primary text-primary-foreground rounded-lg shadow-lg flex items-center gap-3 animate-in slide-in-from-left">
      <RefreshCw className="h-5 w-5" />
      <span className="text-sm font-medium">New version available!</span>
      <Button 
        size="sm" 
        variant="secondary" 
        onClick={handleUpdate}
        className="ml-2"
      >
        Update Now
      </Button>
    </div>
  );
};