import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TabsContent } from "@/components/ui/tabs";
import { ModuleTabs } from "@/components/common/ModuleTabs";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { AskRariQuickAction } from "@/components/common/AskRariQuickAction";
import { SkeletonCard, SkeletonLineChart } from "@/components/ui/skeleton-card";
import { SkeletonAIInsight, SkeletonStatsRow } from "@/components/ui/skeleton-specialized";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { 
  Brain, 
  Zap, 
  AlertTriangle, 
  TrendingUp,
  TrendingDown,
  MessageSquare,
  Settings,
  CheckCircle,
  Sparkles,
  Bell,
  Activity
} from "lucide-react";
import { AddVehicleDialog } from "@/components/dialogs/AddVehicleDialog";
import { NewBookingDialog } from "@/components/dialogs/NewBookingDialog";
import { ScheduleMaintenanceDialog } from "@/components/dialogs/ScheduleMaintenanceDialog";
import { SendMessageDialog } from "@/components/dialogs/SendMessageDialog";
import { GenerateReportDialog } from "@/components/dialogs/GenerateReportDialog";
import { PriceOptimizationDialog } from "@/components/dialogs/PriceOptimizationDialog";
import { RariVoiceInterface } from "@/components/rari/RariVoiceInterface";
import { AISettingsSection } from "@/components/dashboard/AISettingsSection";
import { formatDistanceToNow } from "date-fns";

interface RariInsight {
  id: string;
  title: string;
  description: string;
  priority: string;
  action_items: any;
  metadata: any;
  is_read: boolean;
  is_dismissed: boolean;
  created_at: string;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
  data: any;
}

