import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Button } from '@/components/ui/button';

/**
 * Master cache clearing utility - clears EVERYTHING that could cause app issues
 * Can be imported and used anywhere: import { masterCacheClear } from '@/pages/Reset';
 */
export const masterCacheClear = async (onStatusChange?: (status: string) => void): Promise<void> => {
  const setStatus = onStatusChange || console.log;

  try {
    // Step 1: Unregister all service workers
    setStatus('Unregistering service workers...');
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(r => r.unregister()));
      console.log('[MasterClear] Service workers unregistered:', registrations.length);
    }

    // Step 2: Clear all Cache API caches (PWA/SW caches)
    setStatus('Clearing browser caches...');
    if ('caches' in window) {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map(key => caches.delete(key)));
      console.log('[MasterClear] Cache API cleared:', cacheKeys.length);
    }

    // Step 3: Clear all localStorage
    setStatus('Clearing local storage...');
    try {
      const localStorageKeys = Object.keys(localStorage);
      localStorage.clear();
      console.log('[MasterClear] localStorage cleared:', localStorageKeys.length, 'keys');
    } catch (e) {
      console.warn('[MasterClear] localStorage clear failed:', e);
    }

    // Step 4: Clear all sessionStorage
    setStatus('Clearing session storage...');
    try {
      const sessionStorageKeys = Object.keys(sessionStorage);
      sessionStorage.clear();
      console.log('[MasterClear] sessionStorage cleared:', sessionStorageKeys.length, 'keys');
    } catch (e) {
      console.warn('[MasterClear] sessionStorage clear failed:', e);
    }

    // Step 5: Clear ALL IndexedDB databases
    setStatus('Clearing IndexedDB...');
    if ('indexedDB' in window) {
      try {
        const databases = await indexedDB.databases?.() || [];
        for (const db of databases) {
          if (db.name) {
            indexedDB.deleteDatabase(db.name);
            console.log('[MasterClear] Deleted IndexedDB:', db.name);
          }
        }
      } catch (e) {
        console.warn('[MasterClear] IndexedDB clear failed (may not be supported):', e);
      }
    }

    // Step 6: Clear all cookies (including auth cookies)
    setStatus('Clearing cookies...');
    const cookies = document.cookie.split(';');
    cookies.forEach(cookie => {
      const eqPos = cookie.indexOf('=');
      const name = eqPos > -1 ? cookie.substring(0, eqPos).trim() : cookie.trim();
      if (name) {
        // Clear for all possible paths and domains
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`;
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.${window.location.hostname}`;
      }
    });
    console.log('[MasterClear] Cookies cleared:', cookies.length);

    // Step 7: Clear any BroadcastChannel messages
    try {
      const bc = new BroadcastChannel('app-cache-clear');
      bc.postMessage({ type: 'CACHE_CLEARED', timestamp: Date.now() });
      bc.close();
      console.log('[MasterClear] BroadcastChannel notified');
    } catch (e) {
      // BroadcastChannel not supported
    }

    // Step 8: Sign out from Supabase with timeout race
    setStatus('Signing out from all sessions...');
    try {
      const signOutWithTimeout = Promise.race([
        supabase.auth.signOut({ scope: 'global' }).catch(e => {
          console.warn('[MasterClear] SignOut error (proceeding anyway):', e);
        }),
        new Promise(resolve => setTimeout(resolve, 2000))
      ]);
      await signOutWithTimeout;
      console.log('[MasterClear] Supabase signed out (or timed out)');
    } catch (e) {
      console.warn('[MasterClear] Supabase signOut failed:', e);
    }

    // Step 9: Clear performance entries (memory cleanup)
    if (performance?.clearResourceTimings) {
      performance.clearResourceTimings();
      console.log('[MasterClear] Performance timings cleared');
    }

    setStatus('Cache cleared successfully!');
    console.log('[MasterClear] ✅ All caches cleared successfully');
  } catch (error) {
    console.error('[MasterClear] Error during cache clear:', error);
    throw error;
  }
};

const Reset = () => {
  const [status, setStatus] = useState('Initializing master cache clear...');
  const [showManualEscape, setShowManualEscape] = useState(false);

  const forceRedirect = () => {
    // Use replace so back button doesn't return to /reset
    window.location.replace('/auth?reset=1');
  };

  useEffect(() => {
    // Show manual escape button after 3 seconds
    const escapeTimeout = setTimeout(() => {
      setShowManualEscape(true);
    }, 3000);

    const runReset = async () => {
      try {
        await masterCacheClear(setStatus);
        setStatus('Redirecting to login...');
      } catch (error) {
        console.error('Reset error:', error);
        setStatus('Error occurred, redirecting anyway...');
      } finally {
        // ALWAYS redirect, even if something fails
        clearTimeout(escapeTimeout);
        // Small delay to show final status
        setTimeout(forceRedirect, 500);
      }
    };

    runReset();

    return () => {
      clearTimeout(escapeTimeout);
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <LoadingSpinner />
      <p className="mt-4 text-muted-foreground">{status}</p>
      <p className="mt-2 text-xs text-muted-foreground/60">Clearing all cached data and session state...</p>
      
      {showManualEscape && (
        <Button 
          onClick={forceRedirect}
          variant="outline"
          className="mt-6"
        >
          Continue to Login →
        </Button>
      )}
    </div>
  );
};

export default Reset;
