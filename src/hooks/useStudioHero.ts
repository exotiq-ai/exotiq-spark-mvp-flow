import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const STUDIO_HERO_MAX_ATTEMPTS = 3;

export interface StudioHeroJob {
  id: string;
  vehicle_id: string;
  status: 'pending' | 'rendering' | 'qc' | 'passed' | 'failed' | 'escalated' | 'cancelled';
  attempt_number: number;
  qc_failure_reasons: string[] | null;
  error: string | null;
  created_at: string;
}

interface RenderResult {
  success: boolean;
  imageUrl?: string;
  qcFailed?: boolean;
  escalated?: boolean;
  attemptsUsed?: number;
  attemptsRemaining?: number;
  error?: string;
}

/**
 * Studio Hero state + actions for one vehicle.
 * Reads render history from hero_render_jobs and invokes render-studio-hero.
 */
export const useStudioHero = (vehicleId: string | undefined) => {
  const queryClient = useQueryClient();
  const [isRendering, setIsRendering] = useState(false);

  const { data: jobs = [], refetch } = useQuery({
    queryKey: ['studio-hero-jobs', vehicleId],
    enabled: !!vehicleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hero_render_jobs')
        .select('id, vehicle_id, status, attempt_number, qc_failure_reasons, error, created_at')
        .eq('vehicle_id', vehicleId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as StudioHeroJob[];
    },
  });

  const attemptsUsed = jobs.length;
  const attemptsRemaining = Math.max(0, STUDIO_HERO_MAX_ATTEMPTS - attemptsUsed);
  const latestJob = jobs[0] ?? null;
  const isEscalated = latestJob?.status === 'escalated' || (attemptsUsed >= STUDIO_HERO_MAX_ATTEMPTS && latestJob?.status === 'failed');
  const hasPassed = jobs.some((j) => j.status === 'passed');
  const isActive = latestJob ? ['pending', 'rendering', 'qc'].includes(latestJob.status) : false;

  const renderStudioHero = useCallback(async (): Promise<RenderResult> => {
    if (!vehicleId) return { success: false, error: 'No vehicle' };
    setIsRendering(true);
    try {
      const { data, error } = await supabase.functions.invoke('render-studio-hero', {
        body: { vehicleId },
      });

      if (error) {
        const msg = data?.error || error.message || 'Studio render failed';
        toast.error(msg);
        await refetch();
        return { success: false, error: msg, ...(data ?? {}) };
      }

      const result = data as RenderResult;
      if (result.success) {
        toast.success('Studio hero photo is ready');
      } else if (result.escalated) {
        toast.info('Exotiq support is on it', {
          description: 'Our team will hand-finish this vehicle’s studio photo.',
        });
      } else if (result.qcFailed) {
        toast.warning('Render didn’t pass quality check', {
          description: result.attemptsRemaining
            ? `You can re-render (${result.attemptsRemaining} of ${STUDIO_HERO_MAX_ATTEMPTS} left).`
            : undefined,
        });
      } else if (result.error) {
        toast.error(result.error);
      }

      await refetch();
      queryClient.invalidateQueries({ queryKey: ['vehicle-photos', vehicleId] });
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Studio render failed';
      toast.error(msg);
      return { success: false, error: msg };
    } finally {
      setIsRendering(false);
    }
  }, [vehicleId, refetch, queryClient]);

  return {
    jobs,
    latestJob,
    attemptsUsed,
    attemptsRemaining,
    isEscalated,
    hasPassed,
    isActive,
    isRendering,
    renderStudioHero,
    refetch,
  };
};
