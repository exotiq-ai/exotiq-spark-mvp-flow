import { useState } from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Conversation } from '@/hooks/useTeamMessaging';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Plus,
  Hash,
  Users,
  MessageCircle,
  Megaphone,
  MoreHorizontal
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConversationListProps {
  conversations: Conversation[];
  activeConversation: Conversation | null;
  onSelect: (conversation: Conversation) => void;
  onNewConversation: () => void;
  loading?: boolean;
}

export const ConversationList = ({
  conversations,
  activeConversation,
  onSelect,
  onNewConversation,
  loading
}: ConversationListProps) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredConversations = conversations.filter(conv => {
    const searchLower = searchQuery.toLowerCase();
    if (conv.name?.toLowerCase().includes(searchLower)) return true;
    if (conv.other_user?.name.toLowerCase().includes(searchLower)) return true;
    if (conv.last_message?.content.toLowerCase().includes(searchLower)) return true;
    return false;
  });

  const getConversationIcon = (conv: Conversation) => {
    if (conv.is_company_wide) return Megaphone;
    if (conv.type === 'channel') return Hash;
    if (conv.type === 'group') return Users;
    return MessageCircle;
  };

  const getConversationName = (conv: Conversation) => {
    if (conv.type === 'direct') {
      return conv.other_user?.name || 'Direct Message';
    }
    return conv.name || 'Unnamed Conversation';
  };

  const getConversationAvatar = (conv: Conversation) => {
    if (conv.type === 'direct' && conv.other_user) {
      return conv.other_user.avatar_url;
    }
    return conv.avatar_url;
  };

  const getAvatarInitials = (conv: Conversation) => {
    const name = getConversationName(conv);
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-3 border-b border-border">
          <Skeleton className="h-9 w-full" />
        </div>
        <div className="p-3 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-2">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-border space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Messages</h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onNewConversation}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
      </div>

      {/* Conversation List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-0.5">
          <AnimatePresence>
            {filteredConversations.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-8 text-muted-foreground"
              >
                <MessageCircle className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">No conversations yet</p>
                <Button
                  variant="link"
                  size="sm"
                  onClick={onNewConversation}
                  className="mt-1"
                >
                  Start a conversation
                </Button>
              </motion.div>
            ) : (
              filteredConversations.map((conv) => {
                const Icon = getConversationIcon(conv);
                const isActive = activeConversation?.id === conv.id;
                
                return (
                  <motion.button
                    key={conv.id}
                    layout
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    onClick={() => onSelect(conv)}
                    className={cn(
                      "w-full flex items-start gap-3 p-2.5 rounded-lg text-left transition-colors",
                      isActive 
                        ? "bg-primary/10 border border-primary/20" 
                        : "hover:bg-muted/50"
                    )}
                  >
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={getConversationAvatar(conv) || undefined} />
                        <AvatarFallback className={cn(
                          "text-xs",
                          conv.type === 'channel' && "bg-primary/10 text-primary",
                          conv.is_company_wide && "bg-warning/10 text-warning"
                        )}>
                          {conv.type === 'direct' ? getAvatarInitials(conv) : <Icon className="h-4 w-4" />}
                        </AvatarFallback>
                      </Avatar>
                      {conv.unread_count && conv.unread_count > 0 && (
                        <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center">
                          {conv.unread_count > 99 ? '99+' : conv.unread_count}
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn(
                          "font-medium text-sm truncate",
                          conv.unread_count && conv.unread_count > 0 && "font-semibold"
                        )}>
                          {getConversationName(conv)}
                        </span>
                        {conv.last_message && (
                          <span className="text-[10px] text-muted-foreground flex-shrink-0">
                            {formatDistanceToNow(new Date(conv.last_message.created_at), { addSuffix: false })}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {conv.is_company_wide && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 bg-warning/10 text-warning border-warning/30">
                            Company
                          </Badge>
                        )}
                        {conv.last_message ? (
                          <p className={cn(
                            "text-xs truncate",
                            conv.unread_count && conv.unread_count > 0 
                              ? "text-foreground font-medium" 
                              : "text-muted-foreground"
                          )}>
                            {conv.last_message.message_type === 'image' ? '📷 Image' :
                             conv.last_message.message_type === 'file' ? '📎 File' :
                             conv.last_message.content}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">No messages yet</p>
                        )}
                      </div>
                    </div>
                  </motion.button>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </ScrollArea>
    </div>
  );
};
