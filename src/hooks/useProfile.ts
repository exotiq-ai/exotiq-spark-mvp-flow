import { useState, useEffect, useCallback } from 'react';
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


export const useProfile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!user?.id) {
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('id, email, full_name, phone, company_name, avatar_url, tour_completed, tour_skipped_at')
        .eq('id', user.id)
        .maybeSingle();

      if (fetchError) throw fetchError;
      
      // If no profile exists yet, that's okay - just set null
      if (!data) {
        setProfile(null);
        return;
      }
      
      setProfile(data);
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch profile');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Subscribe to profile changes
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`profile-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          setProfile(payload.new as Profile);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'User';

  // Persist first-run choices (tour taken / "I'll set up myself") on the account
  // so they survive reloads and follow the user across devices.
  const updateProfile = useCallback(async (updates: Partial<Omit<Profile, 'id' | 'email'>>) => {
    if (!user?.id) return;
    setProfile(prev => (prev ? { ...prev, ...updates } as Profile : prev));
    const { error: updateError } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);
    if (updateError) {
      console.error('Error updating profile:', updateError);
      fetchProfile();
    }
  }, [user?.id, fetchProfile]);

  return {
    profile,
    loading,
    error,
    displayName,
    updateProfile,
    refetch: fetchProfile,
  };
};

