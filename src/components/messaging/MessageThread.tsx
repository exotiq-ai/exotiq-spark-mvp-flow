import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Conversation, TeamMessage, Attachment } from '@/hooks/useTeamMessaging';
import { useAuth } from '@/contexts/AuthContext';
import { usePresence } from '@/hooks/usePresence';
import { useReadReceipts } from '@/hooks/useReadReceipts';
import { usePinnedMessages } from '@/hooks/usePinnedMessages';
import { useMessageSearch } from '@/hooks/useMessageSearch';
import { useMessageActions } from '@/hooks/useMessageActions';
import { useTeamGroups } from '@/hooks/useTeamGroups';
import { useUserRole } from '@/hooks/useUserRole';
import {
  buildPickerItems,
  parseMentions,
  resolveMention,
  type MentionableMember,
  type MentionContext,
  type PickerItem,
} from '@/lib/mentions';
import { MentionPicker } from './MentionPicker';
import { MentionConfirmDialog } from './MentionConfirmDialog';
import { TypingIndicator } from './TypingIndicator';
import { OnlineIndicator } from './OnlineIndicator';
import { ReadReceipts } from './ReadReceipts';
import { PinnedMessagesBar } from './PinnedMessagesBar';
import { MessageSearchBar } from './MessageSearchBar';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Paperclip,
  Smile,
  Image as ImageIcon,
  Reply,
  MoreHorizontal,
  Pin,
  PinOff,
  Trash2,
  Edit,
  Hash,
  Users,
  Megaphone,
  X,
  Download,
  FileText,
  AtSign,
  Search,
  Check,
  CheckCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MessageThreadProps {
  conversation: Conversation;
  messages: TeamMessage[];
  loading?: boolean;
  onSendMessage: (content: string, attachments?: Attachment[], mentions?: string[], replyTo?: string) => void;
  onReaction: (messageId: string, emoji: string) => void;
  onUploadAttachment: (file: File) => Promise<Attachment | null>;
  teamMembers: MentionableMember[];
}

const EMOJI_LIST = ['👍', '❤️', '😂', '😮', '😢', '🎉', '🔥', '✅'];

