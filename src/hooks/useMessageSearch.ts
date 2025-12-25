import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TeamMessage, Attachment } from './useTeamMessaging';

export const useMessageSearch = (conversationId?: string | null) => {
  const [searchResults, setSearchResults] = useState<TeamMessage[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const searchMessages = useCallback(async (query: string) => {
    if (!conversationId || !query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setSearchQuery(query);

    try {
      const { data, error } = await supabase
        .from('team_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .ilike('content', `%${query}%`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Get sender profiles
      const senderIds = [...new Set((data || []).map(m => m.sender_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', senderIds);

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      const enriched: TeamMessage[] = (data || []).map(msg => ({
        ...msg,
        message_type: msg.message_type as 'text' | 'image' | 'file' | 'system',
        attachments: (msg.attachments as unknown as Attachment[]) || [],
        mentions: (msg.mentions as string[]) || [],
        reactions: (msg.reactions as unknown as Record<string, string[]>) || {},
        sender_name: profileMap.get(msg.sender_id)?.full_name || 'Unknown',
        sender_avatar: profileMap.get(msg.sender_id)?.avatar_url,
      }));

      setSearchResults(enriched);
    } catch (error) {
      console.error('Error searching messages:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [conversationId]);

  const clearSearch = useCallback(() => {
    setSearchResults([]);
    setSearchQuery('');
  }, []);

  return {
    searchResults,
    isSearching,
    searchQuery,
    searchMessages,
    clearSearch,
  };
};
