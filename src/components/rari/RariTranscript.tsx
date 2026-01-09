import { useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RariMessage } from './RariMessage';
import { TranscriptHeader } from './TranscriptHeader';
import { cn } from '@/lib/utils';
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
  partialTranscript?: string;
  onClear?: () => void;
  compact?: boolean;
}

export const RariTranscript = ({
  messages,
  isConnected,
  conversationId,
  conversationDbId,
  startTime,
  partialTranscript = '',
  onClear,
  compact = false,
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
    <Card className={cn(
      "glass-card flex flex-col h-full",
      compact ? "p-2 min-h-0" : "p-3 md:p-4 lg:p-6 min-h-[500px] lg:min-h-[600px]"
    )}>
      {!compact && (
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
      )}
      
      <ScrollArea className={cn("flex-1 pr-2", !compact && "mt-3 md:mt-4 md:pr-4")} ref={scrollRef}>
        {messages.length === 0 && !partialTranscript ? (
          <div className="flex flex-col items-center justify-center h-[300px] md:h-[400px] text-muted-foreground">
            <MessageSquare className="h-10 w-10 md:h-12 md:w-12 mb-3 md:mb-4 opacity-20" />
            <p className="text-xs md:text-sm text-center px-4">
              {isConnected 
                ? "Start speaking — your conversation transcript will appear here in real-time..."
                : "Start a conversation to see the live transcript"}
            </p>
            {isConnected && (
              <p className="text-xs text-muted-foreground/60 mt-2 text-center px-4">
                Phone numbers, customer names, and booking IDs will be clickable
              </p>
            )}
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
            
            {/* Partial transcript - shows what user is currently saying */}
            {partialTranscript && (
              <div className="flex justify-end mb-2 animate-in fade-in slide-in-from-right duration-200">
                <div className="max-w-[85%] md:max-w-[75%] bg-gulf-blue/10 text-foreground rounded-2xl px-3 py-2 md:px-4 md:py-2.5 border border-gulf-blue/20">
                  <p className="text-xs md:text-sm italic text-muted-foreground">
                    {partialTranscript}
                    <span className="inline-block w-1 h-4 ml-1 bg-gulf-blue animate-pulse" />
                  </p>
                </div>
              </div>
            )}
            
            <div ref={endOfMessagesRef} />
          </div>
        )}
      </ScrollArea>
    </Card>
  );
};
