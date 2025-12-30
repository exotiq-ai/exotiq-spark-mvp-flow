import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Search, MessageSquare, Clock, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useRariSearch } from '@/hooks/useRariSearch';
import { useDebounce } from '@/hooks/useDebounce';

interface RariSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const RariSearchDialog = ({ open, onOpenChange }: RariSearchDialogProps) => {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  
  const { searchMessages, searchResults, isSearching, clearSearch } = useRariSearch();

  useEffect(() => {
    if (debouncedQuery.trim()) {
      searchMessages(debouncedQuery);
    } else {
      clearSearch();
    }
  }, [debouncedQuery, searchMessages, clearSearch]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      clearSearch();
    }
  }, [open, clearSearch]);

  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, idx) => 
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={idx} className="bg-yellow-200 dark:bg-yellow-900/50 rounded px-0.5">
          {part}
        </mark>
      ) : part
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Search Conversations</DialogTitle>
          <DialogDescription>
            Search across all your Rari conversation history
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search messages..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
            autoFocus
          />
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
          )}
        </div>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {!query.trim() ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <Search className="h-12 w-12 mb-4 opacity-20" />
              <p className="text-sm">Start typing to search conversations</p>
            </div>
          ) : searchResults.length === 0 && !isSearching ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <Search className="h-12 w-12 mb-4 opacity-20" />
              <p className="text-sm">No results found</p>
            </div>
          ) : (
            <div className="space-y-3 py-2">
              {searchResults.map((result) => (
                <div
                  key={result.message_id}
                  className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-gulf-blue flex-shrink-0" />
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(result.conversation_started_at), 'PPp')}
                      </span>
                    </div>
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${
                        result.role === 'user' 
                          ? 'bg-primary/10 text-primary border-primary/20' 
                          : 'bg-gulf-blue/10 text-gulf-blue border-gulf-blue/20'
                      }`}
                    >
                      {result.role === 'user' ? 'You' : 'Rari'}
                    </Badge>
                  </div>
                  
                  <p className="text-sm leading-relaxed">
                    {highlightMatch(result.content, query)}
                  </p>

                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{format(new Date(result.timestamp), 'HH:mm')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
