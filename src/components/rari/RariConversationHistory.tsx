import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { MessageSquare, Trash2, Download, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { useRariConversationPersistence } from '@/hooks/useRariConversationPersistence';
import { formatConversationDuration } from '@/lib/transcriptUtils';

interface RariConversation {
  id: string;
  session_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  message_count: number;
  summary: string | null;
}

export const RariConversationHistory = () => {
  const [conversations, setConversations] = useState<RariConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  
  const {
    getConversationHistory,
    deleteConversation,
  } = useRariConversationPersistence();

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    setLoading(true);
    const data = await getConversationHistory(50);
    setConversations(data);
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!selectedConversationId) return;
    
    const success = await deleteConversation(selectedConversationId);
    if (success) {
      setConversations(prev => prev.filter(c => c.id !== selectedConversationId));
    }
    setDeleteDialogOpen(false);
    setSelectedConversationId(null);
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'Unknown';
    
    if (seconds < 60) return `${seconds}s`;
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes < 60) {
      return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
    }
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  return (
    <Card className="p-6 glass-card">
      <div className="flex items-center justify-between mb-4 pb-3 border-b">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-gulf-blue" />
            Conversation History
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <ScrollArea className="h-[500px] pr-4">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <p className="text-sm text-muted-foreground">Loading conversations...</p>
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mb-4 opacity-20" />
            <p className="text-sm">No conversation history yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {conversations.map((conversation) => (
              <Card 
                key={conversation.id}
                className="p-4 hover:bg-accent/50 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="h-4 w-4 text-gulf-blue flex-shrink-0" />
                      <span className="text-sm font-medium">
                        {format(new Date(conversation.started_at), 'PPp')}
                      </span>
                      {!conversation.ended_at && (
                        <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/20">
                          Active
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {conversation.message_count} message{conversation.message_count !== 1 ? 's' : ''}
                      </span>
                      {conversation.duration_seconds && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDuration(conversation.duration_seconds)}
                        </span>
                      )}
                    </div>

                    {conversation.summary && (
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                        {conversation.summary}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        // TODO: Implement export for individual conversation
                      }}
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedConversationId(conversation.id);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this conversation and all its messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
