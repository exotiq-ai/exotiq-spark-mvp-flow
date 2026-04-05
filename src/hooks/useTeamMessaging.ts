import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface Conversation {
  id: string;
  name: string | null;
  description: string | null;
  type: 'direct' | 'group' | 'channel';
  is_company_wide: boolean;
  avatar_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Computed
  unread_count?: number;
  last_message?: TeamMessage;
  members?: ConversationMember[];
  other_user?: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
}

export interface ConversationMember {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'admin' | 'member';
  last_read_at: string;
  notifications_enabled: boolean;
  joined_at: string;
  // Joined
  user_name?: string;
  user_email?: string;
  user_avatar?: string | null;
}

export interface TeamMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: 'text' | 'image' | 'file' | 'system';
  reply_to: string | null;
  attachments: Attachment[];
  mentions: string[];
  reactions: Record<string, string[]>;
  is_edited: boolean;
  edited_at: string | null;
  is_pinned: boolean;
  created_at: string;
  // Computed
  sender_name?: string;
  sender_avatar?: string | null;
  reply_message?: TeamMessage;
}

export interface Attachment {
  url: string;
  name: string;
  type: string;
  size: number;
}

export const useTeamMessaging = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [teamMembers, setTeamMembers] = useState<{ id: string; name: string; email: string; avatar_url: string | null }[]>([]);
  const [currentTeamId, setCurrentTeamId] = useState<string | null>(null);
  const { user } = useAuth();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Fetch current user's team ID
  const fetchCurrentTeamId = useCallback(async () => {
    if (!user) return null;
    const { data } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1)
      .single();
    const teamId = data?.team_id || null;
    setCurrentTeamId(teamId);
    return teamId;
  }, [user]);

  // Fetch team members scoped to current user's team only
  const fetchTeamMembers = useCallback(async () => {
    if (!user) return;
    
    let teamId = currentTeamId;
    if (!teamId) {
      teamId = await fetchCurrentTeamId();
    }
    if (!teamId) return;

    const { data, error } = await supabase
      .from('team_members')
      .select('user_id, profiles(id, full_name, email, avatar_url)')
      .eq('team_id', teamId)
      .eq('is_active', true);

    if (!error && data) {
      setTeamMembers(data
        .filter(tm => tm.profiles)
        .map(tm => {
          const p = tm.profiles as unknown as { id: string; full_name: string | null; email: string; avatar_url: string | null };
          return {
            id: p.id,
            name: p.full_name || p.email,
            email: p.email,
            avatar_url: p.avatar_url,
          };
        })
      );
    }
  }, [user, currentTeamId, fetchCurrentTeamId]);

  // Fetch all conversations for current user
  const fetchConversations = useCallback(async () => {
    if (!user) return;

    let teamId = currentTeamId;
    if (!teamId) {
      teamId = await fetchCurrentTeamId();
    }

    try {
      // Get conversations where user is a member
      const { data: memberConvs, error: memberError } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', user.id);

      if (memberError) throw memberError;

      const convIds = memberConvs?.map(m => m.conversation_id) || [];

      // Also get company-wide conversations SCOPED TO CURRENT TEAM
      const companyQuery = supabase
        .from('team_conversations')
        .select('*')
        .eq('is_company_wide', true);
      
      if (teamId) {
        companyQuery.eq('team_id', teamId);
      }
      
      const { data: companyConvs, error: companyError } = await companyQuery;

      if (companyError) throw companyError;

      // Get user's conversations
      let userConvs: Conversation[] = [];
      if (convIds.length > 0) {
        const { data, error } = await supabase
          .from('team_conversations')
          .select('*')
          .in('id', convIds);

        if (error) throw error;
        userConvs = (data || []) as Conversation[];
      }

      // Merge and dedupe
      const allConvs = [...userConvs, ...(companyConvs || []).filter(c => !convIds.includes(c.id))] as Conversation[];

      // Get last message and members for each conversation
      const enrichedConvs = await Promise.all(allConvs.map(async (conv) => {
        // Get last message
        const { data: lastMsg } = await supabase
          .from('team_messages')
          .select('*')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        const lastMessage = lastMsg as unknown as TeamMessage | null;

        // Get members
        const { data: members } = await supabase
          .from('conversation_members')
          .select('*')
          .eq('conversation_id', conv.id);

        // Get member profiles
        const memberIds = members?.map(m => m.user_id) || [];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email, avatar_url')
          .in('id', memberIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
        
        const enrichedMembers = members?.map(m => ({
          ...m,
          role: m.role as 'admin' | 'member',
          user_name: profileMap.get(m.user_id)?.full_name || 'Unknown',
          user_email: profileMap.get(m.user_id)?.email || '',
          user_avatar: profileMap.get(m.user_id)?.avatar_url,
        })) || [];

        // For direct messages, get the other user
        let otherUser;
        if (conv.type === 'direct' && enrichedMembers.length > 0) {
          const other = enrichedMembers.find(m => m.user_id !== user?.id);
          if (other) {
            otherUser = {
              id: other.user_id,
              name: other.user_name || 'Unknown',
              avatar_url: other.user_avatar,
            };
          }
        }

        // Calculate unread count
        const myMembership = members?.find(m => m.user_id === user?.id);
        let unreadCount = 0;
        if (myMembership) {
          const { count } = await supabase
            .from('team_messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .gt('created_at', myMembership.last_read_at);
          unreadCount = count || 0;
        }

        return {
          ...conv,
          type: conv.type as 'direct' | 'group' | 'channel',
          last_message: lastMessage || undefined,
          members: enrichedMembers,
          other_user: otherUser,
          unread_count: unreadCount,
        };
      }));

      // Sort by last message time
      enrichedConvs.sort((a, b) => {
        const aTime = a.last_message?.created_at || a.created_at;
        const bTime = b.last_message?.created_at || b.created_at;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });

      setConversations(enrichedConvs);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Fetch messages for a conversation
  const fetchMessages = useCallback(async (conversationId: string) => {
    if (!user) return;

    setMessagesLoading(true);
    try {
      const { data, error } = await supabase
        .from('team_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) throw error;

      // Get sender profiles
      const senderIds = [...new Set(data?.map(m => m.sender_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', senderIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      const enrichedMessages: TeamMessage[] = (data || []).map(msg => ({
        ...msg,
        message_type: msg.message_type as 'text' | 'image' | 'file' | 'system',
        attachments: (msg.attachments as unknown as Attachment[]) || [],
        mentions: (msg.mentions as string[]) || [],
        reactions: (msg.reactions as unknown as Record<string, string[]>) || {},
        sender_name: profileMap.get(msg.sender_id)?.full_name || 'Unknown',
        sender_avatar: profileMap.get(msg.sender_id)?.avatar_url,
      }));

      setMessages(enrichedMessages);

      // Mark as read
      await supabase
        .from('conversation_members')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id);

    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setMessagesLoading(false);
    }
  }, [user]);

  // Subscribe to message updates
  useEffect(() => {
    if (!activeConversation) return;

    channelRef.current = supabase
      .channel(`messages-${activeConversation.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_messages',
          filter: `conversation_id=eq.${activeConversation.id}`
        },
        () => {
          fetchMessages(activeConversation.id);
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [activeConversation, fetchMessages]);

  // Initial load
  useEffect(() => {
    fetchConversations();
    fetchTeamMembers();
  }, [fetchConversations, fetchTeamMembers]);

  // Send message
  const sendMessage = useCallback(async (
    content: string,
    attachments: Attachment[] = [],
    mentions: string[] = [],
    replyTo?: string
  ) => {
    if (!user || !activeConversation) return;

    try {
      const { data: insertedMsg, error } = await supabase.from('team_messages').insert([{
        conversation_id: activeConversation.id,
        sender_id: user.id,
        content,
        message_type: attachments.some(a => a.type.startsWith('image/')) ? 'image' : attachments.length > 0 ? 'file' : 'text',
        attachments: JSON.parse(JSON.stringify(attachments)),
        mentions,
        reply_to: replyTo || null,
      }]).select().single();

      if (error) throw error;

      // Update conversation's updated_at
      await supabase
        .from('team_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', activeConversation.id);

      // Send email notifications for mentions
      if (mentions.length > 0 && insertedMsg) {
        const senderProfile = teamMembers.find(m => m.id === user.id);
        supabase.functions.invoke('mention-notification', {
          body: {
            mentionedUserIds: mentions,
            senderId: user.id,
            senderName: senderProfile?.name || user.email || 'Someone',
            messageContent: content,
            conversationId: activeConversation.id,
            messageId: insertedMsg.id,
          }
        }).catch(err => console.error('Failed to send mention notifications:', err));
      }

    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  }, [user, activeConversation, teamMembers]);

  // Create new conversation
  const createConversation = useCallback(async (
    type: 'direct' | 'group' | 'channel',
    memberIds: string[],
    name?: string,
    description?: string,
    isCompanyWide = false
  ) => {
    if (!user) return null;

    try {
      // For direct messages, check if conversation already exists
      if (type === 'direct' && memberIds.length === 1) {
        const existingConv = conversations.find(c => 
          c.type === 'direct' && 
          c.members?.some(m => m.user_id === memberIds[0])
        );
        if (existingConv) {
          setActiveConversation(existingConv);
          return existingConv;
        }
      }

      // Create conversation
      const { data: conv, error: convError } = await supabase
        .from('team_conversations')
        .insert({
          name: name || null,
          description: description || null,
          type,
          is_company_wide: isCompanyWide,
          created_by: user.id,
        })
        .select()
        .single();

      if (convError) throw convError;

      // Add creator as admin
      await supabase.from('conversation_members').insert({
        conversation_id: conv.id,
        user_id: user.id,
        role: 'admin',
      });

      // Add other members
      for (const memberId of memberIds) {
        if (memberId !== user.id) {
          await supabase.from('conversation_members').insert({
            conversation_id: conv.id,
            user_id: memberId,
            role: 'member',
          });
        }
      }

      // Refresh conversations
      await fetchConversations();

      const newConv = conversations.find(c => c.id === conv.id) || conv as Conversation;
      setActiveConversation(newConv);
      return newConv;

    } catch (error) {
      console.error('Error creating conversation:', error);
      toast.error('Failed to create conversation');
      return null;
    }
  }, [user, conversations, fetchConversations]);

  // Add reaction
  const addReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!user) return;

    const message = messages.find(m => m.id === messageId);
    if (!message) return;

    const reactions = { ...message.reactions };
    if (!reactions[emoji]) {
      reactions[emoji] = [];
    }

    if (reactions[emoji].includes(user.id)) {
      reactions[emoji] = reactions[emoji].filter(id => id !== user.id);
      if (reactions[emoji].length === 0) {
        delete reactions[emoji];
      }
    } else {
      reactions[emoji].push(user.id);
    }

    await supabase
      .from('team_messages')
      .update({ reactions })
      .eq('id', messageId);
  }, [user, messages]);

  // Upload attachment
  const uploadAttachment = useCallback(async (file: File): Promise<Attachment | null> => {
    if (!user) return null;

    try {
      const fileName = `${user.id}/${Date.now()}-${file.name}`;
      const { data, error } = await supabase.storage
        .from('message-attachments')
        .upload(fileName, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('message-attachments')
        .getPublicUrl(data.path);

      return {
        url: publicUrl,
        name: file.name,
        type: file.type,
        size: file.size,
      };
    } catch (error) {
      console.error('Error uploading attachment:', error);
      toast.error('Failed to upload file');
      return null;
    }
  }, [user]);

  return {
    conversations,
    activeConversation,
    setActiveConversation,
    messages,
    loading,
    messagesLoading,
    teamMembers,
    sendMessage,
    createConversation,
    addReaction,
    uploadAttachment,
    refresh: fetchConversations,
    refreshMessages: () => activeConversation && fetchMessages(activeConversation.id),
  };
};
