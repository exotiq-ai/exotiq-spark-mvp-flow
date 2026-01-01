import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  MessageSquare, 
  Clock, 
  Calendar,
  ChevronRight,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useRariConversationPersistence } from '@/hooks/useRariConversationPersistence';
import { formatConversationDuration } from '@/lib/transcriptUtils';
import { cn } from '@/lib/utils';

interface RariConversationHistoryProps {
  onSelectConversation?: (conversationId: string) => void;
  className?: string;
}

export const RariConversationHistory = ({
  onSelectConversation,
  className,
}: RariConversationHistoryProps) => {
  const { getConversationHistory } = useRariConversationPersistence();
  const [conversations, setConversations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const history = await getConversationHistory(20);
      setConversations(history);
    } catch (err: any) {
      console.error('[Rari History] Error loading history:', err);
      setError('Failed to load conversation history');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card className={cn("p-6 glass-card", className)}>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-gulf-blue mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Loading conversations...</p>
          </div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cn("p-6 glass-card", className)}>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button onClick={loadHistory} variant="outline" size="sm">
              Try Again
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  if (conversations.length === 0) {
    return (
      <Card className={cn("p-6 glass-card", className)}>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-sm text-muted-foreground">No conversations yet</p>
            <p className="text-xs text-muted-foreground mt-2">
              Start a conversation with Rari to see it here
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn("p-4 md:p-6 glass-card flex flex-col", className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-gulf-blue" />
          <h3 className="font-semibold">Conversation History</h3>
        </div>
        <Badge variant="outline" className="text-xs">
          {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      <ScrollArea className="flex-1 -mx-4 px-4">
        <div className="space-y-2">
          {conversations.map((conversation) => (
            <ConversationCard
              key={conversation.id}
              conversation={conversation}
              onClick={() => onSelectConversation?.(conversation.id)}
            />
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
};

interface ConversationCardProps {
  conversation: any;
  onClick?: () => void;
}

const ConversationCard = ({ conversation, onClick }: ConversationCardProps) => {
  const startTime = new Date(conversation.started_at);
  const duration = conversation.duration_seconds 
    ? formatConversationDuration(startTime, conversation.ended_at ? new Date(conversation.ended_at) : undefined)
    : 'In progress';

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 rounded-lg border border-border/50 hover:border-gulf-blue/50 hover:bg-accent/5 transition-all duration-200 group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <span className="text-sm font-medium truncate">
              {startTime.toLocaleDateString()} {startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              <span>{conversation.message_count || 0} messages</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{duration}</span>
            </div>
          </div>

          {conversation.summary && (
            <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
              {conversation.summary}
            </p>
          )}
        </div>

        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-gulf-blue transition-colors flex-shrink-0" />
      </div>
    </button>
  );
};
