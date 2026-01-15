import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Json } from '@/integrations/supabase/types';

export type ConversationTag = 
  | 'booking_inquiry'
  | 'vehicle_question'
  | 'payment_issue'
  | 'maintenance_request'
  | 'customer_complaint'
  | 'general_information'
  | 'fleet_performance'
  | 'pricing_question';

// Keywords to detect conversation categories
const TAG_KEYWORDS: Record<ConversationTag, string[]> = {
  booking_inquiry: ['booking', 'reservation', 'reserve', 'rent', 'available', 'availability'],
  vehicle_question: ['vehicle', 'car', 'ferrari', 'lamborghini', 'porsche', 'make', 'model'],
  payment_issue: ['payment', 'charge', 'refund', 'billing', 'invoice', 'paid', 'deposit'],
  maintenance_request: ['maintenance', 'service', 'repair', 'damage', 'inspection'],
  customer_complaint: ['complaint', 'issue', 'problem', 'unhappy', 'disappointed', 'wrong'],
  fleet_performance: ['performance', 'metrics', 'revenue', 'utilization', 'analytics'],
  pricing_question: ['price', 'pricing', 'cost', 'rate', 'how much', 'expensive'],
  general_information: ['help', 'what', 'how', 'when', 'info', 'information'],
};

/**
 * Rari tags hook - saves tags to rari_conversations table
 */
export function useRariTags() {
  const detectTags = useCallback((content: string): ConversationTag[] => {
    const lowerContent = content.toLowerCase();
    const detectedTags: ConversationTag[] = [];

    for (const [tag, keywords] of Object.entries(TAG_KEYWORDS)) {
      const hasKeyword = keywords.some(keyword => lowerContent.includes(keyword));
      if (hasKeyword && !detectedTags.includes(tag as ConversationTag)) {
        detectedTags.push(tag as ConversationTag);
      }
    }

    // If no specific tags detected, mark as general information
    if (detectedTags.length === 0) {
      detectedTags.push('general_information');
    }

    return detectedTags;
  }, []);

  const updateConversationTags = useCallback(async (
    conversationId: string,
    tags: ConversationTag[]
  ): Promise<void> => {
    try {
      // Get current entities from conversation
      const { data: conversation, error: fetchError } = await supabase
        .from('rari_conversations')
        .select('id')
        .eq('id', conversationId)
        .single();

      if (fetchError || !conversation) {
        console.error('[Rari Tags] Conversation not found:', conversationId);
        return;
      }

      // Store tags in context_summary as JSON
      const tagsData = { detected_tags: tags, updated_at: new Date().toISOString() };
      
      const { error: updateError } = await supabase
        .from('rari_conversations')
        .update({ 
          context_summary: JSON.stringify(tagsData)
        })
        .eq('id', conversationId);

      if (updateError) {
        console.error('[Rari Tags] Error updating tags:', updateError);
      }
    } catch (err) {
      console.error('[Rari Tags] Failed to update tags:', err);
    }
  }, []);

  const detectAndUpdateTags = useCallback(async (
    conversationId: string,
    messages: Array<{ content: string }>
  ): Promise<ConversationTag[]> => {
    // Combine all message content
    const allContent = messages.map(m => m.content).join(' ');
    const tags = detectTags(allContent);

    // Update in database
    await updateConversationTags(conversationId, tags);

    return tags;
  }, [detectTags, updateConversationTags]);

  const getConversationTags = useCallback(async (
    conversationId: string
  ): Promise<ConversationTag[]> => {
    try {
      const { data, error } = await supabase
        .from('rari_conversations')
        .select('context_summary')
        .eq('id', conversationId)
        .single();

      if (error || !data?.context_summary) {
        return [];
      }

      try {
        const parsed = JSON.parse(data.context_summary);
        return parsed.detected_tags || [];
      } catch {
        return [];
      }
    } catch (err) {
      console.error('[Rari Tags] Failed to get tags:', err);
      return [];
    }
  }, []);

  const formatTagLabel = useCallback((tag: ConversationTag): string => {
    return tag
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }, []);

  return {
    detectTags,
    updateConversationTags,
    detectAndUpdateTags,
    getConversationTags,
    formatTagLabel,
  };
}
