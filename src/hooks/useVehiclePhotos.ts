import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import type { PhotoStats } from '@/components/photos/types';

// Simplified type for database results (JSON fields are not strictly typed)
interface VehiclePhotoRow {
  id: string;
  vehicle_id: string;
  user_id: string;
  team_id: string | null;
  storage_path: string;
  url: string;
  thumbnail_url: string | null;
  photo_type: string;
  detected_angle: string | null;
  ai_analysis: unknown;
  is_vehicle_confirmed: boolean;
  quality_score: number;
  quality_issues: string[] | null;
  is_enhanced: boolean;
  enhanced_url: string | null;
  enhancement_settings: unknown;
  original_filename: string | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  display_order: number;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
  analyzed_at: string | null;
  enhanced_at: string | null;
}

interface UseVehiclePhotosOptions {
  vehicleId?: string;
  realtime?: boolean;
}

export function useVehiclePhotos(options: UseVehiclePhotosOptions = {}) {
  const { vehicleId, realtime = false } = options;
  const { user } = useAuth();
  const { currentTeam } = useTeam();
  const [photos, setPhotos] = useState<VehiclePhotoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPhotos = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('vehicle_photos')
        .select('*')
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (vehicleId) {
        query = query.eq('vehicle_id', vehicleId);
      } else if (currentTeam?.id) {
        query = query.eq('team_id', currentTeam.id);
      } else {
        query = query.eq('user_id', user.id);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      setPhotos((data || []) as VehiclePhotoRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch photos');
    } finally {
      setLoading(false);
    }
  }, [user, currentTeam, vehicleId]);

  // Initial fetch
  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  // Realtime subscription
  useEffect(() => {
    if (!realtime || !user) return;

    const channel = supabase
      .channel('vehicle-photos-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vehicle_photos',
          filter: vehicleId ? `vehicle_id=eq.${vehicleId}` : undefined,
        },
        () => {
          fetchPhotos();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [realtime, user, vehicleId, fetchPhotos]);

  // Compute stats
  const stats = useMemo((): PhotoStats => {
    const heroPhotos = photos.filter(p => p.photo_type === 'hero').length;
    const vehicleIds = new Set(photos.map(p => p.vehicle_id));
    const avgQuality = photos.length > 0
      ? photos.reduce((sum, p) => sum + (p.quality_score || 0), 0) / photos.length
      : 0;

    return {
      totalPhotos: photos.length,
      vehiclesWithPhotos: vehicleIds.size,
      vehiclesWithoutPhotos: 0, // Computed elsewhere with vehicle count
      heroPhotos,
      unmatchedPhotos: 0, // Computed separately from unmatched_photos table
      averageQualityScore: Math.round(avgQuality),
    };
  }, [photos]);

  // Get photos grouped by vehicle
  const photosByVehicle = useMemo(() => {
    const grouped: Record<string, VehiclePhotoRow[]> = {};
    photos.forEach(photo => {
      if (!grouped[photo.vehicle_id]) {
        grouped[photo.vehicle_id] = [];
      }
      grouped[photo.vehicle_id].push(photo);
    });
    return grouped;
  }, [photos]);

  // Get photo count per vehicle (for badges)
  const photoCountByVehicle = useMemo(() => {
    const counts: Record<string, number> = {};
    photos.forEach(photo => {
      counts[photo.vehicle_id] = (counts[photo.vehicle_id] || 0) + 1;
    });
    return counts;
  }, [photos]);

  // Get hero photo for a vehicle
  const getHeroPhoto = useCallback((vehicleId: string): VehiclePhotoRow | undefined => {
    return photos.find(p => p.vehicle_id === vehicleId && p.photo_type === 'hero');
  }, [photos]);

  return {
    photos,
    loading,
    error,
    stats,
    photosByVehicle,
    photoCountByVehicle,
    getHeroPhoto,
    refetch: fetchPhotos,
  };
}

// Hook for fetching photo stats for the hub dashboard
export function usePhotoHubStats() {
  const { user } = useAuth();
  const { currentTeam } = useTeam();
  const [stats, setStats] = useState({
    totalPhotos: 0,
    vehiclesWithPhotos: 0,
    vehiclesWithoutPhotos: 0,
    heroPhotos: 0,
    unmatchedPhotos: 0,
    averageQualityScore: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Build team filter
      const teamFilter = currentTeam?.id 
        ? { team_id: currentTeam.id }
        : { user_id: user.id };

      // Fetch vehicle photos count and stats
      const { data: photosData, error: photosError } = await supabase
        .from('vehicle_photos')
        .select('id, vehicle_id, photo_type, quality_score')
        .match(teamFilter);

      if (photosError) throw photosError;

      // Fetch unmatched photos count
      const { count: unmatchedCount, error: unmatchedError } = await supabase
        .from('unmatched_photos')
        .select('id', { count: 'exact', head: true })
        .match(teamFilter)
        .eq('status', 'pending');

      if (unmatchedError) throw unmatchedError;

      // Fetch total vehicles count
      const { count: vehicleCount, error: vehicleError } = await supabase
        .from('vehicles')
        .select('id', { count: 'exact', head: true })
        .match(teamFilter);

      if (vehicleError) throw vehicleError;

      // Calculate stats
      const photos = photosData || [];
      const vehicleIdsWithPhotos = new Set(photos.map(p => p.vehicle_id));
      const heroPhotos = photos.filter(p => p.photo_type === 'hero').length;
      const avgQuality = photos.length > 0
        ? photos.reduce((sum, p) => sum + (p.quality_score || 0), 0) / photos.length
        : 0;

      setStats({
        totalPhotos: photos.length,
        vehiclesWithPhotos: vehicleIdsWithPhotos.size,
        vehiclesWithoutPhotos: Math.max(0, (vehicleCount || 0) - vehicleIdsWithPhotos.size),
        heroPhotos,
        unmatchedPhotos: unmatchedCount || 0,
        averageQualityScore: Math.round(avgQuality),
      });
    } catch (err) {
      console.error('Failed to fetch photo stats:', err);
    } finally {
      setLoading(false);
    }
  }, [user, currentTeam]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, refetch: fetchStats };
}
