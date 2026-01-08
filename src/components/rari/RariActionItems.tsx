import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, 
  X, 
  ChevronDown, 
  ChevronUp,
  Sparkles,
  ListTodo
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useRariInsightActionItems, InsightActionItem } from '@/hooks/useRariInsightActionItems';
import confetti from 'canvas-confetti';

interface RariActionItemsProps {
  variant?: 'compact' | 'full';
  showCompleted?: boolean;
  maxItems?: number;
  onComplete?: (itemId: string) => void;
  onSnooze?: (itemId: string, until: Date) => void;
}

const ActionItemRow = ({
  item,
  onComplete,
  onSnooze,
  onDismiss,
}: {
  item: InsightActionItem;
  onComplete: (id: string) => void;
  onSnooze: (id: string, until: Date) => void;
  onDismiss: (id: string) => void;
}) => {
  const handleComplete = () => {
    if (!item.completed) {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#10b981', '#34d399', '#6ee7b7'],
      });
    }
    onComplete(item.id);
  };

  const snoozeOneDay = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    onSnooze(item.id, tomorrow);
  };

  const snoozeOneWeek = () => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    onSnooze(item.id, nextWeek);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={cn(
        "group flex items-start gap-3 p-3 rounded-lg transition-colors",
        "hover:bg-muted/50",
        item.completed && "opacity-60"
      )}
    >
      <Checkbox
        checked={item.completed}
        onCheckedChange={handleComplete}
        className={cn(
          "mt-0.5",
          item.completed && "data-[state=checked]:bg-success data-[state=checked]:border-success"
        )}
      />
      
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-sm leading-relaxed",
          item.completed && "line-through text-muted-foreground"
        )}>
          {item.text}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
            <Sparkles className="h-2.5 w-2.5 mr-1" />
            {item.insightTitle}
          </Badge>
        </div>
      </div>

      {!item.completed && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <Clock className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={snoozeOneDay}>
                Snooze 1 day
              </DropdownMenuItem>
              <DropdownMenuItem onClick={snoozeOneWeek}>
                Snooze 1 week
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={() => onDismiss(item.id)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </motion.div>
  );
};

const EmptyState = () => (
  <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
      <ListTodo className="h-6 w-6 text-muted-foreground" />
    </div>
    <p className="text-sm text-muted-foreground">
      No action items yet.
    </p>
    <p className="text-xs text-muted-foreground mt-1">
      Rari will suggest tasks as you chat!
    </p>
  </div>
);

export const RariActionItems = ({
  variant = 'full',
  showCompleted = true,
  maxItems,
}: RariActionItemsProps) => {
  const { actionItems, isLoading, pendingCount, completeItem, snoozeItem, dismissItem } = useRariInsightActionItems();
  const [isExpanded, setIsExpanded] = useState(false);

  const filteredItems = showCompleted 
    ? actionItems 
    : actionItems.filter(item => !item.completed);

  const displayItems = maxItems ? filteredItems.slice(0, maxItems) : filteredItems;

  if (variant === 'compact') {
    return (
      <Card 
        variant="interactive" 
        className="cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <CardHeader className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ListTodo className="h-4 w-4 text-gulf-blue" />
              Action Items
            </CardTitle>
            <div className="flex items-center gap-2">
              {pendingCount > 0 && (
                <Badge className="bg-gulf-blue/10 text-gulf-blue border-0">
                  {pendingCount}
                </Badge>
              )}
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </div>
        </CardHeader>
        
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <CardContent className="p-2 pt-0">
                {displayItems.length === 0 ? (
                  <EmptyState />
                ) : (
                  <ScrollArea className="max-h-[300px]">
                    <AnimatePresence mode="popLayout">
                      {displayItems.map((item) => (
                        <ActionItemRow
                          key={item.id}
                          item={item}
                          onComplete={completeItem}
                          onSnooze={snoozeItem}
                          onDismiss={dismissItem}
                        />
                      ))}
                    </AnimatePresence>
                  </ScrollArea>
                )}
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <ListTodo className="h-5 w-5 text-gulf-blue" />
            Rari Action Items
          </CardTitle>
          {pendingCount > 0 && (
            <Badge className="bg-gulf-blue/10 text-gulf-blue border-0">
              {pendingCount} pending
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="p-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 border-2 border-gulf-blue border-t-transparent rounded-full animate-spin" />
          </div>
        ) : displayItems.length === 0 ? (
          <EmptyState />
        ) : (
          <ScrollArea className="max-h-[400px]">
            <AnimatePresence mode="popLayout">
              {displayItems.map((item) => (
                <ActionItemRow
                  key={item.id}
                  item={item}
                  onComplete={completeItem}
                  onSnooze={snoozeItem}
                  onDismiss={dismissItem}
                />
              ))}
            </AnimatePresence>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};
