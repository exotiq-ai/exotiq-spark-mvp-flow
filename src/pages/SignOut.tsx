import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

const SignOut = () => {
  useEffect(() => {
    const forceSignOut = async () => {
      try {
        // Clear all storage first
        localStorage.clear();
        sessionStorage.clear();
        
        // Sign out from Supabase with global scope
        await supabase.auth.signOut({ scope: 'global' });
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
