import React, { useState } from 'react';
import { Pin, ChevronDown, ChevronUp, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface PinnedMessage {
  id: string;
  message_id: string;
  pinned_at: string;
  pinned_by: string;
  message?: {
    id: string;
    content: string;
    sender_name?: string;
    created_at?: string;
  };
}

interface PinnedMessagesBarProps {
  pinnedMessages: PinnedMessage[];
  onUnpin: (messageId: string) => void;
  onMessageClick: (messageId: string) => void;
}

export const PinnedMessagesBar: React.FC<PinnedMessagesBarProps> = ({
  pinnedMessages,
  onUnpin,
  onMessageClick,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (pinnedMessages.length === 0) return null;

  const latestPinned = pinnedMessages[0];

  return (
    <div className="border-b border-border bg-accent/20">
      {/* Collapsed View - Single Pinned Message */}
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-accent/30 transition-colors",
          isExpanded && "border-b border-border/50"
        )}
        onClick={() => pinnedMessages.length > 1 && setIsExpanded(!isExpanded)}
      >
        <Pin className="h-4 w-4 text-primary shrink-0" />
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (latestPinned.message) {
              onMessageClick(latestPinned.message_id);
            }
          }}
          className="flex-1 text-left min-w-0"
        >
          <p className="text-sm text-foreground truncate">
            {latestPinned.message?.content || 'Pinned message'}
          </p>
          {latestPinned.message?.sender_name && (
            <p className="text-xs text-muted-foreground">
              by {latestPinned.message.sender_name}
            </p>
          )}
        </button>

        <div className="flex items-center gap-1 shrink-0">
          {pinnedMessages.length > 1 && (
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              +{pinnedMessages.length - 1} more
            </span>
          )}
          
          {pinnedMessages.length > 1 && (
            <Button variant="ghost" size="icon" className="h-6 w-6">
              {isExpanded ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </Button>
          )}
          
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onUnpin(latestPinned.message_id);
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Expanded View - All Pinned Messages */}
      <AnimatePresence>
        {isExpanded && pinnedMessages.length > 1 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <ScrollArea className="max-h-48">
              {pinnedMessages.slice(1).map((pinned) => (
                <div
                  key={pinned.id}
                  className="flex items-center gap-3 px-4 py-2 hover:bg-accent/30 transition-colors border-b border-border/30 last:border-0"
                >
                  <div className="w-4" /> {/* Spacer to align with pin icon */}
                  
                  <button
                    onClick={() => onMessageClick(pinned.message_id)}
                    className="flex-1 text-left min-w-0"
                  >
                    <p className="text-sm text-foreground truncate">
                      {pinned.message?.content || 'Pinned message'}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {pinned.message?.sender_name && (
                        <span>by {pinned.message.sender_name}</span>
                      )}
                      <span>•</span>
                      <span>{format(new Date(pinned.pinned_at), 'MMM d')}</span>
                    </div>
                  </button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => onUnpin(pinned.message_id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
