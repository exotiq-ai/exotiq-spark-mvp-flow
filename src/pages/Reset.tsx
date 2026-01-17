import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

const Reset = () => {
  const [status, setStatus] = useState('Clearing all cached data...');

  useEffect(() => {
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

        // Step 5: Sign out from Supabase
        setStatus('Signing out...');
        await supabase.auth.signOut({ scope: 'global' });
        console.log('Supabase signed out');

        // Step 6: Hard redirect to auth
        setStatus('Redirecting to login...');
        
        // Small delay to ensure everything is processed
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Hard redirect - not React Router
        window.location.href = '/auth';
      } catch (error) {
        console.error('Reset error:', error);
        // Even if something fails, still redirect
        window.location.href = '/auth';
      }
    };

    nuclearReset();
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <LoadingSpinner />
      <p className="mt-4 text-muted-foreground">{status}</p>
      <p className="mt-2 text-xs text-muted-foreground/60">Clearing all cached data and session state...</p>
    </div>
  );
};

export default Reset;
