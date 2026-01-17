import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface UserPresence {
  user_id: string;
  status: 'online' | 'away' | 'offline';
  last_seen: string;
  typing_in_conversation: string | null;
  updated_at: string;
}

export const usePresence = (conversationId?: string | null) => {
  const { user } = useAuth();
  const [presenceMap, setPresenceMap] = useState<Map<string, UserPresence>>(new Map());
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);

  // Update user's online status
  const updatePresence = useCallback(async (status: 'online' | 'away' | 'offline') => {
    if (!user) return;

    try {
      await supabase
        .from('user_presence')
        .upsert({
          user_id: user.id,
          status,
          last_seen: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
    } catch (error) {
      console.error('Error updating presence:', error);
    }
  }, [user]);

  // Set typing indicator
  const setTyping = useCallback(async (isTyping: boolean) => {
    if (!user || !conversationId) return;

    try {
      await supabase
        .from('user_presence')
        .upsert({
          user_id: user.id,
          status: 'online',
          typing_in_conversation: isTyping ? conversationId : null,
          last_seen: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      // Auto-clear typing after 3 seconds
      if (isTyping) {
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        typingTimeoutRef.current = setTimeout(() => {
          setTyping(false);
        }, 3000);
      }
    } catch (error) {
      console.error('Error setting typing:', error);
    }
  }, [user, conversationId]);

  // Fetch presence for team members
  const fetchPresence = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('user_presence')
        .select('*');

      if (error) throw error;

      const map = new Map<string, UserPresence>();
      (data || []).forEach(p => {
        // Mark as offline if last seen > 2 minutes ago
        const lastSeen = new Date(p.last_seen);
        const now = new Date();
        const diffMinutes = (now.getTime() - lastSeen.getTime()) / 60000;
        
        map.set(p.user_id, {
          ...p,
          status: diffMinutes > 2 ? 'offline' : p.status,
        } as UserPresence);
      });

      setPresenceMap(map);

      // Update typing users for current conversation
      if (conversationId) {
        const typing = (data || [])
          .filter(p => p.typing_in_conversation === conversationId && p.user_id !== user?.id)
          .map(p => p.user_id);
        setTypingUsers(typing);
      }
    } catch (error) {
      console.error('Error fetching presence:', error);
    }
  }, [conversationId, user?.id]);

  // Subscribe to presence changes
  useEffect(() => {
    fetchPresence();

    const channel = supabase
      .channel('presence-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_presence'
        },
        () => {
          fetchPresence();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPresence]);

  // Heartbeat to keep presence alive
  useEffect(() => {
    if (!user) return;

    // Set initial online status
    updatePresence('online');

    // Heartbeat every 30 seconds
    heartbeatRef.current = setInterval(() => {
      updatePresence('online');
    }, 30000);

    // Handle visibility change
    const handleVisibilityChange = () => {
      if (document.hidden) {
        updatePresence('away');
      } else {
        updatePresence('online');
      }
    };

    // Handle before unload - use supabase client for proper auth headers
    const handleBeforeUnload = () => {
      // sendBeacon doesn't support custom headers properly, so we use a fire-and-forget fetch
      // wrapped in keepalive to survive page unload
      try {
        fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/user_presence?user_id=eq.${user.id}`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              'Prefer': 'return=minimal',
            },
            body: JSON.stringify({ status: 'offline', last_seen: new Date().toISOString() }),
            keepalive: true,
          }
        );
      } catch {
        // Ignore errors on page unload
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      updatePresence('offline');
    };
  }, [user, updatePresence]);

  const getPresence = useCallback((userId: string): UserPresence | undefined => {
    return presenceMap.get(userId);
  }, [presenceMap]);

  const isOnline = useCallback((userId: string): boolean => {
    const presence = presenceMap.get(userId);
    return presence?.status === 'online';
  }, [presenceMap]);

  // Create a Set of online user IDs for easy lookup
  const onlineUsers = new Set(
    Array.from(presenceMap.entries())
      .filter(([, p]) => p.status === 'online')
      .map(([id]) => id)
  );

  // Get typing users for a specific conversation
  const getTypingUsers = useCallback((convId: string): string[] => {
    return Array.from(presenceMap.values())
      .filter(p => p.typing_in_conversation === convId)
      .map(p => p.user_id);
  }, [presenceMap]);

  return {
    presenceMap,
    typingUsers,
    setTyping,
    getPresence,
    isOnline,
    updatePresence,
    onlineUsers,
    getTypingUsers,
  };
};
