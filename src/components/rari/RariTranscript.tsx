import { useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RariMessage } from './RariMessage';
import { TranscriptHeader } from './TranscriptHeader';
import { 
  exportTranscriptAsPDF, 
  exportTranscriptAsTXT, 
  exportTranscriptAsJSON,
  downloadFile,
  type Message,
  type ConversationMetadata 
} from '@/lib/transcriptUtils';
import { format } from 'date-fns';
import { MessageSquare } from 'lucide-react';

interface RariTranscriptProps {
  messages: Message[];
  isConnected: boolean;
  conversationId: string | null;
  conversationDbId?: string | null;
  startTime?: Date;
  onClear?: () => void;
}

export const RariTranscript = ({
  messages,
  isConnected,
  conversationId,
  conversationDbId,
  startTime,
  onClear,
}: RariTranscriptProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (endOfMessagesRef.current) {
      endOfMessagesRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleExportPDF = () => {
    if (messages.length === 0) return;
    
    const metadata: ConversationMetadata = {
      conversationId: conversationId || 'unknown',
      startTime: startTime || messages[0].timestamp,
      endTime: isConnected ? undefined : new Date(),
      messageCount: messages.length,
    };
    
    exportTranscriptAsPDF(messages, metadata);
  };

  const handleExportTXT = () => {
    if (messages.length === 0) return;
    
    const content = exportTranscriptAsTXT(messages);
    const filename = `rari-transcript-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.txt`;
    downloadFile(content, filename, 'text/plain');
  };

  const handleExportJSON = () => {
    if (messages.length === 0) return;
    
    const content = exportTranscriptAsJSON(messages);
    const filename = `rari-transcript-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.json`;
    downloadFile(content, filename, 'application/json');
  };

  return (
    <Card className="p-6 glass-card flex flex-col h-full">
      <TranscriptHeader
        messageCount={messages.length}
        startTime={startTime}
        isConnected={isConnected}
        conversationDbId={conversationDbId}
        onExportPDF={handleExportPDF}
        onExportTXT={handleExportTXT}
        onExportJSON={handleExportJSON}
        onClear={onClear}
      />
      
      <ScrollArea className="flex-1 mt-4 pr-4" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
            <MessageSquare className="h-12 w-12 mb-4 opacity-20" />
            <p className="text-sm">
              {isConnected 
                ? "Conversation transcript will appear here..."
                : "Start a conversation to see the transcript"}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {messages.map((msg, idx) => {
              const prevMsg = idx > 0 ? messages[idx - 1] : null;
              const showAvatar = !prevMsg || prevMsg.role !== msg.role;
              
              return (
                <RariMessage
                  key={idx}
                  message={msg}
                  isOwn={msg.role === 'user'}
                  showAvatar={showAvatar}
                />
              );
            })}
            <div ref={endOfMessagesRef} />
          </div>
        )}
      </ScrollArea>
    </Card>
  );
};
