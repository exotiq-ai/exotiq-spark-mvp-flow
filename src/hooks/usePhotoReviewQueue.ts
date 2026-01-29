import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';

// Simplified type for database results
interface UnmatchedPhotoRow {
  id: string;
  batch_id: string | null;
  user_id: string;
  team_id: string | null;
  storage_path: string;
  url: string;
  original_filename: string | null;
  ai_analysis: unknown;
  suggested_vehicle_id: string | null;
  suggestion_confidence: number;
  suggested_make: string | null;
  suggested_model: string | null;
  suggested_color: string | null;
  status: string;
  matched_vehicle_id: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
}

interface UsePhotoReviewQueueOptions {
  realtime?: boolean;
}

export interface BatchOperationProgress {
  current: number;
  total: number;
  status: 'matching' | 'rejecting' | 'complete' | 'error';
  successCount: number;
  failCount: number;
}

export function usePhotoReviewQueue(options: UsePhotoReviewQueueOptions = {}) {
  const { realtime = true } = options;
  const { user } = useAuth();
  const { currentTeam } = useTeam();
  const [queue, setQueue] = useState<UnmatchedPhotoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<BatchOperationProgress | null>(null);

  const fetchQueue = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const teamFilter = currentTeam?.id 
        ? { team_id: currentTeam.id }
        : { user_id: user.id };

      const { data, error: fetchError } = await supabase
        .from('unmatched_photos')
        .select('*')
        .match(teamFilter)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (fetchError) throw fetchError;
      setQueue((data || []) as UnmatchedPhotoRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch review queue');
    } finally {
      setLoading(false);
    }
  }, [user, currentTeam]);

  // Initial fetch
  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // Realtime subscription
  useEffect(() => {
    if (!realtime || !user) return;

    const channel = supabase
      .channel('unmatched-photos-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'unmatched_photos',
        },
        () => {
          fetchQueue();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [realtime, user, fetchQueue]);

  /**
   * Match a photo to a vehicle
   */
  const matchPhoto = useCallback(async (
    photoId: string,
    vehicleId: string
  ): Promise<void> => {
    if (!user) throw new Error('User not authenticated');

    // Get the unmatched photo
    const { data: unmatchedPhoto, error: fetchError } = await supabase
      .from('unmatched_photos')
      .select('*')
      .eq('id', photoId)
      .single();

    if (fetchError || !unmatchedPhoto) throw new Error('Photo not found');

    // Create vehicle_photo record
    const { error: insertError } = await supabase
      .from('vehicle_photos')
      .insert({
        vehicle_id: vehicleId,
        user_id: user.id,
        team_id: currentTeam?.id || null,
        storage_path: unmatchedPhoto.storage_path,
        url: unmatchedPhoto.url,
        photo_type: 'exterior',
        detected_angle: (unmatchedPhoto.ai_analysis as any)?.angle || 'unknown',
        ai_analysis: unmatchedPhoto.ai_analysis,
        is_vehicle_confirmed: true,
        quality_score: (unmatchedPhoto.ai_analysis as any)?.quality?.score || 100,
        quality_issues: (unmatchedPhoto.ai_analysis as any)?.quality?.issues || [],
        original_filename: unmatchedPhoto.original_filename,
        analyzed_at: new Date().toISOString(),
      });

    if (insertError) throw insertError;

    // Update unmatched photo status
    const { error: updateError } = await supabase
      .from('unmatched_photos')
      .update({
        status: 'matched',
        matched_vehicle_id: vehicleId,
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
      })
      .eq('id', photoId);

    if (updateError) throw updateError;

    // Remove from local queue
    setQueue(prev => prev.filter(p => p.id !== photoId));
  }, [user, currentTeam]);

  /**
   * Skip a photo (keep in queue for later)
   */
  const skipPhoto = useCallback(async (photoId: string): Promise<void> => {
    // Move to end of local queue for now
    setQueue(prev => {
      const photo = prev.find(p => p.id === photoId);
      if (!photo) return prev;
      return [...prev.filter(p => p.id !== photoId), photo];
    });
  }, []);

  /**
   * Reject a photo (mark as not a vehicle or unwanted)
   */
  const rejectPhoto = useCallback(async (photoId: string): Promise<void> => {
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('unmatched_photos')
      .update({
        status: 'rejected',
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
      })
      .eq('id', photoId);

    if (error) throw error;

    // Remove from local queue
    setQueue(prev => prev.filter(p => p.id !== photoId));
  }, [user]);

  /**
   * Batch match multiple photos to a vehicle with progress tracking
   */
  const batchMatchPhotos = useCallback(async (
    photoIds: string[],
    vehicleId: string
  ): Promise<{ success: number; failed: number }> => {
    const total = photoIds.length;
    let successCount = 0;
    let failCount = 0;

    setBatchProgress({
      current: 0,
      total,
      status: 'matching',
      successCount: 0,
      failCount: 0,
    });

    // Process in chunks of 5 for better performance
    const chunkSize = 5;
    for (let i = 0; i < photoIds.length; i += chunkSize) {
      const chunk = photoIds.slice(i, i + chunkSize);
      
      const results = await Promise.allSettled(
        chunk.map(photoId => matchPhoto(photoId, vehicleId))
      );

      results.forEach(result => {
        if (result.status === 'fulfilled') {
          successCount++;
        } else {
          failCount++;
        }
      });

      setBatchProgress({
        current: Math.min(i + chunkSize, total),
        total,
        status: 'matching',
        successCount,
        failCount,
      });
    }

    setBatchProgress({
      current: total,
      total,
      status: 'complete',
      successCount,
      failCount,
    });

    // Clear progress after a delay
    setTimeout(() => setBatchProgress(null), 2000);

    return { success: successCount, failed: failCount };
  }, [matchPhoto]);

  /**
   * Batch reject multiple photos with progress tracking
   */
  const batchRejectPhotos = useCallback(async (
    photoIds: string[]
  ): Promise<{ success: number; failed: number }> => {
    const total = photoIds.length;
    let successCount = 0;
    let failCount = 0;

    setBatchProgress({
      current: 0,
      total,
      status: 'rejecting',
      successCount: 0,
      failCount: 0,
    });

    // Process in chunks of 5 for better performance
    const chunkSize = 5;
    for (let i = 0; i < photoIds.length; i += chunkSize) {
      const chunk = photoIds.slice(i, i + chunkSize);
      
      const results = await Promise.allSettled(
        chunk.map(photoId => rejectPhoto(photoId))
      );

      results.forEach(result => {
        if (result.status === 'fulfilled') {
          successCount++;
        } else {
          failCount++;
        }
      });

      setBatchProgress({
        current: Math.min(i + chunkSize, total),
        total,
        status: 'rejecting',
        successCount,
        failCount,
      });
    }

    setBatchProgress({
      current: total,
      total,
      status: 'complete',
      successCount,
      failCount,
    });

    // Clear progress after a delay
    setTimeout(() => setBatchProgress(null), 2000);

    return { success: successCount, failed: failCount };
  }, [rejectPhoto]);

  /**
   * Clear batch progress manually
   */
  const clearBatchProgress = useCallback(() => {
    setBatchProgress(null);
  }, []);

  return {
    queue,
    loading,
    error,
    matchPhoto,
    skipPhoto,
    rejectPhoto,
    batchMatchPhotos,
    batchRejectPhotos,
    batchProgress,
    clearBatchProgress,
    refetch: fetchQueue,
    queueCount: queue.length,
  };
}
