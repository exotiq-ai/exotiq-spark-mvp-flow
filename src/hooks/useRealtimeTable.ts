import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { devLog } from '@/lib/logger';

interface UseRealtimeTableOptions {
  teamId?: string | null;
  onUpdate: () => void;
  enabled?: boolean;
}

/**
 * Page-level realtime subscription for a single table.
 * Subscribes on mount, unsubscribes on unmount.
 * Filters by team_id and debounces the callback.
 */
export function useRealtimeTable(
  tableName: string,
  { teamId, onUpdate, enabled = true }: UseRealtimeTableOptions
) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const channelName = `page-rt-${tableName}-${teamId ?? 'global'}-${Date.now()}`;
    devLog(`[useRealtimeTable] Subscribing to ${tableName} on channel ${channelName}`);

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: tableName },
        (payload) => {
          const record = (payload.new as any) || (payload.old as any);
          if (teamId && record?.team_id && record.team_id !== teamId) return;

          // Debounce rapid updates
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => {
            onUpdateRef.current();
          }, 500);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          devLog(`[useRealtimeTable] ✅ ${tableName} subscription active`);
        }
      });

    return () => {
      devLog(`[useRealtimeTable] Cleaning up ${tableName} subscription`);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [tableName, teamId, enabled]);
}
