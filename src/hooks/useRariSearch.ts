import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface SearchResult {
  message_id: string;
  conversation_id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: string;
  conversation_started_at: string;
}

/**
 * Rari search hook - searches rari_messages table
 */
export function useRariSearch() {
  const { user } = useAuth();
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  const searchMessages = useCallback(async (query: string) => {
    if (!user || !query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setSearchQuery(query);

    try {
      // Search rari_messages with conversation data
      const { data: messages, error } = await supabase
        .from('rari_messages')
        .select(`
          id,
          content,
          role,
          created_at,
          conversation_id,
          rari_conversations!inner (
            user_id,
            started_at
          )
        `)
        .eq('rari_conversations.user_id', user.id)
        .ilike('content', `%${query}%`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('[Rari Search] Error:', error);
        setSearchResults([]);
        return;
      }

      const results: SearchResult[] = (messages || []).map((msg) => ({
        message_id: msg.id,
        conversation_id: msg.conversation_id,
        content: msg.content,
        role: msg.role as 'user' | 'assistant',
        timestamp: msg.created_at,
        conversation_started_at: (msg.rari_conversations as { started_at: string })?.started_at || msg.created_at,
      }));

      setSearchResults(results);
    } catch (err) {
      console.error('[Rari Search] Failed:', err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [user]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
  }, []);

  return {
    searchMessages,
    clearSearch,
    searchQuery,
    searchResults,
    isSearching,
  };
}
