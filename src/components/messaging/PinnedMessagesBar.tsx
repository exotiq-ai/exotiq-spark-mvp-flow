import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Pin, ChevronDown, X } from 'lucide-react';
import { TeamMessage } from '@/hooks/useTeamMessaging';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface PinnedMessagesBarProps {
  pinnedMessages: { message?: TeamMessage }[];
  onUnpin: (messageId: string) => void;
  onJumpToMessage?: (messageId: string) => void;
}

export const PinnedMessagesBar = ({ 
  pinnedMessages, 
  onUnpin,
  onJumpToMessage 
}: PinnedMessagesBarProps) => {
  const [isOpen, setIsOpen] = useState(false);

  if (pinnedMessages.length === 0) return null;

  const validPins = pinnedMessages.filter(p => p.message);

  if (validPins.length === 0) return null;

  // Show single pinned message inline
  if (validPins.length === 1) {
    const pin = validPins[0];
    return (
      <div 
        className="flex items-center gap-2 px-3 py-2 bg-warning/10 border-b border-warning/20 cursor-pointer hover:bg-warning/15 transition-colors"
        onClick={() => pin.message && onJumpToMessage?.(pin.message.id)}
      >
        <Pin className="h-3.5 w-3.5 text-warning flex-shrink-0" />
        <span className="text-xs font-medium text-warning flex-shrink-0">Pinned</span>
        <span className="text-xs text-foreground truncate flex-1">
          {pin.message?.content}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 flex-shrink-0 opacity-50 hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            pin.message && onUnpin(pin.message.id);
          }}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  // Collapsible for multiple pinned messages
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <div className="flex items-center gap-2 px-3 py-2 bg-warning/10 border-b border-warning/20 cursor-pointer hover:bg-warning/15 transition-colors">
          <Pin className="h-3.5 w-3.5 text-warning" />
          <span className="text-xs font-medium text-warning">Pinned Messages</span>
          <Badge variant="outline" className="text-[10px] px-1 py-0 bg-warning/10 text-warning border-warning/30">
            {validPins.length}
          </Badge>
          <ChevronDown className={cn(
            "h-3.5 w-3.5 ml-auto transition-transform text-warning",
            isOpen && "transform rotate-180"
          )} />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ScrollArea className="max-h-[150px]">
          <div className="p-2 space-y-1 bg-muted/30">
            {validPins.map((pin) => (
              <div
                key={pin.message!.id}
                className="flex items-start gap-2 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => onJumpToMessage?.(pin.message!.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">{pin.message?.sender_name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {format(new Date(pin.message!.created_at), 'MMM d, h:mm a')}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {pin.message?.content}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 flex-shrink-0 opacity-50 hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUnpin(pin.message!.id);
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CollapsibleContent>
    </Collapsible>
  );
};
