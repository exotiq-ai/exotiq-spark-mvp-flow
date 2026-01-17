import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Button } from '@/components/ui/button';

const Reset = () => {
  const [status, setStatus] = useState('Clearing all cached data...');
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

    const nuclearReset = async () => {
      try {
        // Step 1: Unregister all service workers
        setStatus('Unregistering service workers...');
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map(r => r.unregister()));
          console.log('Service workers unregistered:', registrations.length);
        }

        // Step 2: Clear all caches
        setStatus('Clearing browser caches...');
        if ('caches' in window) {
          const cacheKeys = await caches.keys();
          await Promise.all(cacheKeys.map(key => caches.delete(key)));
          console.log('Caches cleared:', cacheKeys.length);
        }

        // Step 3: Clear all storage
        setStatus('Clearing local storage...');
        localStorage.clear();
        sessionStorage.clear();
        console.log('Storage cleared');

        // Step 4: Clear cookies
        setStatus('Clearing cookies...');
        document.cookie.split(';').forEach(cookie => {
          const eqPos = cookie.indexOf('=');
          const name = eqPos > -1 ? cookie.substring(0, eqPos).trim() : cookie.trim();
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
        });
        console.log('Cookies cleared');

        // Step 5: Sign out from Supabase with timeout race
        // If signOut hangs for more than 1.5 seconds, proceed anyway
        setStatus('Signing out...');
        const signOutWithTimeout = Promise.race([
          supabase.auth.signOut({ scope: 'global' }).catch(e => {
            console.warn('SignOut error (proceeding anyway):', e);
          }),
          new Promise(resolve => setTimeout(resolve, 1500))
        ]);
        await signOutWithTimeout;
        console.log('Supabase signed out (or timed out)');

        // Step 6: Redirect
        setStatus('Redirecting to login...');
      } catch (error) {
        console.error('Reset error:', error);
      } finally {
        // ALWAYS redirect, even if something fails
        clearTimeout(escapeTimeout);
        forceRedirect();
      }
    };

    nuclearReset();

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
