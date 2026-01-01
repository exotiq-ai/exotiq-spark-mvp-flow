import { useState, useMemo, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  AlertTriangle, 
  TrendingUp, 
  Calendar, 
  Shield,
  Bell,
  X,
  ArrowRight,
  Sparkles,
  Volume2,
  VolumeX
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useFleet } from "@/contexts/FleetContext";
import { differenceInDays, differenceInHours, isBefore, addDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AIAlert {
  id: string;
  type: 'critical' | 'high' | 'medium' | 'low';
  category: 'maintenance' | 'performance' | 'booking' | 'compliance' | 'revenue';
  title: string;
  description: string;
  action?: {
    label: string;
    moduleId: string;
  };
  timestamp: Date;
}

interface AIAlertsFeedProps {
  onNavigate?: (moduleId: string) => void;
  className?: string;
}

// Helper function to generate alerts from real fleet data
const generateAlertsFromData = (
  vehicles: any[],
  bookings: any[],
  customers: any[],
  documents: any[],
  damageClaims: any[]
): AIAlert[] => {
  const alerts: AIAlert[] = [];
  const now = new Date();

  // CRITICAL: Document expiry alerts
  documents.forEach(doc => {
    if (doc.expires_at) {
      const expiryDate = new Date(doc.expires_at);
      const daysUntilExpiry = differenceInDays(expiryDate, now);
      
      if (daysUntilExpiry <= 7 && daysUntilExpiry >= 0) {
        const vehicle = vehicles.find(v => v.id === doc.vehicle_id);
        const customer = customers.find(c => c.id === doc.customer_id);
        
        alerts.push({
          id: `doc-expiry-${doc.id}`,
          type: daysUntilExpiry <= 3 ? 'critical' : 'high',
          category: 'compliance',
          title: `${doc.type} Expiring Soon`,
          description: `${customer?.full_name || vehicle?.name || 'Document'} ${doc.type} expires in ${daysUntilExpiry} days. ${vehicle ? `Vehicle (${vehicle.name}) may be unavailable.` : ''}`,
          action: { label: 'Renew Document', moduleId: 'vault' },
          timestamp: new Date(doc.created_at)
        });
      }
    }
  });

  // HIGH: Pricing optimization opportunities
  vehicles.forEach(vehicle => {
    if (vehicle.utilization && vehicle.utilization > 75) {
      const marketRate = vehicle.suggested_rate || vehicle.current_rate * 1.15;
      const rateDifference = ((marketRate - vehicle.current_rate) / vehicle.current_rate) * 100;
      
      if (rateDifference > 10) {
        const potentialIncrease = (marketRate - vehicle.current_rate) * 30; // Monthly estimate
        alerts.push({
          id: `pricing-${vehicle.id}`,
          type: 'high',
          category: 'revenue',
          title: 'Pricing Opportunity Detected',
          description: `${vehicle.name} has ${vehicle.utilization}% utilization but rate is ${rateDifference.toFixed(0)}% below market. Potential +$${potentialIncrease.toFixed(0)}/mo.`,
          action: { label: 'Optimize Price', moduleId: 'motoriq' },
          timestamp: new Date(vehicle.updated_at)
        });
      }
    }
  });

  // HIGH: Upcoming bookings concentration
  const upcomingBookings = bookings.filter(b => {
    const startDate = new Date(b.start_date);
    return isBefore(now, startDate) && differenceInDays(startDate, now) <= 7;
  });
  
  if (upcomingBookings.length > 5) {
    const weekdayCount = upcomingBookings.filter(b => {
      const day = new Date(b.start_date).getDay();
      return day === 0 || day === 6; // Weekend
    }).length;
    
    if (weekdayCount > upcomingBookings.length * 0.6) {
      alerts.push({
        id: 'weekend-demand',
        type: 'high',
        category: 'booking',
        title: 'Weekend Demand Spike',
        description: `${weekdayCount} weekend bookings in next 7 days (${((weekdayCount/upcomingBookings.length)*100).toFixed(0)}% of total). Consider dynamic pricing.`,
        action: { label: 'View Bookings', moduleId: 'book' },
        timestamp: now
      });
    }
  }

  // CRITICAL: Open damage claims
  const openClaims = damageClaims.filter(c => c.claim_status === 'open' || c.claim_status === 'in_progress');
  if (openClaims.length > 0) {
    openClaims.forEach(claim => {
      const vehicle = vehicles.find(v => v.id === claim.vehicle_id);
      const hoursOpen = differenceInHours(now, new Date(claim.reported_date));
      
      if (hoursOpen > 48) {
        alerts.push({
          id: `claim-${claim.id}`,
          type: 'critical',
          category: 'maintenance',
          title: 'Unresolved Damage Claim',
          description: `${vehicle?.name || 'Vehicle'} has ${claim.severity} damage (${claim.claim_type}) open for ${Math.floor(hoursOpen/24)} days. Est. cost: $${claim.estimated_cost?.toFixed(0) || 'TBD'}`,
          action: { label: 'Review Claim', moduleId: 'vault' },
          timestamp: new Date(claim.reported_date)
        });
      }
    });
  }

  // MEDIUM: Low utilization vehicles
  vehicles.forEach(vehicle => {
    if (vehicle.status === 'available' && vehicle.utilization !== null && vehicle.utilization < 30) {
      alerts.push({
        id: `low-util-${vehicle.id}`,
        type: 'medium',
        category: 'performance',
        title: 'Low Utilization Alert',
        description: `${vehicle.name} only ${vehicle.utilization}% utilized. Consider marketing or pricing adjustment.`,
        action: { label: 'View Analytics', moduleId: 'motoriq' },
        timestamp: new Date(vehicle.updated_at)
      });
    }
  });

  // Sort by priority and timestamp
  return alerts.sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const priorityDiff = priorityOrder[a.type] - priorityOrder[b.type];
    if (priorityDiff !== 0) return priorityDiff;
    return b.timestamp.getTime() - a.timestamp.getTime();
  }).slice(0, 10); // Limit to 10 most important alerts
};

