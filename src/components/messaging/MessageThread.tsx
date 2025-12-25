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
import { Conversation, TeamMessage, Attachment } from '@/hooks/useTeamMessaging';
import { useAuth } from '@/contexts/AuthContext';
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
  Trash2,
  Edit,
  Hash,
  Users,
  Megaphone,
  X,
  Download,
  FileText,
  AtSign
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MessageThreadProps {
  conversation: Conversation;
  messages: TeamMessage[];
  loading?: boolean;
  onSendMessage: (content: string, attachments?: Attachment[], mentions?: string[], replyTo?: string) => void;
  onReaction: (messageId: string, emoji: string) => void;
  onUploadAttachment: (file: File) => Promise<Attachment | null>;
  teamMembers: { id: string; name: string; email?: string; avatar_url: string | null }[];
}

const EMOJI_LIST = ['👍', '❤️', '😂', '😮', '😢', '🎉', '🔥', '✅'];

// Helper to render message content with highlighted @mentions
const renderMessageWithMentions = (content: string, teamMembers: { id: string; name: string }[], isOwn: boolean) => {
  // Match @mentions pattern
  const mentionRegex = /@(\w+(?:\s+\w+)?)/g;
  const parts: (string | JSX.Element)[] = [];
  let lastIndex = 0;
  let match;

  while ((match = mentionRegex.exec(content)) !== null) {
    // Add text before the mention
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }
    
    // Check if this matches a team member
    const mentionName = match[1];
    const matchedMember = teamMembers.find(m => 
      m.name.toLowerCase().includes(mentionName.toLowerCase())
    );
    
    if (matchedMember) {
      parts.push(
        <span 
          key={match.index} 
          className={cn(
            "font-semibold px-1 rounded",
            isOwn ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/20 text-primary"
          )}
        >
          @{mentionName}
        </span>
      );
    } else {
      parts.push(match[0]);
    }
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
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

const MessageBubble = ({
  message,
  isOwn,
  showAvatar,
  onReaction,
  onReply,
  teamMembers
}: {
  message: TeamMessage;
  isOwn: boolean;
  showAvatar: boolean;
  onReaction: (emoji: string) => void;
  onReply: () => void;
  teamMembers: { id: string; name: string }[];
}) => {
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
            : "bg-muted rounded-tl-sm"
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

          {message.is_pinned && (
            <Pin className="absolute -top-1 -right-1 h-3 w-3 text-warning fill-warning" />
          )}
        </div>

        {/* Reactions */}
        {Object.keys(message.reactions || {}).length > 0 && (
          <div className={cn("flex flex-wrap gap-1 mt-1", isOwn && "justify-end")}>
            {Object.entries(message.reactions).map(([emoji, userIds]) => (
              <Button
                key={emoji}
                variant="outline"
                size="sm"
                className="h-6 px-1.5 text-xs hover:scale-105 transition-transform"
                onClick={() => onReaction(emoji)}
              >
                {emoji} {userIds.length}
              </Button>
            ))}
          </div>
        )}

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
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <MoreHorizontal className="h-3 w-3" />
              </Button>
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!newMessage.trim() && attachments.length === 0) return;
    
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
  };

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursor = e.target.selectionStart || 0;
    setNewMessage(value);
    setCursorPosition(cursor);

    // Check for @mention trigger
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
    
    // Find and replace the @search with @Name
    const atMatch = textBeforeCursor.match(/@(\w*)$/);
    if (atMatch) {
      const beforeMention = textBeforeCursor.slice(0, atMatch.index);
      const firstName = member.name.split(' ')[0];
      const newText = beforeMention + '@' + firstName + ' ' + textAfterCursor;
      setNewMessage(newText);
      
      // Move cursor after the inserted mention
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

  // Group messages by date and consecutive sender
  const groupedMessages: { date: Date; messages: TeamMessage[] }[] = [];
  let currentDate: string | null = null;

  messages.forEach(msg => {
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
          <Avatar className="h-9 w-9">
            <AvatarImage src={conversation.type === 'direct' ? conversation.other_user?.avatar_url || undefined : conversation.avatar_url || undefined} />
            <AvatarFallback>
              {Icon ? <Icon className="h-4 w-4" /> : conversation.other_user?.name?.charAt(0) || 'C'}
            </AvatarFallback>
          </Avatar>
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
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </div>

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
                  
                  return (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      isOwn={msg.sender_id === user?.id}
                      showAvatar={showAvatar}
                      onReaction={(emoji) => onReaction(msg.id, emoji)}
                      onReply={() => setReplyTo(msg)}
                      teamMembers={teamMembers}
                    />
                  );
                })}
              </div>
            </div>
          ))}
          
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
              <Send className="h-10 w-10 mb-3 opacity-50" />
              <p className="text-sm">No messages yet</p>
              <p className="text-xs">Start the conversation!</p>
            </div>
          )}
        </div>
      </ScrollArea>

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
                {filteredMembers.slice(0, 6).map((member, index) => (
                  <button
                    key={member.id}
                    onClick={() => insertMention(member)}
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors",
                      index === mentionIndex ? "bg-accent" : "hover:bg-muted"
                    )}
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={member.avatar_url || undefined} />
                      <AvatarFallback className="text-[10px]">
                        {member.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{member.name}</span>
                  </button>
                ))}
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
            placeholder="Type a message... (use @ to mention)"
            className="min-h-[40px] max-h-[120px] resize-none"
            rows={1}
          />
          <Button
            size="icon"
            className="h-9 w-9 flex-shrink-0"
            onClick={handleSend}
            disabled={!newMessage.trim() && attachments.length === 0}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
