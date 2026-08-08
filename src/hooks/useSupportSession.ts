import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface SupportSession {
  id: string;
  team_id: string;
  team_name: string;
  reason: string;
  granted_at: string;
  expires_at: string;
}

/**
 * Tracks the caller's active support session (super admin working inside a
 * customer account). Server-side the RPC self-heals expired sessions.
 */
export const useSupportSession = () => {
  const { user, loading: authLoading } = useAuth();
  const [session, setSession] = useState<SupportSession | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setSession(null);
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await (supabase as any).rpc('get_active_support_session');
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      setSession((row as SupportSession) ?? null);
    } catch {
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (authLoading) return;
    refresh();
  }, [authLoading, user?.id, refresh]);

  const endSession = useCallback(async () => {
    const { error } = await (supabase as any).rpc('end_support_session', {
      _grant_id: null,
      _ended_reason: 'manual',
    });
    if (error) throw error;
    await refresh();
  }, [refresh]);

  return { session, loading, refresh, endSession };
};