export const AIAlertsFeed = ({ onNavigate, className }: AIAlertsFeedProps) => {
  const { 
    vehicles, 
    bookings, 
    customers, 
    documents, 
    damageClaims
  } = useFleet();
  const { toast } = useToast();
  
  const [collapsed, setCollapsed] = useState(true); // Start collapsed by default
  const [dismissedAlertIds, setDismissedAlertIds] = useState<Set<string>>(new Set());
  const [voiceAlertsEnabled, setVoiceAlertsEnabled] = useState(() => {
    return localStorage.getItem('voiceAlertsEnabled') === 'true';
  });
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const announcedAlertsRef = useRef<Set<string>>(new Set());
  const audioQueueRef = useRef<string[]>([]);

  // Generate alerts from real data
  const generatedAlerts = useMemo(() => {
    return generateAlertsFromData(
      vehicles,
      bookings,
      customers,
      documents,
      damageClaims
    );
  }, [vehicles, bookings, customers, documents, damageClaims]);

  // Filter out dismissed alerts
  const alerts = useMemo(() => {
    return generatedAlerts.filter(alert => !dismissedAlertIds.has(alert.id));
  }, [generatedAlerts, dismissedAlertIds]);

  // Save voice alerts preference
  useEffect(() => {
    localStorage.setItem('voiceAlertsEnabled', voiceAlertsEnabled.toString());
  }, [voiceAlertsEnabled]);

  // Play audio from queue
  const playNextInQueue = async () => {
    if (audioQueueRef.current.length === 0) {
      setIsPlayingAudio(false);
      return;
    }

    const text = audioQueueRef.current.shift()!;
    setIsPlayingAudio(true);

    try {
      const { data, error } = await supabase.functions.invoke('text-to-speech', {
        body: { text, voice: 'Aria' }
      });

      if (error) throw error;

      if (data?.audioContent) {
        const audio = new Audio(`data:audio/mpeg;base64,${data.audioContent}`);
        audio.onended = () => playNextInQueue();
        audio.onerror = () => {
          console.error('Error playing audio');
          playNextInQueue();
        };
        await audio.play();
      } else {
        playNextInQueue();
      }
    } catch (error) {
      console.error('Error generating speech:', error);
      toast({
        title: "Voice Alert Error",
        description: "Could not play voice alert. Check console for details.",
        variant: "destructive"
      });
      playNextInQueue();
    }
  };

  // Announce new critical/high alerts
  useEffect(() => {
    if (!voiceAlertsEnabled) return;

    const criticalAndHighAlerts = alerts.filter(
      alert => (alert.type === 'critical' || alert.type === 'high') && 
               !announcedAlertsRef.current.has(alert.id)
    );

    if (criticalAndHighAlerts.length === 0) return;

    // Mark alerts as announced
    criticalAndHighAlerts.forEach(alert => {
      announcedAlertsRef.current.add(alert.id);
      const announcement = `${alert.type === 'critical' ? 'Critical alert' : 'High priority alert'}. ${alert.title}. ${alert.description}`;
      audioQueueRef.current.push(announcement);
    });

    // Start playing if not already playing
    if (!isPlayingAudio && audioQueueRef.current.length > 0) {
      playNextInQueue();
    }
  }, [alerts, voiceAlertsEnabled, isPlayingAudio]);

  // Detect scroll position
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 100);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Delayed appearance on load (Apple-style)
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 3000);
    
    return () => clearTimeout(timer);
  }, []);

  // Reset dismissed alerts when new data comes in
  useEffect(() => {
    // Clear dismissed alerts older than 24 hours
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const validDismissed = new Set(
      Array.from(dismissedAlertIds).filter(id => {
        const alert = generatedAlerts.find(a => a.id === id);
        return alert && alert.timestamp > dayAgo;
      })
    );
    setDismissedAlertIds(validDismissed);
    
    // Clear old announced alerts
    const currentAlertIds = new Set(generatedAlerts.map(a => a.id));
    announcedAlertsRef.current = new Set(
      Array.from(announcedAlertsRef.current).filter(id => currentAlertIds.has(id))
    );
  }, [generatedAlerts]);

  const dismissAlert = (id: string) => {
    setDismissedAlertIds(prev => new Set(prev).add(id));
  };

  const getTypeColor = (type: AIAlert['type']) => {
    switch (type) {
      case 'critical': return 'destructive';
      case 'high': return 'warning';
      case 'medium': return 'primary';
      case 'low': return 'secondary';
    }
  };

  const getCategoryIcon = (category: AIAlert['category']) => {
    switch (category) {
      case 'maintenance': return Shield;
      case 'performance': return TrendingUp;
      case 'booking': return Calendar;
      case 'compliance': return AlertTriangle;
      case 'revenue': return TrendingUp;
    }
  };

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  const criticalCount = alerts.filter(a => a.type === 'critical').length;
  const highCount = alerts.filter(a => a.type === 'high').length;

  // Don't show anything until after delay
  if (!isVisible) {
    return null;
  }

  if (collapsed) {
    return (
      <Button
        onClick={() => setCollapsed(false)}
        variant="outline"
        size="sm"
        className={cn(
          "fixed bottom-32 left-4 md:bottom-6 md:left-6 z-40 shadow-lg",
          "bg-background/80 hover:bg-muted backdrop-blur-sm",
          "transition-all duration-300 ease-out animate-fade-in",
          isScrolled && "scale-75 opacity-60",
          className
        )}
      >
        <Bell className="w-4 h-4 mr-2" />
        {criticalCount + highCount > 0 && (
          <Badge variant="destructive" className="ml-2 h-5 px-1.5">
            {criticalCount + highCount}
          </Badge>
        )}
      </Button>
    );
  }

  return (
    <Card 
      className={cn(
        "fixed left-4 right-4 md:left-6 md:right-auto z-40 w-auto md:w-[340px] max-w-[calc(100vw-2rem)] md:max-w-[340px]",
        "shadow-xl border border-border animate-fade-in",
        "transition-all duration-300 ease-out",
        isScrolled ? "bottom-32 md:bottom-8 scale-75 opacity-60" : "bottom-32 md:bottom-6",
        className
      )}
      role="region"
      aria-label="AI alerts and insights panel"
    >
      <div className="p-4 border-b border-border bg-muted/30">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent" aria-hidden="true" />
            <h3 className="text-h3">AI Insights</h3>
          </div>
          <div className="flex items-center gap-2">
            {(criticalCount + highCount) > 0 && (
              <Badge variant="destructive">
                {criticalCount + highCount}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCollapsed(true)}
              className="h-8 w-8 p-0"
              aria-label="Collapse AI alerts panel"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <p className="text-small text-muted-foreground">
            Proactive recommendations for your fleet
          </p>
          <div className="flex items-center gap-2">
            <Label htmlFor="voice-alerts" className="text-xs text-muted-foreground cursor-pointer">
              {voiceAlertsEnabled ? (
                <Volume2 className="w-4 h-4 text-primary" aria-hidden="true" />
              ) : (
                <VolumeX className="w-4 h-4" aria-hidden="true" />
              )}
            </Label>
            <Switch
              id="voice-alerts"
              checked={voiceAlertsEnabled}
              onCheckedChange={setVoiceAlertsEnabled}
              className="scale-75"
              aria-label="Toggle voice alerts"
            />
          </div>
        </div>
        
        {isPlayingAudio && (
          <div className="mt-2 flex items-center gap-2 text-xs text-primary" aria-live="polite">
            <Volume2 className="w-3 h-3 animate-pulse" aria-hidden="true" />
            <span>Playing alert...</span>
          </div>
        )}
      </div>

      <ScrollArea className="h-[280px] md:h-[320px]">
        {alerts.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" aria-hidden="true" />
            <p className="text-sm">No active alerts</p>
            <p className="text-xs mt-1">Your fleet is running smoothly!</p>
          </div>
        ) : (
          <div 
            className="p-4 space-y-3"
            role="log"
            aria-live="polite"
            aria-atomic="false"
            aria-label="Fleet alerts and notifications"
          >
            {alerts.map((alert) => {
              const Icon = getCategoryIcon(alert.category);
              const typeColor = getTypeColor(alert.type);
              
              return (
                <div
                  key={alert.id}
                  className={cn(
                    "p-4 rounded-lg border transition-all hover:shadow-md",
                    typeColor === 'destructive' && "border-destructive/30 bg-destructive/5",
                    typeColor === 'warning' && "border-warning/30 bg-warning/5",
                    typeColor === 'primary' && "border-primary/30 bg-primary/5",
                    typeColor === 'secondary' && "border-border bg-muted/30"
                  )}
                  role="article"
                  aria-label={`${alert.type} priority alert: ${alert.title}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Icon 
                        className={cn(
                          "w-4 h-4",
                          typeColor === 'destructive' && "text-destructive",
                          typeColor === 'warning' && "text-warning",
                          typeColor === 'primary' && "text-primary",
                          typeColor === 'secondary' && "text-muted-foreground"
                        )}
                        aria-hidden="true"
                      />
                      <Badge variant="outline" className="text-xs capitalize">
                        {alert.type}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => dismissAlert(alert.id)}
                      className="h-6 w-6 p-0"
                      aria-label={`Dismiss alert: ${alert.title}`}
                    >
                      <X className="w-3 h-3" aria-hidden="true" />
                    </Button>
                  </div>

                  <h4 className="font-semibold text-sm mb-1">{alert.title}</h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    {alert.description}
                  </p>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {formatTimestamp(alert.timestamp)}
                    </span>
                    {alert.action && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          onNavigate?.(alert.action!.moduleId);
                          dismissAlert(alert.id);
                        }}
                        className="h-7 text-xs"
                        aria-label={`${alert.action.label} for ${alert.title}`}
                      >
                        {alert.action.label}
                        <ArrowRight className="w-3 h-3 ml-1" aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      <div className="p-3 border-t border-border bg-muted/30">
        <p className="text-xs text-center text-muted-foreground">
          Powered by FleetCopilot™ AI
        </p>
      </div>
    </Card>
  );
};
