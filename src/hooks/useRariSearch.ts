import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface SearchResult {
  message_id: string;
  conversation_id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: string;
  conversation_started_at: string;
}

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
      // Search in messages content
      const { data, error } = await supabase
        .from('rari_messages')
        .select(`
          id,
          conversation_id,
          content,
          role,
          timestamp,
          rari_conversations!inner (
            user_id,
            started_at
          )
        `)
        .ilike('content', `%${query}%`)
        .eq('rari_conversations.user_id', user.id)
        .order('timestamp', { ascending: false })
        .limit(50);

      if (error) throw error;

      const results: SearchResult[] = (data || []).map((item: any) => ({
        message_id: item.id,
        conversation_id: item.conversation_id,
        content: item.content,
        role: item.role,
        timestamp: item.timestamp,
        conversation_started_at: item.rari_conversations.started_at,
      }));

      setSearchResults(results);
    } catch (error) {
      console.error('[Rari Search] Error searching messages:', error);
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
