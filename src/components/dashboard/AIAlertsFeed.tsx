import { useState, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  AlertTriangle, 
  TrendingUp, 
  Calendar, 
  Shield,
  Bell,
  X,
  ArrowRight,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useFleet } from "@/contexts/FleetContext";
import { differenceInDays, differenceInHours, isBefore, addDays } from "date-fns";

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
  
  const [collapsed, setCollapsed] = useState(false);
  const [dismissedAlertIds, setDismissedAlertIds] = useState<Set<string>>(new Set());

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

  if (collapsed) {
    return (
      <Button
        onClick={() => setCollapsed(false)}
        variant="outline"
        size="sm"
        className={cn(
          "fixed bottom-20 left-6 md:bottom-6 z-50 shadow-lg",
          "bg-background hover:bg-muted",
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
    <Card className={cn(
      "fixed bottom-20 left-6 md:bottom-6 z-50 w-[380px] max-w-[calc(100vw-3rem)]",
      "shadow-xl border-2 border-border",
      className
    )}>
      <div className="p-4 border-b border-border bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent" />
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
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <p className="text-small text-muted-foreground mt-1">
          Proactive recommendations for your fleet
        </p>
      </div>

      <ScrollArea className="h-[400px]">
        {alerts.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No active alerts</p>
            <p className="text-xs mt-1">Your fleet is running smoothly!</p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {alerts.map((alert) => {
              const Icon = getCategoryIcon(alert.category);
              const typeColor = getTypeColor(alert.type);
              
              return (
                <div
                  key={alert.id}
                  className={cn(
                    "p-4 rounded-lg border-2 transition-all hover:shadow-md",
                    typeColor === 'destructive' && "border-destructive/30 bg-destructive/5",
                    typeColor === 'warning' && "border-warning/30 bg-warning/5",
                    typeColor === 'primary' && "border-primary/30 bg-primary/5",
                    typeColor === 'secondary' && "border-border bg-muted/30"
                  )}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Icon className={cn(
                        "w-4 h-4",
                        typeColor === 'destructive' && "text-destructive",
                        typeColor === 'warning' && "text-warning",
                        typeColor === 'primary' && "text-primary",
                        typeColor === 'secondary' && "text-muted-foreground"
                      )} />
                      <Badge variant="outline" className="text-xs capitalize">
                        {alert.type}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => dismissAlert(alert.id)}
                      className="h-6 w-6 p-0"
                    >
                      <X className="w-3 h-3" />
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
                      >
                        {alert.action.label}
                        <ArrowRight className="w-3 h-3 ml-1" />
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
