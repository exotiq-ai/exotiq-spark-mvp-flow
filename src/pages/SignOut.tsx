import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { safeSignOut } from '@/lib/safeSignOut';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

const SignOut = () => {
  useEffect(() => {
    const forceSignOut = async () => {
      try {
        // Clear all storage first
        localStorage.clear();
        sessionStorage.clear();
        
        // Sign out from Supabase (global scope, except shared demo accounts
        // which must stay local so other demo visitors keep their sessions)
        await safeSignOut(supabase, 'global');
      } catch (error) {
        console.error('Sign out error:', error);
      } finally {
        // Hard redirect to auth regardless of outcome
        window.location.href = '/auth';
      }
    };
    
    forceSignOut();
  }, []);

  return <LoadingSpinner fullScreen text="Signing you out..." />;
};

export default SignOut;
