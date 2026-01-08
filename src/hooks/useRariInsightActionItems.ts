import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

export interface InsightActionItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
  snoozedUntil?: string;
  insightId: string;
  insightTitle: string;
}

interface ActionItemFromJson {
  text: string;
  completed?: boolean;
  createdAt?: string;
  snoozedUntil?: string;
}

// Helper to safely parse JSON action items
function parseActionItems(json: unknown): ActionItemFromJson[] {
  if (!json || !Array.isArray(json)) return [];
  return json as ActionItemFromJson[];
}

export function useRariInsightActionItems() {
  const { user } = useAuth();
  const [actionItems, setActionItems] = useState<InsightActionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchActionItems = useCallback(async () => {
    if (!user) {
      setActionItems([]);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('rari_insights')
        .select('id, title, action_items')
        .eq('user_id', user.id)
        .eq('is_dismissed', false)
        .not('action_items', 'is', null);

      if (error) throw error;

      const items: InsightActionItem[] = [];
      data?.forEach((insight) => {
        const actionItemsArray = parseActionItems(insight.action_items);
        actionItemsArray.forEach((item, index) => {
          // Skip snoozed items that haven't passed their snooze date
          if (item.snoozedUntil && new Date(item.snoozedUntil) > new Date()) {
            return;
          }
          items.push({
            id: `${insight.id}-${index}`,
            text: item.text,
            completed: item.completed || false,
            createdAt: item.createdAt || new Date().toISOString(),
            snoozedUntil: item.snoozedUntil,
            insightId: insight.id,
            insightTitle: insight.title,
          });
        });
      });

      // Sort: incomplete first, then by date
      items.sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      setActionItems(items);
    } catch (error) {
      console.error('Error fetching action items:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchActionItems();

    if (!user) return;

    const channel = supabase
      .channel('rari_insight_action_items_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rari_insights',
          filter: `user_id=eq.${user.id}`,
        },
        () => fetchActionItems()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchActionItems]);

  const completeItem = async (itemId: string) => {
    const item = actionItems.find((i) => i.id === itemId);
    if (!item) return;

    const [insightId, indexStr] = itemId.split('-');
    const index = parseInt(indexStr, 10);

    try {
      const { data: insight, error: fetchError } = await supabase
        .from('rari_insights')
        .select('action_items')
        .eq('id', insightId)
        .single();

      if (fetchError) throw fetchError;

      const currentItems = parseActionItems(insight.action_items);
      if (currentItems.length === 0) return;

      currentItems[index] = { ...currentItems[index], completed: true };

      const { error: updateError } = await supabase
        .from('rari_insights')
        .update({ action_items: JSON.parse(JSON.stringify(currentItems)) as Json })
        .eq('id', insightId);

      if (updateError) throw updateError;

      setActionItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, completed: true } : i))
      );

      toast.success('Nice! Action item completed.');
    } catch (error) {
      console.error('Error completing action item:', error);
      toast.error('Failed to complete action item');
    }
  };

  const snoozeItem = async (itemId: string, until: Date) => {
    const item = actionItems.find((i) => i.id === itemId);
    if (!item) return;

    const [insightId, indexStr] = itemId.split('-');
    const index = parseInt(indexStr, 10);

    try {
      const { data: insight, error: fetchError } = await supabase
        .from('rari_insights')
        .select('action_items')
        .eq('id', insightId)
        .single();

      if (fetchError) throw fetchError;

      const currentItems = parseActionItems(insight.action_items);
      if (currentItems.length === 0) return;

      currentItems[index] = { ...currentItems[index], snoozedUntil: until.toISOString() };

      const { error: updateError } = await supabase
        .from('rari_insights')
        .update({ action_items: JSON.parse(JSON.stringify(currentItems)) as Json })
        .eq('id', insightId);

      if (updateError) throw updateError;

      setActionItems((prev) => prev.filter((i) => i.id !== itemId));
      toast.success(`Snoozed until ${until.toLocaleDateString()}`);
    } catch (error) {
      console.error('Error snoozing action item:', error);
      toast.error('Failed to snooze action item');
    }
  };

  const dismissItem = async (itemId: string) => {
    const item = actionItems.find((i) => i.id === itemId);
    if (!item) return;

    const [insightId, indexStr] = itemId.split('-');
    const index = parseInt(indexStr, 10);

    try {
      const { data: insight, error: fetchError } = await supabase
        .from('rari_insights')
        .select('action_items')
        .eq('id', insightId)
        .single();

      if (fetchError) throw fetchError;

      const currentItems = parseActionItems(insight.action_items);
      if (currentItems.length === 0) return;

      currentItems.splice(index, 1);

      const { error: updateError } = await supabase
        .from('rari_insights')
        .update({ 
          action_items: currentItems.length > 0 
            ? JSON.parse(JSON.stringify(currentItems)) as Json
            : null 
        })
        .eq('id', insightId);

      if (updateError) throw updateError;

      setActionItems((prev) => prev.filter((i) => i.id !== itemId));
      toast.success('Action item dismissed');
    } catch (error) {
      console.error('Error dismissing action item:', error);
      toast.error('Failed to dismiss action item');
    }
  };

  const pendingCount = actionItems.filter((i) => !i.completed).length;
  const completedCount = actionItems.filter((i) => i.completed).length;

  return {
    actionItems,
    isLoading,
    pendingCount,
    completedCount,
    completeItem,
    snoozeItem,
    dismissItem,
    refetch: fetchActionItems,
  };
}
