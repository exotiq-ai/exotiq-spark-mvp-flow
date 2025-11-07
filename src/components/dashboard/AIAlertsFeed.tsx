import { useState } from "react";
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

// Mock alerts - in production, these would come from an AI service
const mockAlerts: AIAlert[] = [
  {
    id: '1',
    type: 'critical',
    category: 'compliance',
    title: 'Driver License Expiring',
    description: 'Sarah M.\'s license expires in 5 days. Vehicle (Porsche 911 GT3) will be unavailable.',
    action: { label: 'Renew Document', moduleId: 'vault' },
    timestamp: new Date(Date.now() - 10 * 60 * 1000)
  },
  {
    id: '2',
    type: 'high',
    category: 'revenue',
    title: 'Pricing Opportunity',
    description: 'Ferrari 488 has 89% utilization but rate is 15% below market. Potential +$2,250/mo.',
    action: { label: 'Optimize Price', moduleId: 'motoriq' },
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000)
  },
  {
    id: '3',
    type: 'medium',
    category: 'performance',
    title: 'Driver Performance Alert',
    description: 'Marcus Chen\'s safety score dropped 12% this week. Consider review.',
    action: { label: 'View Analytics', moduleId: 'pulse' },
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000)
  },
  {
    id: '4',
    type: 'high',
    category: 'booking',
    title: 'Weekend Demand Spike',
    description: 'Booking requests 30% higher than usual for next weekend. Consider dynamic pricing.',
    action: { label: 'View Bookings', moduleId: 'book' },
    timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000)
  },
  {
    id: '5',
    type: 'medium',
    category: 'maintenance',
    title: 'Service Due Soon',
    description: 'Lamborghini Huracán needs scheduled maintenance in 500 miles.',
    action: { label: 'Schedule Service', moduleId: 'vault' },
    timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000)
  }
];

export const AIAlertsFeed = ({ onNavigate, className }: AIAlertsFeedProps) => {
  const [alerts, setAlerts] = useState<AIAlert[]>(mockAlerts);
  const [collapsed, setCollapsed] = useState(false);

  const dismissAlert = (id: string) => {
    setAlerts(alerts.filter(alert => alert.id !== id));
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
