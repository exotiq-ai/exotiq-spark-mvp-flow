import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export const useMessageActions = () => {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const editMessage = useCallback(async (messageId: string, newContent: string): Promise<boolean> => {
    if (!user) return false;
    setIsEditing(true);

    try {
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
    } finally {
      setIsEditing(false);
    }
  }, [user]);

  const deleteMessage = useCallback(async (messageId: string): Promise<boolean> => {
    if (!user) return false;
    setIsDeleting(true);

    try {
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
    } finally {
      setIsDeleting(false);
    }
  }, [user]);

  return {
    editMessage,
    deleteMessage,
    isEditing,
    isDeleting,
  };
};
