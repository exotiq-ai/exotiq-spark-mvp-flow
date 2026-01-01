import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface SearchResult {
  message_id: string;
  conversation_id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: string;
  conversation_started_at: string;
}

/**
 * In-memory Rari search hook
 * Database table (rari_messages) doesn't exist yet
 * Returns empty results for now
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

    // No database table exists yet, return empty results
    console.log('[Rari Search] Database not available, returning empty results');
    setSearchResults([]);
    setIsSearching(false);
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
