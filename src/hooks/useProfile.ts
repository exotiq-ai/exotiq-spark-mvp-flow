import { useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  company_name: string | null;
  avatar_url: string | null;
  tour_completed: boolean | null;
  tour_skipped_at: string | null;
}

/** Shared cache key: every component reading the profile shares one request. */
export const profileQueryKey = (userId: string | undefined) => ['profile', userId] as const;

export const useProfile = () => {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: profileQueryKey(userId),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, phone, company_name, avatar_url, tour_completed, tour_skipped_at')
        .eq('id', userId!)
        .maybeSingle();
      if (error) throw error;
      // No profile row yet is fine: callers treat null as "not set up".
      return (data as Profile | null) ?? null;
    },
  });

  // Live updates to this user's profile row go straight into the shared cache.
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`profile-${userId}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          queryClient.setQueryData(profileQueryKey(userId), payload.new as Profile);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  const profile = query.data ?? null;
  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'User';

  const { refetch } = query;
  const fetchProfile = useCallback(async () => {
    await refetch();
  }, [refetch]);

  // Persist first-run choices (tour taken / "I'll set up myself") on the account
  // so they survive reloads and follow the user across devices.
  const updateProfile = useCallback(async (updates: Partial<Omit<Profile, 'id' | 'email'>>) => {
    if (!userId) return;
    queryClient.setQueryData<Profile | null>(profileQueryKey(userId), (prev) =>
      prev ? ({ ...prev, ...updates } as Profile) : prev,
    );
    const { error: updateError } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId);
    if (updateError) {
      console.error('Error updating profile:', updateError);
      queryClient.invalidateQueries({ queryKey: profileQueryKey(userId) });
    }
  }, [userId, queryClient]);

  return {
    profile,
    loading: userId ? query.isLoading : false,
    error: query.error ? (query.error instanceof Error ? query.error.message : 'Failed to fetch profile') : null,
    displayName,
    updateProfile,
    refetch: fetchProfile,
  };
};
