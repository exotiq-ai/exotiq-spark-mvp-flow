import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTeamMessaging } from '@/hooks/useTeamMessaging';
import { useAuth } from '@/contexts/AuthContext';
import { ConversationList } from './ConversationList';
import { MessageThread } from './MessageThread';
import { NewConversationDialog } from './NewConversationDialog';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, 
  ChevronLeft, 
  X,
  Minimize2,
  Maximize2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TeamMessagingProps {
  isOpen: boolean;
  onClose: () => void;
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
}

export const TeamMessaging = ({
  isOpen,
  onClose,
  isMinimized,
  onToggleMinimize
}: TeamMessagingProps) => {
  const { user } = useAuth();
  const {
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
  } = useTeamMessaging();

  const [showNewConversation, setShowNewConversation] = useState(false);
  const [showMobileThread, setShowMobileThread] = useState(false);

  // Calculate total unread count
  const totalUnread = conversations.reduce((acc, c) => acc + (c.unread_count || 0), 0);

  const handleSelectConversation = (conversation: typeof activeConversation) => {
    setActiveConversation(conversation);
    setShowMobileThread(true);
  };

  const handleBackToList = () => {
    setShowMobileThread(false);
    setActiveConversation(null);
  };

  const handleCreateConversation = async (
    type: 'direct' | 'group' | 'channel',
    memberIds: string[],
    name?: string,
    description?: string,
    isCompanyWide?: boolean
  ) => {
    const conv = await createConversation(type, memberIds, name, description, isCompanyWide);
    if (conv) {
      setShowMobileThread(true);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={isMinimized 
            ? { opacity: 1, y: 0, scale: 1, height: 56 }
            : { opacity: 1, y: 0, scale: 1, height: 'auto' }
          }
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className={cn(
            "fixed z-50 shadow-2xl overflow-hidden bg-background border border-border",
            isMinimized 
              ? "bottom-4 right-4 w-64 rounded-xl" 
              : "inset-0 md:inset-auto md:bottom-4 md:right-4 md:rounded-xl md:w-[400px] lg:w-[700px]"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-muted/50 border-b border-border">
            <div className="flex items-center gap-2">
              {showMobileThread && !isMinimized && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 md:hidden"
                  onClick={handleBackToList}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}
              <MessageSquare className="h-5 w-5 text-primary" />
              <span className="font-semibold">Team Chat</span>
              {totalUnread > 0 && (
                <Badge variant="destructive" className="text-xs px-1.5 py-0">
                  {totalUnread > 99 ? '99+' : totalUnread}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onToggleMinimize}
              >
                {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Content */}
          {!isMinimized && (
            <div className="flex h-[500px]">
              {/* Conversation List - Hidden on mobile when thread is open */}
              <div className={cn(
                "w-full md:w-[280px] border-r border-border flex-shrink-0",
                showMobileThread && "hidden md:block"
              )}>
                <ConversationList
                  conversations={conversations}
                  activeConversation={activeConversation}
                  onSelect={handleSelectConversation}
                  onNewConversation={() => setShowNewConversation(true)}
                  loading={loading}
                />
              </div>

              {/* Message Thread */}
              <div className={cn(
                "flex-1",
                !showMobileThread && "hidden md:block"
              )}>
                {activeConversation ? (
                  <MessageThread
                    conversation={activeConversation}
                    messages={messages}
                    loading={messagesLoading}
                    onSendMessage={sendMessage}
                    onReaction={addReaction}
                    onUploadAttachment={uploadAttachment}
                    teamMembers={teamMembers}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
                    <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
                    <h3 className="font-medium text-lg mb-1">Team Chat</h3>
                    <p className="text-sm text-center mb-4">
                      Select a conversation or start a new one to begin chatting with your team
                    </p>
                    <Button onClick={() => setShowNewConversation(true)}>
                      Start a Conversation
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* New Conversation Dialog */}
      <NewConversationDialog
        open={showNewConversation}
        onOpenChange={setShowNewConversation}
        teamMembers={teamMembers}
        onCreateConversation={handleCreateConversation}
        currentUserId={user?.id}
      />
    </>
  );
};

// Floating trigger button for opening chat
export const TeamMessagingTrigger = ({
  onClick,
  unreadCount
}: {
  onClick: () => void;
  unreadCount: number;
}) => (
  <motion.button
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
    onClick={onClick}
    className="fixed bottom-24 md:bottom-4 right-4 z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:shadow-xl transition-shadow"
  >
    <MessageSquare className="h-6 w-6" />
    {unreadCount > 0 && (
      <div className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs font-bold min-w-[20px] h-5 rounded-full flex items-center justify-center px-1">
        {unreadCount > 99 ? '99+' : unreadCount}
      </div>
    )}
  </motion.button>
);
