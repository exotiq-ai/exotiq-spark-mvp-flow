import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { TeamMessage } from './useTeamMessaging';

interface PinnedMessage {
  id: string;
  conversation_id: string;
  message_id: string;
  pinned_by: string;
  pinned_at: string;
  message?: TeamMessage;
}

export const usePinnedMessages = (conversationId?: string | null) => {
  const { user } = useAuth();
  const [pinnedMessages, setPinnedMessages] = useState<PinnedMessage[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch pinned messages
  const fetchPinnedMessages = useCallback(async () => {
    if (!conversationId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('pinned_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('pinned_at', { ascending: false });

      if (error) throw error;

      // Fetch the actual messages
      if (data && data.length > 0) {
        const messageIds = data.map(p => p.message_id);
        const { data: messages } = await supabase
          .from('team_messages')
          .select('*')
          .in('id', messageIds);

        const messageMap = new Map((messages || []).map(m => [m.id, m]));

        // Get sender profiles
        const senderIds = [...new Set((messages || []).map(m => m.sender_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', senderIds);

        const profileMap = new Map((profiles || []).map(p => [p.id, p]));

        const enriched = data.map(pin => {
          const msg = messageMap.get(pin.message_id);
          return {
            ...pin,
            message: msg ? {
              ...msg,
              message_type: msg.message_type as 'text' | 'image' | 'file' | 'system',
              attachments: (msg.attachments as unknown as TeamMessage['attachments']) || [],
              mentions: (msg.mentions as string[]) || [],
              reactions: (msg.reactions as unknown as Record<string, string[]>) || {},
              sender_name: profileMap.get(msg.sender_id)?.full_name || 'Unknown',
              sender_avatar: profileMap.get(msg.sender_id)?.avatar_url,
            } as TeamMessage : undefined,
          };
        });

        setPinnedMessages(enriched);
      } else {
        setPinnedMessages([]);
      }
    } catch (error) {
      console.error('Error fetching pinned messages:', error);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  // Pin a message
  const pinMessage = useCallback(async (messageId: string) => {
    if (!user || !conversationId) return false;

    try {
      const { error } = await supabase
        .from('pinned_messages')
        .insert({
          conversation_id: conversationId,
          message_id: messageId,
          pinned_by: user.id,
        });

      if (error) throw error;

      toast.success('Message pinned');
      await fetchPinnedMessages();
      return true;
    } catch (error) {
      if (String(error).includes('duplicate')) {
        toast.error('Message is already pinned');
      } else {
        console.error('Error pinning message:', error);
        toast.error('Failed to pin message');
      }
      return false;
    }
  }, [user, conversationId, fetchPinnedMessages]);

  // Unpin a message
  const unpinMessage = useCallback(async (messageId: string) => {
    if (!conversationId) return false;

    try {
      const { error } = await supabase
        .from('pinned_messages')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('message_id', messageId);

      if (error) throw error;

      toast.success('Message unpinned');
      await fetchPinnedMessages();
      return true;
    } catch (error) {
      console.error('Error unpinning message:', error);
      toast.error('Failed to unpin message');
      return false;
    }
  }, [conversationId, fetchPinnedMessages]);

  // Check if message is pinned
  const isPinned = useCallback((messageId: string): boolean => {
    return pinnedMessages.some(p => p.message_id === messageId);
  }, [pinnedMessages]);

  // Subscribe to changes
  useEffect(() => {
    if (!conversationId) return;

    fetchPinnedMessages();

    const channel = supabase
      .channel(`pinned-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pinned_messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        () => {
          fetchPinnedMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, fetchPinnedMessages]);

  return {
    pinnedMessages,
    loading,
    pinMessage,
    unpinMessage,
    isPinned,
  };
};
