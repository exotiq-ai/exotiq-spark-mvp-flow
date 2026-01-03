import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TabsContent } from "@/components/ui/tabs";
import { ModuleTabs, ModuleTab } from "@/components/common/ModuleTabs";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { AskRariQuickAction } from "@/components/common/AskRariQuickAction";
import { SkeletonCard, SkeletonMetric, SkeletonLineChart } from "@/components/ui/skeleton-card";
import { SkeletonAIInsight, SkeletonStatsRow } from "@/components/ui/skeleton-specialized";
import { 
  Brain, 
  Zap, 
  AlertTriangle, 
  TrendingUp,
  MessageSquare,
  Settings,
  Users,
  CheckCircle
} from "lucide-react";
import { AddVehicleDialog } from "@/components/dialogs/AddVehicleDialog";
import { NewBookingDialog } from "@/components/dialogs/NewBookingDialog";
import { ScheduleMaintenanceDialog } from "@/components/dialogs/ScheduleMaintenanceDialog";
import { SendMessageDialog } from "@/components/dialogs/SendMessageDialog";
import { GenerateReportDialog } from "@/components/dialogs/GenerateReportDialog";
import { PriceOptimizationDialog } from "@/components/dialogs/PriceOptimizationDialog";
import { RariVoiceInterface } from "@/components/rari/RariVoiceInterface";
import { CRMSection } from "@/components/dashboard/CRMSection";
import { UserManagementSection } from "@/components/dashboard/UserManagementSection";
import { SystemSettingsSection } from "@/components/dashboard/SystemSettingsSection";

export const CoreEnhanced = () => {
  const { vehicles, bookings, createVehicle, createBooking, createMaintenance, sendMessage, generateReport, applyPriceOptimization, loading } = useLocationFilteredFleet();
  
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [showCreateBooking, setShowCreateBooking] = useState(false);
  const [showScheduleMaintenance, setShowScheduleMaintenance] = useState(false);
  const [showSendMessage, setShowSendMessage] = useState(false);
  const [showGenerateReport, setShowGenerateReport] = useState(false);
  const [showUpdatePricing, setShowUpdatePricing] = useState(false);

  const aiInsights = [
    {
      title: "Pricing Optimization Opportunity",
      description: "McLaren 720S is underpriced by $75/day based on demand patterns",
      impact: "+$2,250/month",
      confidence: "94%",
      priority: "high",
      action: "Adjust pricing strategy"
    },
    {
      title: "Fleet Utilization Alert",
      description: "BMW i8 has been idle for 5 days. Consider promotional pricing",
      impact: "+$840/week",
      confidence: "87%", 
      priority: "medium",
      action: "Create special offer"
    },
    {
      title: "Customer Retention Risk",
      description: "3 VIP customers haven't booked in 30+ days",
      impact: "-$1,200/month",
      confidence: "78%",
      priority: "high",
      action: "Launch retention campaign"
    }
  ];

  const systemAlerts = [
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
    },
    {
      type: "error",
      message: "Maintenance required: Porsche 911 GT3 service overdue",
      time: "4 hours ago",
      priority: "high"
    }
  ];

  const performanceMetrics = [
    { label: "AI Accuracy", value: "94.2%", change: "+2.1%", trend: "up" },
    { label: "Automation Rate", value: "87%", change: "+5%", trend: "up" },
    { label: "Response Time", value: "1.2s", change: "-0.3s", trend: "up" },
    { label: "Cost Savings", value: "$4,250", change: "+12%", trend: "up" }
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

  if (loading) {
    return (
      <div className="space-y-6">
        {/* AI Command Center skeleton */}
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
        
        {/* Tabs skeleton */}
        <div className="h-12 bg-muted/50 rounded-lg animate-pulse" />
        
        {/* Content skeleton */}
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
      {/* AI Command Center Header - Compact */}
      <Card className="card-premium p-4 border-border">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-xl sm:text-2xl font-bold">FleetCopilot™</h2>
            <Badge className="bg-primary text-primary-foreground border-transparent px-2 py-0.5 text-xs shadow-sm">
              <Brain className="w-3 h-3 mr-1" />
              Active
            </Badge>
          </div>
          
          {/* Inline Stats - Hidden on mobile since numbers lack context */}
          <div className="hidden sm:flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/5 border border-primary/10">
              <span className="text-sm font-semibold">24/7</span>
              <span className="text-[10px] text-muted-foreground">Monitoring</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-success/5 border border-success/10">
              <span className="text-sm font-semibold">87%</span>
              <span className="text-[10px] text-muted-foreground">Automated</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-accent/5 border border-accent/10">
              <span className="text-sm font-semibold">4.2h</span>
              <span className="text-[10px] text-muted-foreground">Saved</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Streamlined Tabs - AI-Focused */}
      <ModuleTabs
        tabs={[
          { id: "rari", label: "Rari", shortLabel: "Rari", icon: Brain },
          { id: "insights", label: "Insights", shortLabel: "Stats", icon: Zap },
          { id: "settings", label: "Settings", shortLabel: "Setup", icon: Settings },
        ]}
        defaultValue="rari"
      >
        <TabsContent value="rari">
          <Card className="card-premium p-0 overflow-hidden">
            <RariVoiceInterface />
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          {/* Performance Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {performanceMetrics.map((metric, index) => (
              <Card key={index} className="card-premium p-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-2xl font-bold">{metric.value}</div>
                  <TrendingUp className="h-5 w-5 text-success" />
                </div>
                <div className="text-sm font-medium mb-1">{metric.label}</div>
                <div className="text-xs text-success">
                  {metric.change} vs last month
                </div>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* AI Insights */}
            <Card className="card-premium p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold">AI Insights</h3>
                <Badge className="bg-primary/10 text-primary border-primary/20">
                  <Zap className="w-3 h-3 mr-1" />
                  3 Active
                </Badge>
              </div>
              
              <div className="space-y-4">
                {aiInsights.map((insight, index) => (
                  <div key={index} className="p-4 rounded-lg bg-muted/30 border border-primary/20">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-sm">{insight.title}</h4>
                          <AskRariQuickAction
                            variant="icon"
                            prompt={`Explain this AI insight in detail: ${insight.title}. ${insight.description}. Expected impact: ${insight.impact}. What should I do?`}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">{insight.description}</p>
                        <div className="flex items-center space-x-4 text-xs">
                          <span className="font-medium text-success">{insight.impact}</span>
                          <span className="text-muted-foreground">Confidence: {insight.confidence}</span>
                        </div>
                      </div>
                      <Badge className={getPriorityColor(insight.priority)}>
                        {insight.priority}
                      </Badge>
                    </div>
                    
                    <Button size="sm" variant="outline" className="w-full">
                      {insight.action}
                    </Button>
                  </div>
                ))}
              </div>
            </Card>

            {/* System Alerts */}
            <Card className="card-premium p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold">System Alerts</h3>
                <Button variant="outline" size="sm">
                  View All
                </Button>
              </div>
              
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
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <UserManagementSection />
          <SystemSettingsSection />
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