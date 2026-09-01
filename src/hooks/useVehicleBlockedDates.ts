import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTeam } from '@/contexts/TeamContext';
import type { VehicleBlockedDate } from '@/lib/blockedDates';

interface NewBlockInput {
  vehicle_id: string;
  start_date: string;   // ISO
  end_date: string;     // ISO
  reason: string;
  note?: string | null;
}

/**
 * Manual vehicle date blocks for the current workspace.
 * Only blocks that end in the future (or ended within the last day) are loaded —
 * that is all availability logic needs, and it keeps the payload small.
 */
export const useVehicleBlockedDates = (vehicleId?: string) => {
  const { currentTeam } = useTeam();
  const [blocks, setBlocks] = useState<VehicleBlockedDate[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchBlocks = useCallback(async () => {
    if (!currentTeam?.id) {
      setBlocks([]);
      return;
    }
    setLoading(true);
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      let query = supabase
        .from('vehicle_blocked_dates')
        .select('*')
        .eq('team_id', currentTeam.id)
        .gte('end_date', since)
        .order('start_date', { ascending: true });

      if (vehicleId) query = query.eq('vehicle_id', vehicleId);

      const { data, error } = await query;
      if (error) throw error;
      setBlocks((data || []) as VehicleBlockedDate[]);
    } catch (err) {
      console.error('Error loading blocked dates:', err);
    } finally {
      setLoading(false);
    }
  }, [currentTeam?.id, vehicleId]);

  useEffect(() => {
    fetchBlocks();
  }, [fetchBlocks]);

  const addBlock = useCallback(
    async (input: NewBlockInput) => {
      if (!currentTeam?.id) throw new Error('No workspace selected');
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('vehicle_blocked_dates')
        .insert({
          team_id: currentTeam.id,
          vehicle_id: input.vehicle_id,
          start_date: input.start_date,
          end_date: input.end_date,
          reason: input.reason,
          source: 'manual',
          note: input.note || null,
          created_by: auth?.user?.id ?? null,
        })
        .select('*')
        .single();

      if (error) throw error;
      setBlocks((prev) => [...prev, data as VehicleBlockedDate]);
      return data as VehicleBlockedDate;
    },
    [currentTeam?.id],
  );

  const removeBlock = useCallback(async (id: string) => {
    const { data, error } = await supabase
      .from('vehicle_blocked_dates')
      .delete()
      .eq('id', id)
      .select('id');

    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error('You do not have permission to remove this block.');
    }
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  }, []);

  return { blocks, loading, refresh: fetchBlocks, addBlock, removeBlock };
};
