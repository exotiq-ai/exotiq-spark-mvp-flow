import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface ReadReceipt {
  message_id: string;
  user_id: string;
  read_at: string;
}

export const useReadReceipts = (conversationId?: string | null) => {
  const { user } = useAuth();
  const [receipts, setReceipts] = useState<Map<string, ReadReceipt[]>>(new Map());

  // Fetch read receipts for conversation
  const fetchReceipts = useCallback(async () => {
    if (!conversationId) return;

    try {
      const { data: messages } = await supabase
        .from('team_messages')
        .select('id')
        .eq('conversation_id', conversationId);

      if (!messages || messages.length === 0) return;

      const messageIds = messages.map(m => m.id);
      
      const { data, error } = await supabase
        .from('message_read_receipts')
        .select('*')
        .in('message_id', messageIds);

      if (error) throw error;

      const map = new Map<string, ReadReceipt[]>();
      (data || []).forEach(receipt => {
        const existing = map.get(receipt.message_id) || [];
        existing.push(receipt as ReadReceipt);
        map.set(receipt.message_id, existing);
      });

      setReceipts(map);
    } catch (error) {
      console.error('Error fetching read receipts:', error);
    }
  }, [conversationId]);

  // Mark message as read
  const markAsRead = useCallback(async (messageId: string) => {
    if (!user) return;

    try {
      await supabase
        .from('message_read_receipts')
        .upsert({
          message_id: messageId,
          user_id: user.id,
          read_at: new Date().toISOString(),
        }, { onConflict: 'message_id,user_id' });
    } catch (error) {
      // Ignore duplicate key errors
      if (!String(error).includes('duplicate')) {
        console.error('Error marking as read:', error);
      }
    }
  }, [user]);

  // Mark multiple messages as read
  const markMultipleAsRead = useCallback(async (messageIds: string[]) => {
    if (!user || messageIds.length === 0) return;

    try {
      const receipts = messageIds.map(id => ({
        message_id: id,
        user_id: user.id,
        read_at: new Date().toISOString(),
      }));

      await supabase
        .from('message_read_receipts')
        .upsert(receipts, { onConflict: 'message_id,user_id' });
    } catch (error) {
      console.error('Error marking multiple as read:', error);
    }
  }, [user]);

  // Subscribe to read receipt changes
  useEffect(() => {
    if (!conversationId) return;

    fetchReceipts();

    const channel = supabase
      .channel(`read-receipts-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_read_receipts'
        },
        () => {
          fetchReceipts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, fetchReceipts]);

  const getReaders = useCallback((messageId: string): ReadReceipt[] => {
    return receipts.get(messageId) || [];
  }, [receipts]);

  const hasBeenRead = useCallback((messageId: string, userId: string): boolean => {
    const readers = receipts.get(messageId) || [];
    return readers.some(r => r.user_id === userId);
  }, [receipts]);

  return {
    receipts,
    getReaders,
    hasBeenRead,
    markAsRead,
    markMultipleAsRead,
  };
};
