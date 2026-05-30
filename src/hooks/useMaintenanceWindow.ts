import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';

export interface MaintenanceWindow {
  id: string;
  scope: 'global' | 'tenant';
  team_id: string | null;
  is_active: boolean;
  message: string | null;
  eta: string | null;
  started_at: string;
  ended_at: string | null;
}

/**
 * Resolves the active maintenance window relevant to the current user.
 * Priority: global > tenant-specific for the user's team.
 * Subscribes to realtime updates so the overlay reacts instantly.
 */
export function useMaintenanceWindow() {
  const { user } = useAuth();
  const { currentTeam } = useTeam();
  const [activeWindow, setActiveWindow] = useState<MaintenanceWindow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const resolve = async () => {
      try {
        // If the user isn't signed in we don't query (RLS blocks anon reads).
        // The env-based fallback handles infra-down scenarios.
        if (!user) {
          if (!cancelled) {
            setActiveWindow(null);
            setLoading(false);
          }
          return;
        }

        const { data, error } = await supabase
          .from('maintenance_windows')
          .select('id, scope, team_id, is_active, message, eta, started_at, ended_at')
          .eq('is_active', true)
          .order('started_at', { ascending: false });

        if (cancelled) return;
        if (error) {
          setActiveWindow(null);
          setLoading(false);
          return;
        }

        const rows = (data ?? []) as MaintenanceWindow[];
        const global = rows.find((r) => r.scope === 'global');
        const tenant = currentTeam
          ? rows.find((r) => r.scope === 'tenant' && r.team_id === currentTeam.id)
          : undefined;

        setActiveWindow(global ?? tenant ?? null);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setActiveWindow(null);
          setLoading(false);
        }
      }
    };

    resolve();

    // Realtime subscription — any change triggers a re-resolve.
    const channel = supabase
      .channel('maintenance-windows-watch')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'maintenance_windows' },
        () => {
          resolve();
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user?.id, currentTeam?.id]);

  return { activeWindow, loading };
}
