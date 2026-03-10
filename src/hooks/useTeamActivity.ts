import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';

export interface ActivityLog {
  id: string;
  user_id: string;
  activity_type: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  // Joined data
  user_name?: string;
  user_email?: string;
  user_avatar?: string;
}

interface UseTeamActivityOptions {
  limit?: number;
  activityTypes?: string[];
}

export const useTeamActivity = (options: UseTeamActivityOptions = {}) => {
  const { limit = 50, activityTypes } = options;
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { currentTeam } = useTeam();

  const fetchActivities = useCallback(async () => {
    if (!user || !currentTeam?.id) return;
    
    try {
      // First fetch team member user_ids to scope activity
      const { data: teamMembersData } = await supabase
        .from('team_members')
        .select('user_id')
        .eq('team_id', currentTeam.id)
        .eq('is_active', true);

      const teamUserIds = teamMembersData?.map(m => m.user_id) || [];
      if (teamUserIds.length === 0) {
        setActivities([]);
        setLoading(false);
        return;
      }

      let query = supabase
        .from('user_activity_log')
        .select('*')
        .in('user_id', teamUserIds)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (activityTypes && activityTypes.length > 0) {
        query = query.in('activity_type', activityTypes);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Fetch user profiles for the activities
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(a => a.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email, avatar_url')
          .in('id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
        
        const enrichedActivities = data.map(activity => ({
          ...activity,
          metadata: activity.metadata as Record<string, unknown>,
          user_name: profileMap.get(activity.user_id)?.full_name || 'Unknown User',
          user_email: profileMap.get(activity.user_id)?.email || '',
          user_avatar: profileMap.get(activity.user_id)?.avatar_url || null,
        }));

        setActivities(enrichedActivities);
      } else {
        setActivities([]);
      }
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  }, [user, limit, activityTypes]);

  useEffect(() => {
    fetchActivities();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('activity-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_activity_log'
        },
        () => {
          fetchActivities();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchActivities]);

  const logActivity = useCallback(async (
    activityType: string,
    entityType?: string,
    entityId?: string,
    metadata?: Record<string, unknown>
  ) => {
    if (!user) return;

    try {
      await supabase.from('user_activity_log').insert([{
        user_id: user.id,
        activity_type: activityType,
        entity_type: entityType || null,
        entity_id: entityId || null,
        metadata: (metadata || {}) as unknown as null,
      }]);
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  }, [user]);

  return {
    activities,
    loading,
    refresh: fetchActivities,
    logActivity,
  };
};

// Activity type icons and labels
export const activityConfig: Record<string, { label: string; color: string; icon: string }> = {
  login: { label: 'Logged in', color: 'text-success', icon: 'LogIn' },
  logout: { label: 'Logged out', color: 'text-muted-foreground', icon: 'LogOut' },
  booking_created: { label: 'Created booking', color: 'text-primary', icon: 'CalendarPlus' },
  booking_updated: { label: 'Updated booking', color: 'text-warning', icon: 'Calendar' },
  booking_cancelled: { label: 'Cancelled booking', color: 'text-destructive', icon: 'CalendarX' },
  payment_recorded: { label: 'Recorded payment', color: 'text-success', icon: 'DollarSign' },
  vehicle_added: { label: 'Added vehicle', color: 'text-primary', icon: 'Car' },
  vehicle_updated: { label: 'Updated vehicle', color: 'text-warning', icon: 'Car' },
  customer_added: { label: 'Added customer', color: 'text-primary', icon: 'UserPlus' },
  customer_updated: { label: 'Updated customer', color: 'text-warning', icon: 'User' },
  role_changed: { label: 'Role changed', color: 'text-accent', icon: 'Shield' },
  settings_updated: { label: 'Updated settings', color: 'text-muted-foreground', icon: 'Settings' },
  message_sent: { label: 'Sent message', color: 'text-primary', icon: 'MessageSquare' },
  comment_added: { label: 'Added comment', color: 'text-primary', icon: 'MessageCircle' },
};
