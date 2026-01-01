import { useCallback } from 'react';

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
 * In-memory Rari tags hook
 * Database table (rari_conversations) doesn't exist yet
 * Detects tags in-memory only
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
    // No database table exists yet, just log
    console.log('[Rari Tags] Would update tags for conversation:', conversationId, tags);
  }, []);

  const detectAndUpdateTags = useCallback(async (
    conversationId: string,
    messages: Array<{ content: string }>
  ): Promise<ConversationTag[]> => {
    // Combine all message content
    const allContent = messages.map(m => m.content).join(' ');
    const tags = detectTags(allContent);

    // Would update in database if it existed
    await updateConversationTags(conversationId, tags);

    return tags;
  }, [detectTags, updateConversationTags]);

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
    formatTagLabel,
  };
}
