import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  DollarSign, 
  Gauge, 
  Wrench, 
  TrendingUp, 
  Users, 
  Shield,
  Calendar,
  X,
  Check,
  ChevronRight,
  PartyPopper,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface RariInsight {
  id: string;
  user_id: string;
  team_id: string | null;
  insight_type: 'pricing' | 'utilization' | 'maintenance' | 'revenue' | 'customer' | 'compliance' | 'booking';
  priority: 'urgent' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  action_items: string[];
  related_entity_type: string | null;
  related_entity_id: string | null;
  metadata: Record<string, unknown>;
  is_read: boolean;
  is_dismissed: boolean;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RariInsightsPanelProps {
  maxItems?: number;
  showPriority?: 'all' | 'urgent' | 'high';
  onDismiss?: (insightId: string) => void;
  onAction?: (insightId: string, action: string) => void;
  className?: string;
}

const PRIORITY_ORDER = { urgent: 0, high: 1, medium: 2, low: 3 };

const PRIORITY_STYLES: Record<string, { badge: string; border: string; pulse: boolean }> = {
  urgent: { badge: "bg-destructive text-destructive-foreground", border: "border-destructive/40", pulse: true },
  high: { badge: "bg-warning text-warning-foreground", border: "border-warning/40", pulse: false },
  medium: { badge: "bg-primary/80 text-primary-foreground", border: "border-primary/30", pulse: false },
  low: { badge: "bg-muted text-muted-foreground", border: "border-border", pulse: false },
};

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  pricing: DollarSign,
  utilization: Gauge,
  maintenance: Wrench,
  revenue: TrendingUp,
  customer: Users,
  compliance: Shield,
  booking: Calendar,
};

