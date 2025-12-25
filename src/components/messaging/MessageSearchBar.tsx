import React, { useState } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TeamMessage } from '@/hooks/useTeamMessaging';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface MessageSearchBarProps {
  searchQuery: string;
  searchResults: TeamMessage[];
  isSearching: boolean;
  onSearch: (query: string) => void;
  onClear: () => void;
  onResultClick: (messageId: string) => void;
}

export const MessageSearchBar: React.FC<MessageSearchBarProps> = ({
  searchQuery,
  searchResults,
  isSearching,
  onSearch,
  onClear,
  onResultClick,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onSearch(inputValue.trim());
      setIsExpanded(true);
    }
  };

  const handleClear = () => {
    setInputValue('');
    onClear();
    setIsExpanded(false);
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="bg-primary/30 text-foreground rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className="relative">
      <form onSubmit={handleSearch} className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Search messages..."
            className="pl-9 pr-9 h-9 bg-background/50"
          />
          {(inputValue || searchQuery) && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={handleClear}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        {isSearching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </form>

      {/* Search Results Dropdown */}
      {isExpanded && searchResults.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-popover border border-border rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-border bg-muted/30">
            <span className="text-xs text-muted-foreground">
              {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for "{searchQuery}"
            </span>
          </div>
          <ScrollArea className="max-h-64">
            {searchResults.map((message) => (
              <button
                key={message.id}
                onClick={() => {
                  onResultClick(message.id);
                  setIsExpanded(false);
                }}
                className={cn(
                  "w-full text-left px-3 py-2.5 hover:bg-accent/50 transition-colors",
                  "border-b border-border/50 last:border-0"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-foreground">
                    {message.sender_name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(message.created_at!), 'MMM d, h:mm a')}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {highlightMatch(message.content, searchQuery)}
                </p>
              </button>
            ))}
          </ScrollArea>
        </div>
      )}

      {isExpanded && searchQuery && searchResults.length === 0 && !isSearching && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-popover border border-border rounded-lg shadow-xl z-50 p-4 text-center">
          <p className="text-sm text-muted-foreground">No messages found for "{searchQuery}"</p>
        </div>
      )}
    </div>
  );
};
