import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { DetectedEntity } from './useEntityDetection';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface RariConversation {
  id: string;
  user_id: string;
  session_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  message_count: number;
  entities_detected: any[];
  summary: string | null;
  created_at: string;
  updated_at: string;
}

interface RariMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  entities: any[];
  timestamp: string;
  created_at: string;
}

export function useRariConversationPersistence() {
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);

  const startConversation = useCallback(async (
    sessionId: string
  ): Promise<string | null> => {
    if (!user) {
      console.warn('[Rari Persistence] No user logged in - conversation will work in-memory only');
      // Don't show error - just work without persistence
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
        .select()
        .single();

      if (error) {
        console.error('[Rari Persistence] Database error:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        
        // Fail silently - conversation still works in-memory
        // Don't spam user with error toasts
        console.warn('[Rari Persistence] Continuing without database persistence');
        return null;
      }

      console.log('[Rari Persistence] ✅ Conversation saved:', data.id);
      return data.id;
      
    } catch (error: any) {
      console.error('[Rari Persistence] Unexpected error:', error);
      // Fail gracefully - transcripts still work in-memory
      return null;
    }
  }, [user]);

  const saveMessage = useCallback(async (
    conversationId: string,
    message: Message,
    entities: DetectedEntity[] = []
  ): Promise<void> => {
    if (!user || !conversationId) {
      console.warn('[Rari Persistence] Skipping message save - no user or conversation ID');
      return;
    }

    setIsSaving(true);
    try {
      // Save the message
      const { error: messageError } = await supabase
        .from('rari_messages')
        .insert({
          conversation_id: conversationId,
          role: message.role,
          content: message.content,
          entities: entities.map(e => ({
            type: e.type,
            value: e.value,
            displayText: e.displayText,
          })),
          timestamp: message.timestamp.toISOString(),
        });

      if (messageError) {
        console.error('[Rari Persistence] Failed to save message:', messageError.message);
        return; // Fail silently
      }

      // Update conversation message count
      const { error: updateError } = await supabase
        .from('rari_conversations')
        .update({
          message_count: supabase.raw('message_count + 1'),
          updated_at: new Date().toISOString(),
        })
        .eq('id', conversationId);

      if (updateError) {
        console.warn('[Rari Persistence] Failed to update message count:', updateError.message);
      }

      console.log('[Rari Persistence] ✅ Message saved');
    } catch (error: any) {
      console.error('[Rari Persistence] Error saving message:', error.message);
      // Continue silently - don't disrupt user experience
    } finally {
      setIsSaving(false);
    }
  }, [user]);

  const endConversation = useCallback(async (
    conversationId: string
  ): Promise<void> => {
    if (!user || !conversationId) return;

    try {
      // Get conversation start time to calculate duration
      const { data: conversation, error: fetchError } = await supabase
        .from('rari_conversations')
        .select('started_at')
        .eq('id', conversationId)
        .single();

      if (fetchError) throw fetchError;

      const endTime = new Date();
      const startTime = new Date(conversation.started_at);
      const durationSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

      const { error } = await supabase
        .from('rari_conversations')
        .update({
          ended_at: endTime.toISOString(),
          duration_seconds: durationSeconds,
          updated_at: endTime.toISOString(),
        })
        .eq('id', conversationId);

      if (error) throw error;

      console.log('[Rari Persistence] Conversation ended:', conversationId);
    } catch (error) {
      console.error('[Rari Persistence] Error ending conversation:', error);
    }
  }, [user]);

  const getConversationHistory = useCallback(async (
    limit: number = 20
  ): Promise<RariConversation[]> => {
    if (!user) return [];

    try {
      const { data, error } = await supabase
        .from('rari_conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('[Rari Persistence] Error fetching conversation history:', error);
      return [];
    }
  }, [user]);

  const getConversationMessages = useCallback(async (
    conversationId: string
  ): Promise<RariMessage[]> => {
    if (!user || !conversationId) return [];

    try {
      const { data, error } = await supabase
        .from('rari_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('timestamp', { ascending: true });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('[Rari Persistence] Error fetching messages:', error);
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

      if (error) throw error;

      toast.success('Conversation deleted');
      return true;
    } catch (error) {
      console.error('[Rari Persistence] Error deleting conversation:', error);
      toast.error('Failed to delete conversation');
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