// Helper to render message content with highlighted @mentions
const renderMessageWithMentions = (
  content: string,
  ctx: MentionContext,
  isOwn: boolean,
) => {
  const mentionRegex = /@([a-zA-Z0-9_.-]{1,32})/g;
  const parts: (string | JSX.Element)[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = mentionRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }
    const ref = match[1];
    const token = resolveMention(ref, ctx);

    if (token) {
      const isInactiveUser =
        token.kind === 'user' &&
        ctx.teamMembers.find((m) => m.id === token.userIds[0])?.is_active === false;

      const tint =
        token.kind === 'all'
          ? 'bg-destructive/15 text-destructive'
          : token.kind === 'role'
            ? 'bg-warning/15 text-warning'
            : token.kind === 'group'
              ? 'bg-primary/15 text-primary'
              : isOwn
                ? 'bg-primary-foreground/20 text-primary-foreground'
                : 'bg-primary/20 text-primary';

      parts.push(
        <span
          key={match.index}
          className={cn(
            'font-semibold px-1 rounded',
            isInactiveUser && 'opacity-60 line-through',
            tint,
          )}
          title={isInactiveUser ? 'Inactive teammate' : undefined}
        >
          {token.label}
          {isInactiveUser && ' (inactive)'}
        </span>,
      );
    } else {
      parts.push(match[0]);
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return parts.length > 0 ? parts : content;
};

const DateDivider = ({ date }: { date: Date }) => {
  let label = format(date, 'MMMM d, yyyy');
  if (isToday(date)) label = 'Today';
  else if (isYesterday(date)) label = 'Yesterday';

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-1 h-px bg-border" />
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
};

interface MessageBubbleProps {
  message: TeamMessage;
  isOwn: boolean;
  showAvatar: boolean;
  onReaction: (emoji: string) => void;
  onReply: () => void;
  onPin: () => void;
  onUnpin: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isPinned: boolean;
  teamMembers: { id: string; name: string }[];
  readers: { user_id: string; read_at: string }[];
  currentUserId?: string;
}

const MessageBubble = ({
  message,
  isOwn,
  showAvatar,
  onReaction,
  onReply,
  onPin,
  onUnpin,
  onEdit,
  onDelete,
  isPinned,
  teamMembers,
  readers,
  currentUserId
}: MessageBubbleProps) => {
  const [showActions, setShowActions] = useState(false);
  const initials = message.sender_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??';

  const renderAttachment = (attachment: Attachment, index: number) => {
    if (attachment.type.startsWith('image/')) {
      return (
        <a 
          key={index}
          href={attachment.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          <img 
            src={attachment.url} 
            alt={attachment.name}
            className="max-w-[300px] max-h-[200px] rounded-lg object-cover"
          />
        </a>
      );
    }
    
    return (
      <a
        key={index}
        href={attachment.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 p-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
      >
        <FileText className="h-4 w-4 text-primary" />
        <span className="text-sm truncate max-w-[150px]">{attachment.name}</span>
        <span className="text-xs text-muted-foreground">
          {(attachment.size / 1024).toFixed(1)}KB
        </span>
        <Download className="h-3 w-3 ml-auto" />
      </a>
    );
  };

  // Get other readers (exclude self)
  const otherReaders = readers.filter(r => r.user_id !== currentUserId);
  const hasBeenRead = otherReaders.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "group flex gap-2",
        isOwn ? "flex-row-reverse" : "flex-row"
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Avatar */}
      <div className={cn("w-8 flex-shrink-0", !showAvatar && "invisible")}>
        {showAvatar && (
          <Avatar className="h-8 w-8">
            <AvatarImage src={message.sender_avatar || undefined} />
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
        )}
      </div>

      {/* Message Content */}
      <div className={cn("flex flex-col max-w-[70%]", isOwn && "items-end")}>
        {showAvatar && (
          <div className={cn("flex items-center gap-2 mb-1", isOwn && "flex-row-reverse")}>
            <span className="text-xs font-medium">{message.sender_name}</span>
            <span className="text-[10px] text-muted-foreground">
              {format(new Date(message.created_at), 'h:mm a')}
            </span>
          </div>
        )}

        {/* Reply Reference */}
        {message.reply_message && (
          <div className={cn(
            "flex items-center gap-2 text-xs text-muted-foreground mb-1 px-2 py-1 rounded bg-muted/50 border-l-2 border-primary/50",
            isOwn && "flex-row-reverse"
          )}>
            <Reply className="h-3 w-3" />
            <span className="truncate max-w-[200px]">{message.reply_message.content}</span>
          </div>
        )}

        {/* Bubble */}
        <div className={cn(
          "rounded-2xl px-3 py-2 relative",
          isOwn 
            ? "bg-primary text-primary-foreground rounded-tr-sm" 
            : "bg-muted rounded-tl-sm",
          isPinned && "ring-2 ring-warning/50"
        )}>
          {message.content && (
            <p className="text-sm whitespace-pre-wrap break-words">
              {renderMessageWithMentions(message.content, teamMembers, isOwn)}
            </p>
          )}
          
          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-2 space-y-2">
              {message.attachments.map((att, i) => renderAttachment(att, i))}
            </div>
          )}

          {message.is_edited && (
            <span className="text-[10px] opacity-60 ml-1">(edited)</span>
          )}

          {isPinned && (
            <Pin className="absolute -top-1 -right-1 h-3 w-3 text-warning fill-warning" />
          )}
        </div>

        {/* Read receipts & Reactions row */}
        <div className={cn("flex items-center gap-2 mt-1", isOwn && "flex-row-reverse")}>
          {/* Read indicator for own messages */}
          {isOwn && (
            <div className="flex items-center">
              {hasBeenRead ? (
                <CheckCheck className="h-3 w-3 text-primary" />
              ) : (
                <Check className="h-3 w-3 text-muted-foreground" />
              )}
            </div>
          )}
          
          {/* Reactions */}
          {Object.keys(message.reactions || {}).length > 0 && (
            <div className="flex flex-wrap gap-1">
              {Object.entries(message.reactions).map(([emoji, userIds]) => (
                <Button
                  key={emoji}
                  variant="outline"
                  size="sm"
                  className="h-5 px-1.5 text-xs hover:scale-105 transition-transform"
                  onClick={() => onReaction(emoji)}
                >
                  {emoji} {userIds.length}
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <AnimatePresence>
          {showActions && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={cn(
                "flex items-center gap-0.5 mt-1 bg-background border border-border rounded-lg p-0.5 shadow-sm",
                isOwn && "flex-row-reverse"
              )}
            >
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <Smile className="h-3 w-3" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2" side="top">
                  <div className="flex gap-1">
                    {EMOJI_LIST.map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => onReaction(emoji)}
                        className="text-lg hover:scale-125 transition-transform p-1"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onReply}>
                <Reply className="h-3 w-3" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <MoreHorizontal className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align={isOwn ? "end" : "start"} className="w-40">
                  {isPinned ? (
                    <DropdownMenuItem onClick={onUnpin}>
                      <PinOff className="h-3 w-3 mr-2" />
                      Unpin message
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={onPin}>
                      <Pin className="h-3 w-3 mr-2" />
                      Pin message
                    </DropdownMenuItem>
                  )}
                  {isOwn && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={onEdit}>
                        <Edit className="h-3 w-3 mr-2" />
                        Edit message
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={onDelete} className="text-destructive">
                        <Trash2 className="h-3 w-3 mr-2" />
                        Delete message
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export const MessageThread = ({
  conversation,
  messages,
  loading,
  onSendMessage,
  onReaction,
  onUploadAttachment,
  teamMembers
}: MessageThreadProps) => {
  const { user } = useAuth();
  const [newMessage, setNewMessage] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [replyTo, setReplyTo] = useState<TeamMessage | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showMentionPopup, setShowMentionPopup] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [showSearch, setShowSearch] = useState(false);
  const [editingMessage, setEditingMessage] = useState<TeamMessage | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Use new hooks
  const { setTyping, getTypingUsers, onlineUsers } = usePresence(conversation.id);
  const { getReaders, markAsRead } = useReadReceipts(conversation.id);
  const { pinnedMessages, pinMessage, unpinMessage } = usePinnedMessages(conversation.id);
  const { searchResults, isSearching, searchQuery, searchMessages, clearSearch } = useMessageSearch(conversation.id);
  const { editMessage, deleteMessage, isEditing, isDeleting } = useMessageActions();

  // Get typing users for this conversation
  const typingUsers = getTypingUsers(conversation.id);
  const typingNames = typingUsers
    .filter(id => id !== user?.id)
    .map(id => teamMembers.find(m => m.id === id)?.name?.split(' ')[0] || 'Someone')
    .filter(Boolean);

  // Filter team members for mention autocomplete
  const filteredMembers = useMemo(() => {
    if (!mentionSearch) return teamMembers.filter(m => m.id !== user?.id);
    return teamMembers
      .filter(m => m.id !== user?.id)
      .filter(m => m.name.toLowerCase().includes(mentionSearch.toLowerCase()));
  }, [teamMembers, mentionSearch, user?.id]);

  // Parse mentions from message content
  const parseMentions = useCallback((content: string): string[] => {
    const mentionRegex = /@(\w+(?:\s+\w+)?)/g;
    const mentions: string[] = [];
    let match;
    
    while ((match = mentionRegex.exec(content)) !== null) {
      const mentionName = match[1];
      const matchedMember = teamMembers.find(m => 
        m.name.toLowerCase() === mentionName.toLowerCase() ||
        m.name.toLowerCase().startsWith(mentionName.toLowerCase())
      );
      if (matchedMember && !mentions.includes(matchedMember.id)) {
        mentions.push(matchedMember.id);
      }
    }
    return mentions;
  }, [teamMembers]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current && !showSearch) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, showSearch]);

  // Mark messages as read when viewing
  useEffect(() => {
    if (messages.length > 0 && user) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.sender_id !== user.id) {
        markAsRead(lastMessage.id);
      }
    }
  }, [messages, user, markAsRead]);

  // Handle typing indicator
  useEffect(() => {
    if (newMessage.length > 0) {
      setTyping(true);
    } else {
      setTyping(false);
    }
  }, [newMessage, setTyping]);

  const handleSend = async () => {
    if (!newMessage.trim() && attachments.length === 0) return;
    
    // Handle edit mode
    if (editingMessage) {
      await editMessage(editingMessage.id, newMessage.trim());
      setEditingMessage(null);
      setNewMessage('');
      return;
    }
    
    const mentions = parseMentions(newMessage);
    
    onSendMessage(
      newMessage.trim(),
      attachments,
      mentions,
      replyTo?.id
    );
    
    setNewMessage('');
    setAttachments([]);
    setReplyTo(null);
    setShowMentionPopup(false);
    setTyping(false);
  };

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursor = e.target.selectionStart || 0;
    setNewMessage(value);
    setCursorPosition(cursor);

    const textBeforeCursor = value.slice(0, cursor);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);
    
    if (atMatch) {
      setMentionSearch(atMatch[1]);
      setShowMentionPopup(true);
      setMentionIndex(0);
    } else {
      setShowMentionPopup(false);
      setMentionSearch('');
    }
  };

  const insertMention = (member: { id: string; name: string }) => {
    const textBeforeCursor = newMessage.slice(0, cursorPosition);
    const textAfterCursor = newMessage.slice(cursorPosition);
    
    const atMatch = textBeforeCursor.match(/@(\w*)$/);
    if (atMatch) {
      const beforeMention = textBeforeCursor.slice(0, atMatch.index);
      const firstName = member.name.split(' ')[0];
      const newText = beforeMention + '@' + firstName + ' ' + textAfterCursor;
      setNewMessage(newText);
      
      const newCursorPos = beforeMention.length + firstName.length + 2;
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
          textareaRef.current.focus();
        }
      }, 0);
    }
    
    setShowMentionPopup(false);
    setMentionSearch('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showMentionPopup && filteredMembers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex(prev => (prev + 1) % filteredMembers.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(prev => (prev - 1 + filteredMembers.length) % filteredMembers.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(filteredMembers[mentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        setShowMentionPopup(false);
        return;
      }
    }
    
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }

    if (e.key === 'Escape' && editingMessage) {
      setEditingMessage(null);
      setNewMessage('');
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setIsUploading(true);
    const newAttachments: Attachment[] = [];

    for (const file of Array.from(files)) {
      const attachment = await onUploadAttachment(file);
      if (attachment) {
        newAttachments.push(attachment);
      }
    }

    setAttachments(prev => [...prev, ...newAttachments]);
    setIsUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleEditMessage = (message: TeamMessage) => {
    setEditingMessage(message);
    setNewMessage(message.content);
    textareaRef.current?.focus();
  };

  const handleDeleteMessage = async (messageId: string) => {
    await deleteMessage(messageId);
  };

  const handlePinMessage = async (messageId: string) => {
    await pinMessage(messageId);
  };

  const handleUnpinMessage = async (messageId: string) => {
    await unpinMessage(messageId);
  };

  // Get pinned message IDs for quick lookup
  const pinnedMessageIds = new Set(pinnedMessages.map(m => m.id));

  // Decide which messages to display
  const displayMessages = showSearch && searchQuery ? searchResults : messages;

  // Group messages by date
  const groupedMessages: { date: Date; messages: TeamMessage[] }[] = [];
  let currentDate: string | null = null;

  displayMessages.forEach(msg => {
    const msgDate = format(new Date(msg.created_at), 'yyyy-MM-dd');
    if (msgDate !== currentDate) {
      currentDate = msgDate;
      groupedMessages.push({ date: new Date(msg.created_at), messages: [msg] });
    } else {
      groupedMessages[groupedMessages.length - 1].messages.push(msg);
    }
  });

  const getConversationIcon = () => {
    if (conversation.is_company_wide) return Megaphone;
    if (conversation.type === 'channel') return Hash;
    if (conversation.type === 'group') return Users;
    return null;
  };

  const Icon = getConversationIcon();

  // Check if the other user in DM is online
  const isOtherUserOnline = conversation.type === 'direct' && 
    conversation.other_user?.id && 
    onlineUsers.has(conversation.other_user.id);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b border-border">
          <Skeleton className="h-6 w-40" />
        </div>
        <div className="flex-1 p-4 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={cn("flex gap-2", i % 2 === 0 && "flex-row-reverse")}>
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-16 w-48 rounded-2xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar className="h-9 w-9">
              <AvatarImage src={conversation.type === 'direct' ? conversation.other_user?.avatar_url || undefined : conversation.avatar_url || undefined} />
              <AvatarFallback>
                {Icon ? <Icon className="h-4 w-4" /> : conversation.other_user?.name?.charAt(0) || 'C'}
              </AvatarFallback>
            </Avatar>
            {conversation.type === 'direct' && (
              <OnlineIndicator 
                isOnline={isOtherUserOnline}
                size="sm"
                className="absolute -bottom-0.5 -right-0.5"
              />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-sm flex items-center gap-2">
              {conversation.type === 'direct' 
                ? conversation.other_user?.name 
                : conversation.name}
              {conversation.is_company_wide && (
                <Badge variant="outline" className="text-[10px] px-1 py-0 bg-warning/10 text-warning border-warning/30">
                  Company-wide
                </Badge>
              )}
            </h3>
            {conversation.type !== 'direct' && conversation.members && (
              <p className="text-xs text-muted-foreground">
                {conversation.members.length} members
              </p>
            )}
            {conversation.type === 'direct' && (
              <p className="text-xs text-muted-foreground">
                {isOtherUserOnline ? 'Online' : 'Offline'}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button 
            variant={showSearch ? "secondary" : "ghost"} 
            size="icon" 
            className="h-8 w-8"
            onClick={() => {
              setShowSearch(!showSearch);
              if (showSearch) clearSearch();
            }}
          >
            <Search className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <AnimatePresence>
        {showSearch && (
          <MessageSearchBar
            searchQuery={searchQuery}
            searchResults={searchResults}
            isSearching={isSearching}
            onSearch={searchMessages}
            onClear={clearSearch}
            onResultClick={(messageId) => {
              const element = document.getElementById(`message-${messageId}`);
              if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                element.classList.add('bg-primary/20');
                setTimeout(() => element.classList.remove('bg-primary/20'), 2000);
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* Pinned Messages */}
      {pinnedMessages.length > 0 && !showSearch && (
        <PinnedMessagesBar 
          pinnedMessages={pinnedMessages}
          onUnpin={handleUnpinMessage}
          onMessageClick={(messageId) => {
            const element = document.getElementById(`message-${messageId}`);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
              element.classList.add('bg-primary/20');
              setTimeout(() => element.classList.remove('bg-primary/20'), 2000);
            }
          }}
        />
      )}

      {/* Messages */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-4 space-y-4">
          {groupedMessages.map((group, groupIndex) => (
            <div key={groupIndex}>
              <DateDivider date={group.date} />
              <div className="space-y-3">
                {group.messages.map((msg, msgIndex) => {
                  const prevMsg = msgIndex > 0 ? group.messages[msgIndex - 1] : null;
                  const showAvatar = !prevMsg || prevMsg.sender_id !== msg.sender_id;
                  const readers = getReaders(msg.id);
                  
                  return (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      isOwn={msg.sender_id === user?.id}
                      showAvatar={showAvatar}
                      onReaction={(emoji) => onReaction(msg.id, emoji)}
                      onReply={() => setReplyTo(msg)}
                      onPin={() => handlePinMessage(msg.id)}
                      onUnpin={() => handleUnpinMessage(msg.id)}
                      onEdit={() => handleEditMessage(msg)}
                      onDelete={() => handleDeleteMessage(msg.id)}
                      isPinned={pinnedMessageIds.has(msg.id)}
                      teamMembers={teamMembers}
                      readers={readers}
                      currentUserId={user?.id}
                    />
                  );
                })}
              </div>
            </div>
          ))}
          
          {displayMessages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
              {showSearch && searchQuery ? (
                <>
                  <Search className="h-10 w-10 mb-3 opacity-50" />
                  <p className="text-sm">No messages found</p>
                  <p className="text-xs">Try a different search term</p>
                </>
              ) : (
                <>
                  <Send className="h-10 w-10 mb-3 opacity-50" />
                  <p className="text-sm">No messages yet</p>
                  <p className="text-xs">Start the conversation!</p>
                </>
              )}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Typing Indicator */}
      <AnimatePresence>
        {typingNames.length > 0 && (
          <TypingIndicator names={typingNames} />
        )}
      </AnimatePresence>

      {/* Reply Preview */}
      <AnimatePresence>
        {replyTo && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 py-2 bg-muted/50 border-t border-border"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Reply className="h-4 w-4 text-primary" />
                <span className="text-muted-foreground">Replying to</span>
                <span className="font-medium">{replyTo.sender_name}</span>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setReplyTo(null)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground truncate ml-6">{replyTo.content}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Preview */}
      <AnimatePresence>
        {editingMessage && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 py-2 bg-warning/10 border-t border-warning/30"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Edit className="h-4 w-4 text-warning" />
                <span className="text-warning font-medium">Editing message</span>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                setEditingMessage(null);
                setNewMessage('');
              }}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Attachment Preview */}
      <AnimatePresence>
        {attachments.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 py-2 bg-muted/30 border-t border-border"
          >
            <div className="flex flex-wrap gap-2">
              {attachments.map((att, index) => (
                <div
                  key={index}
                  className="relative group"
                >
                  {att.type.startsWith('image/') ? (
                    <img src={att.url} alt={att.name} className="h-16 w-16 object-cover rounded-lg" />
                  ) : (
                    <div className="h-16 w-16 bg-muted rounded-lg flex items-center justify-center">
                      <FileText className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-5 w-5 absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeAttachment(index)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="p-3 border-t border-border relative">
        {/* Mention Autocomplete Popup */}
        <AnimatePresence>
          {showMentionPopup && filteredMembers.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-full left-3 right-3 mb-2 bg-popover border border-border rounded-lg shadow-lg max-h-[200px] overflow-y-auto z-50"
            >
              <div className="p-1">
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <AtSign className="h-3 w-3" />
                  Mention someone
                </div>
                {filteredMembers.slice(0, 6).map((member, index) => {
                  const isOnline = onlineUsers.has(member.id);
                  return (
                    <button
                      key={member.id}
                      onClick={() => insertMention(member)}
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors",
                        index === mentionIndex ? "bg-accent" : "hover:bg-muted"
                      )}
                    >
                      <div className="relative">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={member.avatar_url || undefined} />
                          <AvatarFallback className="text-[10px]">
                            {member.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <OnlineIndicator 
                          isOnline={isOnline} 
                          size="sm" 
                          className="absolute -bottom-0.5 -right-0.5" 
                        />
                      </div>
                      <span className="text-sm font-medium">{member.name}</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-end gap-2">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            multiple
            accept="image/*,.pdf,.doc,.docx,.txt"
            onChange={handleFileSelect}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 flex-shrink-0"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            ) : (
              <Paperclip className="h-4 w-4" />
            )}
          </Button>
          <Textarea
            ref={textareaRef}
            value={newMessage}
            onChange={handleMessageChange}
            onKeyDown={handleKeyDown}
            placeholder={editingMessage ? "Edit your message..." : "Type a message... (use @ to mention)"}
            className={cn(
              "min-h-[40px] max-h-[120px] resize-none",
              editingMessage && "border-warning focus-visible:ring-warning"
            )}
            rows={1}
          />
          <Button
            size="icon"
            className={cn("h-9 w-9 flex-shrink-0", editingMessage && "bg-warning hover:bg-warning/90")}
            onClick={handleSend}
            disabled={(!newMessage.trim() && attachments.length === 0) || isEditing || isDeleting}
          >
            {editingMessage ? <Check className="h-4 w-4" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
};
