import { useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

interface AuthRedirectState {
  isProcessing: boolean;
  error: string | null;
}

/**
 * Hook to detect and process auth redirects (magic links, OAuth, password recovery)
 * Clears URL parameters after processing to prevent re-processing on refresh
 */
export const useAuthRedirect = () => {
  const initialHasAuthParams =
    window.location.hash.includes('access_token') ||
    window.location.hash.includes('error=') ||
    window.location.search.includes('code=') ||
    window.location.search.includes('error=');

  const [state, setState] = useState<AuthRedirectState>({
    isProcessing: initialHasAuthParams,
    error: null,
  });
  const location = useLocation();
  const navigate = useNavigate();

  const processAuthRedirect = useCallback(async () => {
    const hash = window.location.hash;
    const search = window.location.search;
    
    // Check for auth callback indicators
    const hasAccessToken = hash.includes('access_token');
    const hasAuthCode = search.includes('code=');
    const hasError = hash.includes('error=') || search.includes('error=');
    
    if (!hasAccessToken && !hasAuthCode && !hasError) {
      // No auth redirect to process (important: clear any stale "processing" state)
      setState({ isProcessing: false, error: null });
      return;
    }

    console.log('[AuthRedirect] Processing auth callback...', { hasAccessToken, hasAuthCode, hasError });
    setState({ isProcessing: true, error: null });

    try {
      // Handle error cases first
      if (hasError) {
        const params = new URLSearchParams(hash.substring(1) || search);
        const errorDescription = params.get('error_description') || 'Authentication failed';
        console.error('[AuthRedirect] Auth error:', errorDescription);
        setState({ isProcessing: false, error: errorDescription });
        
        // Clear URL and redirect to auth page
        window.history.replaceState({}, '', window.location.pathname);
        navigate('/auth', { replace: true });
        return;
      }

      // For access_token in hash (magic links, some OAuth flows)
      if (hasAccessToken) {
        console.log('[AuthRedirect] Processing access_token from hash...');
        
        // Parse the hash to extract tokens
        const hashParams = new URLSearchParams(hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type');
        
        if (accessToken && refreshToken) {
          // Set the session
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          
          if (error) {
            console.error('[AuthRedirect] Error setting session:', error);
            setState({ isProcessing: false, error: error.message });
            window.history.replaceState({}, '', window.location.pathname);
            return;
          }
          
          console.log('[AuthRedirect] Session established successfully, type:', type);
          
          // Clear the hash
          window.history.replaceState({}, '', window.location.pathname + window.location.search);
          
          // If it's a password recovery, the onAuthStateChange will handle the navigation
          if (type === 'recovery') {
            console.log('[AuthRedirect] Password recovery detected, onAuthStateChange will handle');
          }
        }
      }

      // For code in search params (PKCE OAuth flow)
      if (hasAuthCode) {
        console.log('[AuthRedirect] Processing code from search params...');
        
        // Supabase client automatically handles code exchange via onAuthStateChange
        // Just need to wait for session to be established
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('[AuthRedirect] Error getting session after code exchange:', error);
          setState({ isProcessing: false, error: error.message });
        } else if (session) {
          console.log('[AuthRedirect] Session found after code exchange');
        }
        
        // Clear the code from URL
        const url = new URL(window.location.href);
        url.searchParams.delete('code');
        window.history.replaceState({}, '', url.pathname + (url.searchParams.toString() ? '?' + url.searchParams.toString() : ''));
      }

      setState({ isProcessing: false, error: null });
    } catch (err: any) {
      console.error('[AuthRedirect] Unexpected error:', err);
      setState({ isProcessing: false, error: err.message || 'Authentication failed' });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [navigate]);

  useEffect(() => {
    processAuthRedirect();
  }, [processAuthRedirect]);

  return state;
};

/**
 * Utility to check if current URL has auth redirect parameters
 * Use this for quick checks without processing
 */
export const hasAuthRedirectParams = (): boolean => {
  const hash = window.location.hash;
  const search = window.location.search;
  
  return (
    hash.includes('access_token') ||
    hash.includes('error=') ||
    search.includes('code=') ||
    search.includes('error=')
  );
};
