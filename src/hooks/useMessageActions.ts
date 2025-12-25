import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export const useMessageActions = (conversationId?: string | null) => {
  const { user } = useAuth();

  // Edit a message
  const editMessage = useCallback(async (messageId: string, newContent: string): Promise<boolean> => {
    if (!user || !conversationId) return false;

    try {
      // First check if user owns the message
      const { data: msg } = await supabase
        .from('team_messages')
        .select('sender_id')
        .eq('id', messageId)
        .single();

      if (msg?.sender_id !== user.id) {
        toast.error('You can only edit your own messages');
        return false;
      }

      const { error } = await supabase
        .from('team_messages')
        .update({
          content: newContent,
          is_edited: true,
          edited_at: new Date().toISOString(),
        })
        .eq('id', messageId)
        .eq('sender_id', user.id);

      if (error) throw error;

      toast.success('Message updated');
      return true;
    } catch (error) {
      console.error('Error editing message:', error);
      toast.error('Failed to edit message');
      return false;
    }
  }, [user, conversationId]);

  // Delete a message
  const deleteMessage = useCallback(async (messageId: string): Promise<boolean> => {
    if (!user || !conversationId) return false;

    try {
      // First check if user owns the message
      const { data: msg } = await supabase
        .from('team_messages')
        .select('sender_id')
        .eq('id', messageId)
        .single();

      if (msg?.sender_id !== user.id) {
        toast.error('You can only delete your own messages');
        return false;
      }

      const { error } = await supabase
        .from('team_messages')
        .delete()
        .eq('id', messageId)
        .eq('sender_id', user.id);

      if (error) throw error;

      toast.success('Message deleted');
      return true;
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error('Failed to delete message');
      return false;
    }
  }, [user, conversationId]);

  return {
    editMessage,
    deleteMessage,
  };
};
