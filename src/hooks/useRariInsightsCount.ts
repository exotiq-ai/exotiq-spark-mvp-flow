import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface InsightsCount {
  count: number;
  urgentCount: number;
  highCount: number;
  isLoading: boolean;
}

export function useRariInsightsCount(): InsightsCount {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const [urgentCount, setUrgentCount] = useState(0);
  const [highCount, setHighCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCounts = useCallback(async () => {
    if (!user?.id) {
      setCount(0);
      setUrgentCount(0);
      setHighCount(0);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('rari_insights')
        .select('priority')
        .eq('user_id', user.id)
        .eq('is_read', false)
        .eq('is_dismissed', false);

      if (error) throw error;

      const insights = data || [];
      setCount(insights.length);
      setUrgentCount(insights.filter(i => i.priority === 'urgent').length);
      setHighCount(insights.filter(i => i.priority === 'high').length);
    } catch (error) {
      console.error('Error fetching insights count:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  // Real-time subscription
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('rari-insights-count')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rari_insights',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Refetch counts on any change
          fetchCounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchCounts]);

  return { count, urgentCount, highCount, isLoading };
}
