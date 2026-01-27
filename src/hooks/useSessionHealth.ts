import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { devLog, devWarn, devError } from '@/lib/logger';

export type SessionHealthStatus = 'healthy' | 'refreshing' | 'checking' | 'expired' | 'idle-warning';

interface SessionHealthConfig {
  // Minimum time (ms) tab must be hidden before triggering session refresh
  minHiddenDuration?: number;
  // Time (ms) before showing idle warning (based on user's sessionTimeout setting)
  inactivityTimeoutMs?: number;
  // Grace period (ms) after warning before auto-logout
  gracePeriodMs?: number;
  // Callback when session refresh fails and user should be logged out
  onSessionExpired: () => Promise<void>;
  // Whether the user is currently authenticated
  isAuthenticated: boolean;
  // Current user ID (for fetching settings)
  userId: string | null;
}

export function useSessionHealth(config: SessionHealthConfig) {
  const {
    minHiddenDuration = 60000, // 60 seconds default
    inactivityTimeoutMs: initialInactivityTimeout = 60 * 60 * 1000, // 60 min default
    gracePeriodMs = 60000, // 60 second grace period
    onSessionExpired,
    isAuthenticated,
    userId,
  } = config;

  const { toast } = useToast();
  const [sessionHealth, setSessionHealth] = useState<SessionHealthStatus>('healthy');
  const sessionHealthRef = useRef<SessionHealthStatus>('healthy');
  
  // Keep ref in sync with state for use in callbacks
  useEffect(() => {
    sessionHealthRef.current = sessionHealth;
  }, [sessionHealth]);
  
  // Track when tab was last visible
  const lastVisibleTimestamp = useRef<number>(Date.now());
  const lastActivityTimestamp = useRef<number>(Date.now());
  const inactivityTimeoutRef = useRef<number | null>(null);
  const warningTimeoutRef = useRef<number | null>(null);
  const configuredTimeoutMs = useRef<number>(initialInactivityTimeout);

  // Reset activity timestamp on user interaction
  const resetActivityTimer = useCallback(() => {
    lastActivityTimestamp.current = Date.now();
    
    // If we were in idle-warning state, go back to healthy
    if (sessionHealth === 'idle-warning') {
      devLog('[SessionHealth] Activity detected, canceling idle warning');
      setSessionHealth('healthy');
      if (warningTimeoutRef.current) {
        window.clearTimeout(warningTimeoutRef.current);
        warningTimeoutRef.current = null;
      }
    }
  }, [sessionHealth]);

  // Fetch and apply user's session timeout preference
  useEffect(() => {
    if (!userId) return;

    const loadSessionTimeout = async () => {
      try {
        const { data, error } = await supabase
          .from('user_settings')
          .select('settings')
          .eq('user_id', userId)
          .eq('category', 'team')
          .maybeSingle();

        if (error) {
          devWarn('[SessionHealth] Failed to load session timeout setting:', error.message);
          return;
        }

        if (data?.settings) {
          const settings = data.settings as Record<string, unknown>;
          const timeoutMinutes = parseInt(String(settings.sessionTimeout || '60'), 10);
          configuredTimeoutMs.current = timeoutMinutes * 60 * 1000;
          devLog('[SessionHealth] Session timeout configured:', timeoutMinutes, 'minutes');
        }
      } catch (err) {
        devError('[SessionHealth] Exception loading session timeout:', err);
      }
    };

    loadSessionTimeout();
  }, [userId]);

  // Refresh session function
  const refreshSession = useCallback(async (): Promise<boolean> => {
    if (!isAuthenticated) return false;
    
    setSessionHealth('refreshing');
    devLog('[SessionHealth] Refreshing session...');

    try {
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error || !data.session) {
        devWarn('[SessionHealth] Session refresh failed:', error?.message || 'No session returned');
        setSessionHealth('expired');
        toast({
          title: 'Session Expired',
          description: 'Your session has expired. Please sign in again.',
          variant: 'destructive',
        });
        await onSessionExpired();
        return false;
      }

      devLog('[SessionHealth] Session refreshed successfully');
      setSessionHealth('healthy');
      lastActivityTimestamp.current = Date.now();
      return true;
    } catch (err) {
      devError('[SessionHealth] Exception refreshing session:', err);
      setSessionHealth('expired');
      await onSessionExpired();
      return false;
    }
  }, [isAuthenticated, onSessionExpired, toast]);

  // Visibility change handler - refresh session when returning from idle
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleVisibilityChange = async () => {
      if (document.hidden) {
        // Tab is being hidden, record timestamp
        lastVisibleTimestamp.current = Date.now();
        devLog('[SessionHealth] Tab hidden at:', new Date().toISOString());
      } else {
        // Tab is becoming visible again
        const hiddenDuration = Date.now() - lastVisibleTimestamp.current;
        devLog('[SessionHealth] Tab visible after:', Math.round(hiddenDuration / 1000), 'seconds');

        if (hiddenDuration >= minHiddenDuration) {
          // Tab was hidden for a significant time, refresh session proactively
          devLog('[SessionHealth] Hidden duration exceeded threshold, refreshing session...');
          await refreshSession();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isAuthenticated, minHiddenDuration, refreshSession]);

  // Activity tracking for inactivity timeout
  useEffect(() => {
    if (!isAuthenticated) return;

    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    
    // Throttled activity handler
    let lastThrottled = 0;
    const THROTTLE_MS = 5000; // Only update every 5 seconds
    
    const handleActivity = () => {
      const now = Date.now();
      if (now - lastThrottled > THROTTLE_MS) {
        lastThrottled = now;
        resetActivityTimer();
      }
    };

    activityEvents.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [isAuthenticated, resetActivityTimer]);

  // Inactivity timeout enforcement
  useEffect(() => {
    if (!isAuthenticated) return;

    // Check for inactivity every minute
    const checkInactivity = () => {
      const inactiveDuration = Date.now() - lastActivityTimestamp.current;
      const timeoutMs = configuredTimeoutMs.current;
      const currentHealth = sessionHealthRef.current;
      
      if (inactiveDuration >= timeoutMs && currentHealth !== 'idle-warning' && currentHealth !== 'expired') {
        devLog('[SessionHealth] Inactivity threshold reached:', Math.round(inactiveDuration / 1000 / 60), 'minutes');
        setSessionHealth('idle-warning');
        
        toast({
          title: 'Session Expiring Soon',
          description: 'You will be signed out in 1 minute due to inactivity. Move your mouse or press any key to stay signed in.',
          duration: 10000,
        });

        // Start grace period countdown
        warningTimeoutRef.current = window.setTimeout(async () => {
          // Check if still inactive
          const stillInactive = Date.now() - lastActivityTimestamp.current >= timeoutMs;
          if (stillInactive && sessionHealthRef.current === 'idle-warning') {
            devLog('[SessionHealth] Grace period expired, signing out');
            toast({
              title: 'Session Ended',
              description: 'You have been signed out due to inactivity.',
              variant: 'destructive',
            });
            await onSessionExpired();
          }
        }, gracePeriodMs);
      }
    };

    inactivityTimeoutRef.current = window.setInterval(checkInactivity, 60000);
    
    return () => {
      if (inactivityTimeoutRef.current) {
        window.clearInterval(inactivityTimeoutRef.current);
      }
      if (warningTimeoutRef.current) {
        window.clearTimeout(warningTimeoutRef.current);
      }
    };
  }, [isAuthenticated, sessionHealth, gracePeriodMs, onSessionExpired, toast]);

  return {
    sessionHealth,
    refreshSession,
    resetActivityTimer,
  };
}
