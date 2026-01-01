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
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b gap-3 sm:gap-0">
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold flex items-center gap-2 text-sm md:text-base">
          <MessageSquare className="h-3.5 w-3.5 md:h-4 md:w-4 text-gulf-blue flex-shrink-0" />
          <span className="truncate">Conversation Transcript</span>
        </h3>
        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 flex-wrap">
          <span>{messageCount} message{messageCount !== 1 ? 's' : ''}</span>
          {duration && <span className="hidden sm:inline">• {duration}</span>}
          {isConnected && (
            <span className="inline-flex items-center gap-1 ml-1 sm:ml-0">
              <span className="flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-success opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
              </span>
              <span className="text-success font-medium">Live</span>
            </span>
          )}
        </p>
      </div>
      
      <div className="flex gap-1.5 md:gap-2 flex-shrink-0">
        {/* Mobile: Icon only, Desktop: Icon + Text */}
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => setSearchOpen(true)}
          className="h-8 md:h-9"
        >
          <Search className="h-3 w-3 md:mr-1" />
          <span className="hidden md:inline">Search</span>
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
              className="h-8 md:h-9"
            >
              <Download className="h-3 w-3 md:mr-1" />
              <span className="hidden md:inline">Export</span>
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
            className="h-8 md:h-9"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
    </>
  );
};
