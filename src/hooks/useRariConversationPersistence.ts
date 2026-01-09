import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

/**
 * Conversation persistence hook using Supabase
 * Stores conversations and messages in rari_conversations and rari_messages tables
 */
export function useRariConversationPersistence() {
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);

  const startConversation = useCallback(async (
    sessionId: string
  ): Promise<string | null> => {
    if (!user) {
      console.warn('[Rari Persistence] No user logged in - conversation will not be saved');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('rari_conversations')
        .insert({
          user_id: user.id,
          session_id: sessionId,
          started_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (error) {
        console.error('[Rari Persistence] Failed to start conversation:', error);
        return null;
      }

      console.log('[Rari Persistence] ✅ Conversation started:', data.id);
      return data.id;
    } catch (error) {
      console.error('[Rari Persistence] Error starting conversation:', error);
      return null;
    }
  }, [user]);

  const saveMessage = useCallback(async (
    conversationId: string,
    message: Message
  ): Promise<void> => {
    if (!user || !conversationId) {
      console.warn('[Rari Persistence] Skipping message save - no user or conversation ID');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('rari_messages')
        .insert({
          conversation_id: conversationId,
          role: message.role,
          content: message.content,
          created_at: message.timestamp.toISOString(),
        });

      if (error) {
        console.error('[Rari Persistence] Failed to save message:', error);
        return;
      }

      // Update message count in conversation
      await supabase
        .from('rari_conversations')
        .update({ message_count: supabase.rpc ? undefined : undefined }) // Will use increment
        .eq('id', conversationId);

      console.log('[Rari Persistence] ✅ Message saved:', {
        conversationId,
        role: message.role,
        contentPreview: message.content.substring(0, 50) + '...',
      });
    } catch (error) {
      console.error('[Rari Persistence] Error saving message:', error);
    } finally {
      setIsSaving(false);
    }
  }, [user]);

  const endConversation = useCallback(async (
    conversationId: string
  ): Promise<void> => {
    if (!user || !conversationId) return;

    try {
      const { error } = await supabase
        .from('rari_conversations')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', conversationId);

      if (error) {
        console.error('[Rari Persistence] Failed to end conversation:', error);
        return;
      }

      console.log('[Rari Persistence] ✅ Conversation ended:', conversationId);
    } catch (error) {
      console.error('[Rari Persistence] Error ending conversation:', error);
    }
  }, [user]);

  const getConversationHistory = useCallback(async (
    limit: number = 20
  ): Promise<any[]> => {
    if (!user) return [];

    try {
      const { data, error } = await supabase
        .from('rari_conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('[Rari Persistence] Failed to get history:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[Rari Persistence] Error getting history:', error);
      return [];
    }
  }, [user]);

  const getConversationMessages = useCallback(async (
    conversationId: string
  ): Promise<any[]> => {
    if (!user || !conversationId) return [];

    try {
      const { data, error } = await supabase
        .from('rari_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[Rari Persistence] Failed to get messages:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[Rari Persistence] Error getting messages:', error);
      return [];
    }
  }, [user]);

  const deleteConversation = useCallback(async (
    conversationId: string
  ): Promise<boolean> => {
    if (!user || !conversationId) return false;

    try {
      const { error } = await supabase
        .from('rari_conversations')
        .delete()
        .eq('id', conversationId);

      if (error) {
        console.error('[Rari Persistence] Failed to delete conversation:', error);
        return false;
      }

      console.log('[Rari Persistence] ✅ Conversation deleted:', conversationId);
      return true;
    } catch (error) {
      console.error('[Rari Persistence] Error deleting conversation:', error);
      return false;
    }
  }, [user]);

  return {
    startConversation,
    saveMessage,
    endConversation,
    getConversationHistory,
    getConversationMessages,
    deleteConversation,
    isSaving,
  };
}
