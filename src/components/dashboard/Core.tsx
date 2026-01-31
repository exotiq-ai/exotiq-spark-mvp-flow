import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RealAIInsights } from "./RealAIInsights";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDemoAccount } from "@/hooks/useDemoAccount";
import { 
  Brain, 
  Zap, 
  AlertTriangle, 
  TrendingUp,
  MessageSquare,
  Settings,
  BarChart3,
  Users,
  Car,
  DollarSign,
  Clock,
  CheckCircle
} from "lucide-react";

export const Core = () => {
  const { user } = useAuth();
  const { vehicles, bookings } = useLocationFilteredFleet();
  const isDemoAccount = useDemoAccount();

  // Fetch real notifications
  const { data: notifications } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('read', false)
        .order('created_at', { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!user
  });

  // Calculate real metrics
  const totalVehicles = vehicles.length;
  const activeBookings = bookings.filter(b => b.status === 'active' || b.status === 'confirmed').length;
  const automatedTasks = totalVehicles > 0 ? Math.round((activeBookings / totalVehicles) * 100) : 0;
  const timeSavedHours = totalVehicles > 0 ? (totalVehicles * 0.5).toFixed(1) : '0';

  // Demo fallback data
  const demoAlerts = [
    {
      type: "warning",
      message: "Insurance renewal needed for Lamborghini Huracán in 5 days",
      time: "2 hours ago",
      priority: "high"
    },
    {
      type: "info",
      message: "New booking inquiry for weekend - Ferrari 488",
      time: "30 minutes ago", 
      priority: "medium"
    },
    {
      type: "success",
      message: "Payment received: $2,100 for completed rental",
      time: "1 hour ago",
      priority: "low"
    }
  ];

  // Use real notifications or demo data
  const systemAlerts = notifications && notifications.length > 0 
    ? notifications.map(n => ({
        type: n.type === 'error' ? 'error' : n.type === 'warning' ? 'warning' : 'info',
        message: n.message,
        time: formatTimeAgo(new Date(n.created_at)),
        priority: n.type === 'error' ? 'high' : 'medium'
      }))
    : isDemoAccount ? demoAlerts : [];

  const quickActions = [
    { title: "Add New Vehicle", icon: Car, color: "text-primary" },
    { title: "Create Booking", icon: Users, color: "text-success" },
    { title: "Generate Report", icon: BarChart3, color: "text-gulf-blue" },
    { title: "Update Pricing", icon: DollarSign, color: "text-warning" },
    { title: "Schedule Maintenance", icon: Settings, color: "text-destructive" },
    { title: "Send Message", icon: MessageSquare, color: "text-purple-500" }
  ];

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'warning': return <AlertTriangle className="w-4 h-4 text-warning" />;
      case 'error': return <AlertTriangle className="w-4 h-4 text-destructive" />;
      case 'success': return <CheckCircle className="w-4 h-4 text-success" />;
      default: return <MessageSquare className="w-4 h-4 text-primary" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'medium': return 'bg-warning/10 text-warning border-warning/20';
      case 'low': return 'bg-success/10 text-success border-success/20';
      default: return 'bg-muted/10 text-muted-foreground border-muted/20';
    }
  };

  return (
    <div className="space-y-6">
      {/* AI Command Center */}
      <Card className="card-premium p-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl font-bold">FleetCopilot™</h2>
            <p className="text-xl text-muted-foreground mt-1">AI Command Center</p>
          </div>
          <div className="flex items-center space-x-4">
            <Button className="btn-premium">
              <Settings className="w-4 h-4 mr-2" />
              Configure AI
            </Button>
            <Badge className="bg-primary text-primary-foreground border-transparent shadow-md dark:shadow-[0_0_20px_rgba(59,130,246,0.3)]">
              <Brain className="w-4 h-4 mr-1" />
              FleetCopilot™ AI Active
            </Badge>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-6 rounded-xl bg-card border border-primary/20 shadow-sm hover:shadow-md transition-all hover:border-primary/40 dark:bg-card/50 dark:border-primary/30">
            <div className="relative inline-block mb-4">
              <div className="absolute inset-0 bg-primary/10 dark:bg-primary/20 rounded-full blur-xl"></div>
              <Brain className="relative w-10 h-10 text-primary mx-auto dark:drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
            </div>
            <div className="text-2xl font-bold text-foreground">24/7</div>
            <div className="text-sm text-muted-foreground mt-1">AI Monitoring</div>
          </div>
          
          <div className="text-center p-6 rounded-xl bg-card border border-success/20 shadow-sm hover:shadow-md transition-all hover:border-success/40 dark:bg-card/50 dark:border-success/30">
            <div className="relative inline-block mb-4">
              <div className="absolute inset-0 bg-success/10 dark:bg-success/20 rounded-full blur-xl"></div>
              <Zap className="relative w-10 h-10 text-success mx-auto dark:drop-shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
            </div>
            <div className="text-2xl font-bold text-foreground">{automatedTasks}%</div>
            <div className="text-sm text-muted-foreground mt-1">Tasks Automated</div>
          </div>
          
          <div className="text-center p-6 rounded-xl bg-card border border-performance-orange/20 shadow-sm hover:shadow-md transition-all hover:border-performance-orange/40 dark:bg-card/50 dark:border-performance-orange/30">
            <div className="relative inline-block mb-4">
              <div className="absolute inset-0 bg-performance-orange/10 dark:bg-performance-orange/20 rounded-full blur-xl"></div>
              <Clock className="relative w-10 h-10 text-performance-orange mx-auto dark:drop-shadow-[0_0_8px_rgba(255,107,53,0.6)]" />
            </div>
            <div className="text-2xl font-bold text-foreground">{timeSavedHours}h</div>
            <div className="text-sm text-muted-foreground mt-1">Time Saved Daily</div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Real AI Insights */}
        <RealAIInsights maxInsights={3} />

        {/* System Alerts */}
        <Card className="card-premium p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold">System Alerts</h3>
            <Button variant="outline" size="sm">
              View All
            </Button>
          </div>
          
          {systemAlerts.length > 0 ? (
            <div className="space-y-4">
              {systemAlerts.map((alert, index) => (
                <div key={index} className="flex items-start space-x-3 p-3 rounded-lg bg-muted/30">
                  {getAlertIcon(alert.type)}
                  <div className="flex-1">
                    <div className="text-sm font-medium">{alert.message}</div>
                    <div className="flex items-center justify-between mt-1">
                      <div className="text-xs text-muted-foreground">{alert.time}</div>
                      <Badge className={getPriorityColor(alert.priority)}>
                        {alert.priority}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-50 text-success" />
              <p>No pending alerts</p>
            </div>
          )}
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="card-premium p-6">
        <h3 className="text-xl font-semibold mb-6">Quick Actions</h3>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {quickActions.map((action, index) => (
            <div key={index} className="p-4 rounded-lg bg-muted/30 border border-primary/10 hover-scale cursor-pointer group">
              <div className="text-center">
                <div className="p-3 rounded-lg bg-primary/10 mb-3 group-hover:bg-primary/20 transition-smooth">
                  <action.icon className={`w-6 h-6 ${action.color} mx-auto`} />
                </div>
                <div className="text-sm font-medium">{action.title}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}
