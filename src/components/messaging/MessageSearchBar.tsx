import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, X, ChevronUp, ChevronDown } from 'lucide-react';
import { TeamMessage } from '@/hooks/useTeamMessaging';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/utils';

interface MessageSearchBarProps {
  isOpen: boolean;
  onClose: () => void;
  searchResults: TeamMessage[];
  isSearching: boolean;
  onSearch: (query: string) => void;
  onJumpToMessage?: (messageId: string) => void;
}

export const MessageSearchBar = ({
  isOpen,
  onClose,
  searchResults,
  isSearching,
  onSearch,
  onJumpToMessage,
}: MessageSearchBarProps) => {
  const [query, setQuery] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (debouncedQuery) {
      onSearch(debouncedQuery);
      setCurrentIndex(0);
    }
  }, [debouncedQuery, onSearch]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handlePrev = () => {
    if (searchResults.length > 0) {
      const newIndex = (currentIndex - 1 + searchResults.length) % searchResults.length;
      setCurrentIndex(newIndex);
      onJumpToMessage?.(searchResults[newIndex].id);
    }
  };

  const handleNext = () => {
    if (searchResults.length > 0) {
      const newIndex = (currentIndex + 1) % searchResults.length;
      setCurrentIndex(newIndex);
      onJumpToMessage?.(searchResults[newIndex].id);
    }
  };

  const handleClose = () => {
    setQuery('');
    setCurrentIndex(0);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className="border-b border-border bg-muted/30"
      >
        <div className="p-2 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search in conversation..."
              className="pl-8 h-8"
            />
          </div>
          
          {searchResults.length > 0 && (
            <>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {currentIndex + 1} of {searchResults.length}
              </span>
              <div className="flex items-center">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handlePrev}
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleNext}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
          
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Results dropdown */}
        {query && (
          <div className="border-t border-border">
            {isSearching ? (
              <div className="p-2 space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center gap-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 flex-1" />
                  </div>
                ))}
              </div>
            ) : searchResults.length === 0 ? (
              <div className="p-3 text-center text-sm text-muted-foreground">
                No messages found
              </div>
            ) : (
              <ScrollArea className="max-h-[200px]">
                <div className="p-1">
                  {searchResults.slice(0, 10).map((msg, index) => (
                    <button
                      key={msg.id}
                      onClick={() => {
                        setCurrentIndex(index);
                        onJumpToMessage?.(msg.id);
                      }}
                      className={cn(
                        "w-full text-left p-2 rounded hover:bg-muted/50 transition-colors",
                        index === currentIndex && "bg-primary/10"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-medium">{msg.sender_name}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {format(new Date(msg.created_at), 'MMM d, h:mm a')}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {msg.content}
                      </p>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
