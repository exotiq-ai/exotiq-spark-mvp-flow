import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Brain,
  TrendingUp,
  TrendingDown,
  Calendar,
  DollarSign,
  Car,
  Sparkles,
  ChevronRight,
  RefreshCw,
  Zap,
  BarChart3,
  Target,
  Mail,
  Clock,
} from "lucide-react";
import { format, startOfWeek, endOfWeek, subWeeks } from "date-fns";
import { cn, formatCurrencyCompact } from "@/lib/utils";

interface DigestData {
  id: string;
  week_start: string;
  summary_json: {
    weekInReview: {
      revenue: number;
      revenueChange: number;
      bookingsCompleted: number;
      newBookings: number;
      topVehicle: { name: string; revenue: number };
      utilizationChange: { from: number; to: number };
    };
    nextWeekOutlook: {
      events: Array<{ name: string; date: string; impact: string }>;
      demandSurge: number;
      vehiclesRecommended: number;
    };
    topAction: string;
    generatedAt: string;
  };
  created_at: string;
}

interface WeeklyDigestCardProps {
  bookings: any[];
  vehicles: any[];
}

export const WeeklyDigestCard = ({ bookings, vehicles }: WeeklyDigestCardProps) => {
  const { user } = useAuth();
  const [digest, setDigest] = useState<DigestData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showFullDigest, setShowFullDigest] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Load latest digest from DB
  useEffect(() => {
    const loadDigest = async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from('weekly_digests')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (!error && data) {
          setDigest(data as unknown as DigestData);
        }
      } catch (err) {
        console.error('Failed to load digest:', err);
      }
    };
    loadDigest();
  }, [user]);

  const handleGenerateDigest = async () => {
    if (!user) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('weekly-intelligence-digest', {
        body: { userId: user.id },
      });
      
      if (error) throw error;
      
      if (data?.digest) {
        setDigest(data.digest as DigestData);
        toast.success('Weekly digest generated');
      }
    } catch (err) {
      console.error('Failed to generate digest:', err);
      toast.error('Failed to generate weekly digest');
    } finally {
      setGenerating(false);
    }
  };

  const isNew = digest && (Date.now() - new Date(digest.created_at).getTime()) < 24 * 60 * 60 * 1000;
  const summary = digest?.summary_json;

  if (!digest) {
    return (
      <Card className="card-premium p-5 bg-gradient-to-br from-primary/5 via-accent/5 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl">
              <Brain className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold flex items-center gap-2">
                FleetCopilot™ Weekly Digest
                <Badge variant="outline" className="text-[10px]">New</Badge>
              </h4>
              <p className="text-xs text-muted-foreground">AI-powered fleet intelligence report</p>
            </div>
          </div>
          <Button onClick={handleGenerateDigest} disabled={generating} size="sm" className="gap-2">
            {generating ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Generate
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card 
        className="card-premium p-5 bg-gradient-to-br from-primary/5 via-accent/5 to-transparent cursor-pointer hover:border-primary/30 transition-all group"
        onClick={() => setShowFullDigest(true)}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl">
              <Brain className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold flex items-center gap-2">
                FleetCopilot™ Weekly Digest
                {isNew && <Badge className="bg-success/20 text-success text-[10px] px-1.5 py-0">New</Badge>}
              </h4>
              <p className="text-xs text-muted-foreground">
                Week of {digest.week_start ? format(new Date(digest.week_start), 'MMM d') : '—'}
              </p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
        </div>

        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <DollarSign className="h-3 w-3" />
                Revenue
              </div>
              <div className="font-bold text-lg">{formatCurrencyCompact(summary.weekInReview.revenue)}</div>
              <div className={cn("text-xs font-medium", summary.weekInReview.revenueChange >= 0 ? 'text-success' : 'text-destructive')}>
                {summary.weekInReview.revenueChange >= 0 ? '+' : ''}{summary.weekInReview.revenueChange}%
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                Bookings
              </div>
              <div className="font-bold text-lg">{summary.weekInReview.bookingsCompleted}</div>
              <div className="text-xs text-muted-foreground">+{summary.weekInReview.newBookings} new</div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Car className="h-3 w-3" />
                Top Vehicle
              </div>
              <div className="font-bold text-sm truncate">{summary.weekInReview.topVehicle.name}</div>
              <div className="text-xs text-success">{formatCurrencyCompact(summary.weekInReview.topVehicle.revenue)}</div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <BarChart3 className="h-3 w-3" />
                Utilization
              </div>
              <div className="font-bold text-lg">{summary.weekInReview.utilizationChange.to}%</div>
              <div className={cn("text-xs font-medium",
                summary.weekInReview.utilizationChange.to > summary.weekInReview.utilizationChange.from 
                  ? 'text-success' : 'text-destructive'
              )}>
                {summary.weekInReview.utilizationChange.from}% → {summary.weekInReview.utilizationChange.to}%
              </div>
            </div>
          </div>
        )}

        {summary?.topAction && (
          <div className="mt-4 p-3 rounded-lg bg-success/5 border border-success/20">
            <div className="flex items-start gap-2">
              <Zap className="h-4 w-4 text-success flex-shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">{summary.topAction}</p>
            </div>
          </div>
        )}
      </Card>

      {/* Full Digest Dialog */}
      <Dialog open={showFullDigest} onOpenChange={setShowFullDigest}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              FleetCopilot™ Weekly Intelligence
              {isNew && <Badge className="bg-success/20 text-success text-xs">New</Badge>}
            </DialogTitle>
          </DialogHeader>
          
          {summary && (
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-6 py-2">
                {/* Week in Review */}
                <div>
                  <h4 className="font-semibold flex items-center gap-2 mb-3">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    Week in Review
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-success/10 border border-success/20">
                      <div className="text-xs text-muted-foreground mb-1">Revenue</div>
                      <div className="text-xl font-bold text-success">{formatCurrencyCompact(summary.weekInReview.revenue)}</div>
                      <div className={cn("text-xs", summary.weekInReview.revenueChange >= 0 ? 'text-success' : 'text-destructive')}>
                        {summary.weekInReview.revenueChange >= 0 ? '+' : ''}{summary.weekInReview.revenueChange}% vs last week
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                      <div className="text-xs text-muted-foreground mb-1">Bookings</div>
                      <div className="text-xl font-bold text-primary">{summary.weekInReview.bookingsCompleted}</div>
                      <div className="text-xs text-muted-foreground">{summary.weekInReview.newBookings} new this week</div>
                    </div>
                    <div className="p-3 rounded-lg bg-accent/10 border border-accent/20">
                      <div className="text-xs text-muted-foreground mb-1">Top Vehicle</div>
                      <div className="text-sm font-bold">{summary.weekInReview.topVehicle.name}</div>
                      <div className="text-xs text-success">{formatCurrencyCompact(summary.weekInReview.topVehicle.revenue)} revenue</div>
                    </div>
                    <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
                      <div className="text-xs text-muted-foreground mb-1">Fleet Utilization</div>
                      <div className="text-xl font-bold">{summary.weekInReview.utilizationChange.to}%</div>
                      <div className="text-xs text-muted-foreground">
                        {summary.weekInReview.utilizationChange.from}% → {summary.weekInReview.utilizationChange.to}%
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Next Week Outlook */}
                <div>
                  <h4 className="font-semibold flex items-center gap-2 mb-3">
                    <Target className="h-4 w-4 text-accent" />
                    Next Week Outlook
                  </h4>
                  {summary.nextWeekOutlook.events.length > 0 ? (
                    <div className="space-y-2 mb-3">
                      {summary.nextWeekOutlook.events.map((event, i) => (
                        <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-accent/5 border border-accent/10">
                          <Sparkles className="h-4 w-4 text-accent flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{event.name}</p>
                            <p className="text-xs text-muted-foreground">{event.date}</p>
                          </div>
                          <Badge className={cn("text-xs",
                            event.impact === 'high' ? 'bg-warning/20 text-warning' : 'bg-muted'
                          )}>
                            {event.impact}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground mb-3">No major events detected for next week</p>
                  )}
                  
                  <div className="flex items-center gap-4 text-sm">
                    {summary.nextWeekOutlook.demandSurge > 0 && (
                      <div className="flex items-center gap-1.5">
                        <TrendingUp className="h-4 w-4 text-success" />
                        <span>+{summary.nextWeekOutlook.demandSurge}% demand surge</span>
                      </div>
                    )}
                    {summary.nextWeekOutlook.vehiclesRecommended > 0 && (
                      <div className="flex items-center gap-1.5">
                        <Car className="h-4 w-4 text-primary" />
                        <span>{summary.nextWeekOutlook.vehiclesRecommended} vehicles to reprice</span>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Top Action */}
                <div>
                  <h4 className="font-semibold flex items-center gap-2 mb-3">
                    <Zap className="h-4 w-4 text-success" />
                    Top Action
                  </h4>
                  <div className="p-4 rounded-lg bg-success/5 border border-success/20">
                    <p className="text-sm">{summary.topAction}</p>
                  </div>
                </div>

                {/* Meta */}
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3" />
                    Generated {format(new Date(digest.created_at), 'MMM d, h:mm a')}
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-xs gap-1.5 h-7"
                    onClick={handleGenerateDigest}
                    disabled={generating}
                  >
                    <RefreshCw className={cn("h-3 w-3", generating && "animate-spin")} />
                    Regenerate
                  </Button>
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