export const CoreEnhanced = () => {
  const { vehicles, bookings, createVehicle, createBooking, createMaintenance, sendMessage, generateReport, applyPriceOptimization, loading } = useLocationFilteredFleet();
  const { user } = useAuth();
  
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [showCreateBooking, setShowCreateBooking] = useState(false);
  const [showScheduleMaintenance, setShowScheduleMaintenance] = useState(false);
  const [showSendMessage, setShowSendMessage] = useState(false);
  const [showGenerateReport, setShowGenerateReport] = useState(false);
  const [showUpdatePricing, setShowUpdatePricing] = useState(false);

  const [insights, setInsights] = useState<RariInsight[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(true);

  // Fetch real insights from rari_insights table
  useEffect(() => {
    if (!user?.id) return;
    
    const fetchData = async () => {
      setInsightsLoading(true);
      
      const [insightsRes, notificationsRes] = await Promise.all([
        supabase
          .from('rari_insights')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_dismissed', false)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10)
      ]);

      if (insightsRes.data) {
        setInsights(insightsRes.data as unknown as RariInsight[]);
      }
      if (notificationsRes.data) {
        setNotifications(notificationsRes.data as Notification[]);
      }
      setInsightsLoading(false);
    };

    fetchData();
  }, [user?.id]);

  // Compute real performance metrics from fleet data
  const activeVehicles = vehicles.filter(v => v.status === 'available' || v.status === 'rented').length;
  const totalVehicles = vehicles.length;
  const activeBookings = bookings.filter(b => b.status === 'confirmed' || b.status === 'active').length;
  const utilizationRate = totalVehicles > 0 
    ? Math.round((bookings.filter(b => b.status === 'active').length / totalVehicles) * 100) 
    : 0;

  const performanceMetrics = [
    { 
      label: "Fleet Size", 
      value: totalVehicles.toString(), 
      subtitle: `${activeVehicles} available`,
      icon: Activity
    },
    { 
      label: "Active Bookings", 
      value: activeBookings.toString(), 
      subtitle: "Currently active",
      icon: TrendingUp
    },
    { 
      label: "Utilization", 
      value: `${utilizationRate}%`, 
      subtitle: totalVehicles > 0 ? "Of fleet in use" : "No vehicles yet",
      icon: utilizationRate > 50 ? TrendingUp : TrendingDown
    },
    { 
      label: "AI Insights", 
      value: insights.filter(i => !i.is_read).length.toString(), 
      subtitle: "Unread insights",
      icon: Sparkles
    }
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

  const getNotificationPriority = (type: string) => {
    if (type === 'alert' || type === 'error') return 'high';
    if (type === 'warning') return 'medium';
    return 'low';
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="space-y-2">
              <div className="h-8 w-48 bg-muted rounded animate-pulse" />
              <div className="h-4 w-32 bg-muted/60 rounded animate-pulse" />
            </div>
            <div className="h-8 w-20 bg-primary/20 rounded-full animate-pulse" />
          </div>
          <SkeletonStatsRow count={3} />
        </Card>
        <div className="h-12 bg-muted/50 rounded-lg animate-pulse" />
        <SkeletonAIInsight />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkeletonLineChart height={200} />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4 sm:space-y-6">
      {/* AI Command Center Header */}
      <Card className="card-premium p-4 border-border">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-xl sm:text-2xl font-bold">FleetCopilot™</h2>
            <Badge className="bg-primary text-primary-foreground border-transparent px-2 py-0.5 text-xs shadow-sm">
              <Brain className="w-3 h-3 mr-1" />
              Active
            </Badge>
          </div>
          
          <div className="hidden sm:flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/5 border border-primary/10">
              <span className="text-sm font-semibold">24/7</span>
              <span className="text-[10px] text-muted-foreground">Monitoring</span>
            </div>
            {totalVehicles > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-success/5 border border-success/10">
                <span className="text-sm font-semibold">{totalVehicles}</span>
                <span className="text-[10px] text-muted-foreground">Vehicles</span>
              </div>
            )}
            {insights.length > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-accent/5 border border-accent/10">
                <span className="text-sm font-semibold">{insights.filter(i => !i.is_read).length}</span>
                <span className="text-[10px] text-muted-foreground">Insights</span>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <ModuleTabs
        tabs={[
          { id: "rari", label: "Rari", shortLabel: "Rari", icon: Brain },
          { id: "insights", label: "Insights", shortLabel: "Stats", icon: Zap },
          { id: "ai-settings", label: "AI Settings", shortLabel: "AI", icon: Settings },
        ]}
        defaultValue="rari"
      >
        <TabsContent value="rari">
          <Card className="card-premium p-0 overflow-hidden">
            <RariVoiceInterface />
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          {/* Real Performance Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {performanceMetrics.map((metric, index) => {
              const Icon = metric.icon;
              return (
                <Card key={index} className="card-premium p-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-2xl font-bold">{metric.value}</div>
                    <Icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="text-sm font-medium mb-1">{metric.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {metric.subtitle}
                  </div>
                </Card>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Real AI Insights from rari_insights */}
            <Card className="card-premium p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold">AI Insights</h3>
                {insights.length > 0 && (
                  <Badge className="bg-primary/10 text-primary border-primary/20">
                    <Zap className="w-3 h-3 mr-1" />
                    {insights.filter(i => !i.is_read).length} Active
                  </Badge>
                )}
              </div>
              
              <div className="space-y-4">
                {insightsLoading ? (
                  <SkeletonAIInsight />
                ) : insights.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No AI insights yet</p>
                    <p className="text-xs mt-1">
                      {totalVehicles === 0 
                        ? "Add vehicles to your fleet to start receiving insights"
                        : "Insights will appear as Rari analyzes your fleet data"}
                    </p>
                  </div>
                ) : (
                  insights.slice(0, 5).map((insight) => (
                    <div key={insight.id} className="p-4 rounded-lg bg-muted/30 border border-primary/20">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-sm">{insight.title}</h4>
                            <AskRariQuickAction
                              variant="icon"
                              prompt={`Explain this AI insight in detail: ${insight.title}. ${insight.description}. What should I do?`}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">{insight.description}</p>
                          <div className="flex items-center space-x-4 text-xs">
                            {insight.metadata?.impact && (
                              <span className="font-medium text-success">{String(insight.metadata.impact)}</span>
                            )}
                            {insight.metadata?.confidence && (
                              <span className="text-muted-foreground">
                                Confidence: {String(insight.metadata.confidence)}%
                              </span>
                            )}
                          </div>
                        </div>
                        <Badge className={getPriorityColor(insight.priority)}>
                          {insight.priority}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>

            {/* Real System Alerts from notifications */}
            <Card className="card-premium p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold">System Alerts</h3>
                {notifications.length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {notifications.filter(n => !n.read).length} unread
                  </Badge>
                )}
              </div>
              
              <div className="space-y-4">
                {insightsLoading ? (
                  <SkeletonAIInsight />
                ) : notifications.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No alerts</p>
                    <p className="text-xs mt-1">System alerts will appear here</p>
                  </div>
                ) : (
                  notifications.slice(0, 6).map((notification) => {
                    const priority = getNotificationPriority(notification.type);
                    return (
                      <div key={notification.id} className="flex items-start space-x-3 p-3 rounded-lg bg-muted/30">
                        {getAlertIcon(notification.type)}
                        <div className="flex-1">
                          <div className="text-sm font-medium">{notification.message || notification.title}</div>
                          <div className="flex items-center justify-between mt-1">
                            <div className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                            </div>
                            <Badge className={getPriorityColor(priority)}>
                              {priority}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="ai-settings" className="space-y-6">
          <AISettingsSection />
        </TabsContent>
      </ModuleTabs>

      {/* All Dialogs */}
      <AddVehicleDialog
        open={showAddVehicle}
        onOpenChange={setShowAddVehicle}
        onSubmit={createVehicle}
      />
      
      <NewBookingDialog
        open={showCreateBooking}
        onOpenChange={setShowCreateBooking}
        vehicles={vehicles}
        onSubmit={createBooking}
      />
      
      <ScheduleMaintenanceDialog
        open={showScheduleMaintenance}
        onOpenChange={setShowScheduleMaintenance}
        vehicles={vehicles}
        onSubmit={createMaintenance}
      />
      
      <SendMessageDialog
        open={showSendMessage}
        onOpenChange={setShowSendMessage}
        bookings={bookings}
        onSubmit={sendMessage}
      />
      
      <GenerateReportDialog
        open={showGenerateReport}
        onOpenChange={setShowGenerateReport}
        onGenerate={generateReport}
      />
      
      <PriceOptimizationDialog
        open={showUpdatePricing}
        onOpenChange={setShowUpdatePricing}
        vehicles={vehicles}
        onApply={applyPriceOptimization}
      />
      </div>
    </>
  );
};
export default CoreEnhanced;
