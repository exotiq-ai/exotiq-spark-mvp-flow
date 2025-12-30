import { useState } from 'react';
import { MessageSquare, Download, Search, Trash2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { formatConversationDuration } from '@/lib/transcriptUtils';
import { RariSearchDialog } from './RariSearchDialog';
import { EmailSummaryButton } from './EmailSummaryButton';

interface TranscriptHeaderProps {
  messageCount: number;
  startTime?: Date;
  endTime?: Date;
  isConnected: boolean;
  conversationDbId?: string | null;
  onExportTXT: () => void;
  onExportJSON: () => void;
  onExportPDF: () => void;
  onClear?: () => void;
}

export const TranscriptHeader = ({
  messageCount,
  startTime,
  endTime,
  isConnected,
  conversationDbId,
  onExportTXT,
  onExportJSON,
  onExportPDF,
  onClear,
}: TranscriptHeaderProps) => {
  const [searchOpen, setSearchOpen] = useState(false);
  
  const duration = startTime 
    ? formatConversationDuration(startTime, isConnected ? undefined : endTime)
    : null;

  return (
    <>
      <RariSearchDialog 
        open={searchOpen} 
        onOpenChange={setSearchOpen}
      />
    <div className="flex items-center justify-between pb-3 border-b">
      <div>
        <h3 className="font-semibold flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-gulf-blue" />
          Conversation Transcript
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          {messageCount} message{messageCount !== 1 ? 's' : ''}
          {duration && ` • ${duration}`}
          {isConnected && (
            <span className="ml-1 inline-flex items-center">
              <span className="animate-pulse text-success">● </span>
              <span className="ml-1">Live</span>
            </span>
          )}
        </p>
      </div>
      
      <div className="flex gap-2">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => setSearchOpen(true)}
        >
          <Search className="h-3 w-3 mr-1" />
          Search
        </Button>

        {conversationDbId && !isConnected && (
          <EmailSummaryButton
            conversationId={conversationDbId}
            disabled={messageCount === 0}
          />
        )}
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm"
              disabled={messageCount === 0}
            >
              <Download className="h-3 w-3 mr-1" />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onExportPDF}>
              Export as PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onExportTXT}>
              Export as TXT
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onExportJSON}>
              Export as JSON
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {onClear && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            disabled={messageCount === 0}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
    </>
  );
};
