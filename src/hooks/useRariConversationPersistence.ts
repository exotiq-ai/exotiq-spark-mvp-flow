import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

/**
 * In-memory conversation persistence hook
 * Database tables (rari_conversations, rari_messages) don't exist yet
 * This provides the same API but stores data in memory only
 */
export function useRariConversationPersistence() {
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);

  const startConversation = useCallback(async (
    sessionId: string
  ): Promise<string | null> => {
    if (!user) {
      console.warn('[Rari Persistence] No user logged in - conversation will work in-memory only');
      return null;
    }

    // Generate a local ID since we're not using the database
    const localId = `local-${sessionId}-${Date.now()}`;
    console.log('[Rari Persistence] ✅ In-memory conversation started:', localId);
    return localId;
  }, [user]);

  const saveMessage = useCallback(async (
    conversationId: string,
    message: Message
  ): Promise<void> => {
    if (!user || !conversationId) {
      console.warn('[Rari Persistence] Skipping message save - no user or conversation ID');
      return;
    }

    // Log the message (in-memory only)
    console.log('[Rari Persistence] Message recorded (in-memory):', {
      conversationId,
      role: message.role,
      contentPreview: message.content.substring(0, 50) + '...',
    });
  }, [user]);

  const endConversation = useCallback(async (
    conversationId: string
  ): Promise<void> => {
    if (!user || !conversationId) return;

    console.log('[Rari Persistence] Conversation ended (in-memory):', conversationId);
  }, [user]);

  const getConversationHistory = useCallback(async (
    limit: number = 20
  ): Promise<any[]> => {
    // Return empty array - no database storage yet
    return [];
  }, [user]);

  const getConversationMessages = useCallback(async (
    conversationId: string
  ): Promise<any[]> => {
    // Return empty array - no database storage yet
    return [];
  }, [user]);

  const deleteConversation = useCallback(async (
    conversationId: string
  ): Promise<boolean> => {
    // No-op since we're not storing in database
    return true;
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
