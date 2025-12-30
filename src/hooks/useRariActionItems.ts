import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
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

export function useRariActionItems(conversationId?: string, messageId?: string) {
  const { user } = useAuth();
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadActionItems();
    }
  }, [user, conversationId]);

  const loadActionItems = async () => {
    if (!user) return;

    setLoading(true);
    try {
      let query = supabase
        .from('rari_action_items')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (conversationId) {
        query = query.eq('conversation_id', conversationId);
      }

      const { data, error } = await query;

      if (error) throw error;

      setActionItems(data || []);
    } catch (error) {
      console.error('[Action Items] Error loading:', error);
    } finally {
      setLoading(false);
    }
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

    try {
      const { error } = await supabase
        .from('rari_action_items')
        .insert({
          user_id: user.id,
          conversation_id: conversationId || null,
          message_id: messageId || null,
          action_text: actionText,
          due_date: dueDate?.toISOString() || null,
        });

      if (error) throw error;

      toast.success('Action item created');
      await loadActionItems();
      return true;
    } catch (error) {
      console.error('[Action Items] Error creating:', error);
      toast.error('Failed to create action item');
      return false;
    }
  };

  const completeActionItem = async (itemId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('rari_action_items')
        .update({
          completed: true,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId);

      if (error) throw error;

      toast.success('Action item completed');
      await loadActionItems();
      return true;
    } catch (error) {
      console.error('[Action Items] Error completing:', error);
      toast.error('Failed to complete action item');
      return false;
    }
  };

  const deleteActionItem = async (itemId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('rari_action_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      toast.success('Action item deleted');
      await loadActionItems();
      return true;
    } catch (error) {
      console.error('[Action Items] Error deleting:', error);
      toast.error('Failed to delete action item');
      return false;
    }
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