export const RariInsightsPanel = ({
  maxItems = 5,
  showPriority = 'all',
  onDismiss,
  onAction,
  className,
}: RariInsightsPanelProps) => {
  const { user } = useAuth();
  const [insights, setInsights] = useState<RariInsight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Fetch insights
  useEffect(() => {
    if (!user?.id) return;

    const fetchInsights = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('rari_insights')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_dismissed', false)
          .order('priority', { ascending: true })
          .order('created_at', { ascending: false });

        if (error) throw error;
        
        // Parse action_items from JSONB
        const parsed = (data || []).map(item => ({
          ...item,
          action_items: Array.isArray(item.action_items) ? item.action_items : [],
          metadata: typeof item.metadata === 'object' ? item.metadata : {},
        })) as RariInsight[];
        
        setInsights(parsed);
      } catch (error) {
        console.error('Error fetching insights:', error);
        toast.error('Failed to load insights');
      } finally {
        setIsLoading(false);
      }
    };

    fetchInsights();

    // Set up realtime subscription
    const channel = supabase
      .channel('rari_insights_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rari_insights',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newInsight = {
              ...payload.new,
              action_items: Array.isArray(payload.new.action_items) ? payload.new.action_items : [],
              metadata: typeof payload.new.metadata === 'object' ? payload.new.metadata : {},
            } as RariInsight;
            setInsights(prev => [newInsight, ...prev]);
            toast.info(`New insight: ${newInsight.title}`);
          } else if (payload.eventType === 'UPDATE') {
            setInsights(prev => prev.map(i => 
              i.id === payload.new.id ? { ...i, ...payload.new } as RariInsight : i
            ).filter(i => !i.is_dismissed));
          } else if (payload.eventType === 'DELETE') {
            setInsights(prev => prev.filter(i => i.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Filter and sort insights
  const filteredInsights = useMemo(() => {
    let filtered = insights;
    
    if (showPriority === 'urgent') {
      filtered = filtered.filter(i => i.priority === 'urgent');
    } else if (showPriority === 'high') {
      filtered = filtered.filter(i => i.priority === 'urgent' || i.priority === 'high');
    }

    return filtered.sort((a, b) => {
      const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [insights, showPriority]);

  const displayedInsights = showAll ? filteredInsights : filteredInsights.slice(0, maxItems);
  const hasMore = filteredInsights.length > maxItems;

  const markAsRead = async (insightId: string) => {
    try {
      const { error } = await supabase
        .from('rari_insights')
        .update({ is_read: true })
        .eq('id', insightId);

      if (error) throw error;
      setInsights(prev => prev.map(i => i.id === insightId ? { ...i, is_read: true } : i));
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const dismissInsight = async (insightId: string) => {
    try {
      const { error } = await supabase
        .from('rari_insights')
        .update({ is_dismissed: true })
        .eq('id', insightId);

      if (error) throw error;
      setInsights(prev => prev.filter(i => i.id !== insightId));
      toast.success('Insight dismissed');
      onDismiss?.(insightId);
    } catch (error) {
      console.error('Error dismissing insight:', error);
      toast.error('Failed to dismiss insight');
    }
  };

  const handleAction = (insightId: string, action: string) => {
    markAsRead(insightId);
    onAction?.(insightId, action);
    toast.info(`Action: ${action}`);
  };

  const handleCardClick = (insight: RariInsight) => {
    if (!insight.is_read) {
      markAsRead(insight.id);
    }
    setExpandedId(expandedId === insight.id ? null : insight.id);
  };

  // Loading state
  if (isLoading) {
    return (
      <Card className={cn("p-4 space-y-3", className)}>
        <div className="flex items-center gap-2 mb-4">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-5 w-32" />
        </div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </Card>
    );
  }

  // Empty state
  if (filteredInsights.length === 0) {
    return (
      <Card className={cn("p-8 text-center", className)}>
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", duration: 0.5 }}
        >
          <PartyPopper className="w-12 h-12 mx-auto mb-4 text-accent" />
          <h3 className="text-lg font-semibold text-foreground mb-2">All caught up!</h3>
          <p className="text-sm text-muted-foreground">No new insights at the moment.</p>
        </motion.div>
      </Card>
    );
  }

  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className="p-4 border-b border-border bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent" />
            <h3 className="font-semibold text-foreground">Rari Insights</h3>
            {filteredInsights.filter(i => !i.is_read).length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {filteredInsights.filter(i => !i.is_read).length} new
              </Badge>
            )}
          </div>
        </div>
      </div>

      <ScrollArea className="max-h-[400px]">
        <div className="p-4 space-y-3">
          <AnimatePresence mode="popLayout">
            {displayedInsights.map((insight, index) => {
              const Icon = TYPE_ICONS[insight.insight_type] || Sparkles;
              const style = PRIORITY_STYLES[insight.priority];
              const isExpanded = expandedId === insight.id;

              return (
                <motion.div
                  key={insight.id}
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -100, scale: 0.9 }}
                  transition={{ 
                    delay: index * 0.05,
                    type: "spring",
                    stiffness: 300,
                    damping: 25
                  }}
                  layout
                >
                  <div
                    onClick={() => handleCardClick(insight)}
                    className={cn(
                      "p-4 rounded-lg border cursor-pointer transition-all hover:shadow-md",
                      style.border,
                      !insight.is_read && "bg-accent/5",
                      insight.is_read && "bg-card",
                      style.pulse && "animate-pulse"
                    )}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && handleCardClick(insight)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className={cn(
                          "p-2 rounded-lg shrink-0",
                          insight.priority === 'urgent' ? "bg-destructive/10" : "bg-muted"
                        )}>
                          <Icon className={cn(
                            "w-4 h-4",
                            insight.priority === 'urgent' ? "text-destructive" : "text-muted-foreground"
                          )} />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className={cn("text-xs capitalize", style.badge)}>
                              {insight.priority}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(insight.created_at), { addSuffix: true })}
                            </span>
                          </div>
                          
                          <h4 className={cn(
                            "font-medium text-sm text-foreground truncate",
                            !insight.is_read && "font-semibold"
                          )}>
                            {insight.title}
                          </h4>
                          
                          <p className={cn(
                            "text-xs text-muted-foreground mt-1",
                            !isExpanded && "line-clamp-2"
                          )}>
                            {insight.description}
                          </p>
                          
                          {isExpanded && insight.action_items.length > 0 && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="mt-3 flex flex-wrap gap-2"
                            >
                              {insight.action_items.map((action, i) => (
                                <Button
                                  key={i}
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAction(insight.id, action);
                                  }}
                                  className="text-xs h-7"
                                >
                                  {action}
                                  <ChevronRight className="w-3 h-3 ml-1" />
                                </Button>
                              ))}
                            </motion.div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1 shrink-0">
                        {!insight.is_read && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsRead(insight.id);
                            }}
                            className="h-7 w-7 p-0"
                            title="Mark as read"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            dismissInsight(insight.id);
                          }}
                          className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive"
                          title="Dismiss"
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </ScrollArea>

      {hasMore && (
        <div className="p-3 border-t border-border bg-muted/20">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll(!showAll)}
            className="w-full"
          >
            {showAll ? 'Show Less' : `View All (${filteredInsights.length})`}
          </Button>
        </div>
      )}
    </Card>
  );
};

export default RariInsightsPanel;
