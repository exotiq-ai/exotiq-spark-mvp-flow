import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface ActionItem {
  id: string;
  user_id: string;
  conversation_id: string | null;
  message_id: string | null;
  action_text: string;
  due_date: string | null;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
}

// Patterns to detect action items in conversation
const ACTION_PATTERNS = [
  /remind me to (.+)/gi,
  /schedule (.+)/gi,
  /follow up (?:with|on) (.+)/gi,
  /check on (.+)/gi,
  /need to (.+)/gi,
  /don't forget to (.+)/gi,
  /make sure to (.+)/gi,
];

/**
 * In-memory action items hook
 * Database table (rari_action_items) doesn't exist yet
 * This provides the same API but stores data in memory only
 */
export function useRariActionItems(conversationId?: string, messageId?: string) {
  const { user } = useAuth();
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(false);

  const loadActionItems = async () => {
    // No-op - no database yet
    setLoading(false);
  };

  const detectActionItems = (content: string): string[] => {
    const detected: string[] = [];

    for (const pattern of ACTION_PATTERNS) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          detected.push(match[1].trim());
        }
      }
    }

    return detected;
  };

  const createActionItem = async (
    actionText: string,
    conversationId?: string,
    messageId?: string,
    dueDate?: Date
  ): Promise<boolean> => {
    if (!user) return false;

    // Create in-memory action item
    const newItem: ActionItem = {
      id: `local-${Date.now()}`,
      user_id: user.id,
      conversation_id: conversationId || null,
      message_id: messageId || null,
      action_text: actionText,
      due_date: dueDate?.toISOString() || null,
      completed: false,
      completed_at: null,
      created_at: new Date().toISOString(),
    };

    setActionItems(prev => [newItem, ...prev]);
    toast.success('Action item created (in-memory)');
    return true;
  };

  const completeActionItem = async (itemId: string): Promise<boolean> => {
    if (!user) return false;

    setActionItems(prev => 
      prev.map(item => 
        item.id === itemId 
          ? { ...item, completed: true, completed_at: new Date().toISOString() }
          : item
      )
    );
    toast.success('Action item completed');
    return true;
  };

  const deleteActionItem = async (itemId: string): Promise<boolean> => {
    if (!user) return false;

    setActionItems(prev => prev.filter(item => item.id !== itemId));
    toast.success('Action item deleted');
    return true;
  };

  return {
    actionItems,
    loading,
    detectActionItems,
    createActionItem,
    completeActionItem,
    deleteActionItem,
    refreshActionItems: loadActionItems,
  };
}
