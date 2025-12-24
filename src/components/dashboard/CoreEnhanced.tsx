import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFleet } from "@/contexts/FleetContext";
import { AskRariQuickAction } from "@/components/common/AskRariQuickAction";
import { SkeletonCard, SkeletonMetric } from "@/components/ui/skeleton-card";
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
  const { vehicles, bookings, createVehicle, createBooking, createMaintenance, sendMessage, generateReport, applyPriceOptimization, loading } = useFleet();
  
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
        <SkeletonCard />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <SkeletonMetric />
          <SkeletonMetric />
          <SkeletonMetric />
        </div>
        <SkeletonCard />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
      {/* AI Command Center Header - Simplified */}
      <Card className="card-premium p-6 border-border">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold">FleetCopilot™</h2>
            <p className="text-muted-foreground mt-1">AI Command Center</p>
          </div>
          <Badge className="bg-primary text-primary-foreground border-transparent px-3 py-1.5 shadow-md">
            <Brain className="w-4 h-4 mr-2" />
            Active
          </Badge>
        </div>
        
        {/* Compact Stats Row */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 rounded-xl bg-primary/5 border border-primary/10">
            <div className="text-xl font-bold">24/7</div>
            <div className="text-xs text-muted-foreground mt-0.5">Monitoring</div>
          </div>
          <div className="text-center p-4 rounded-xl bg-success/5 border border-success/10">
            <div className="text-xl font-bold">87%</div>
            <div className="text-xs text-muted-foreground mt-0.5">Automated</div>
          </div>
          <div className="text-center p-4 rounded-xl bg-accent/5 border border-accent/10">
            <div className="text-xl font-bold">4.2h</div>
            <div className="text-xs text-muted-foreground mt-0.5">Saved Daily</div>
          </div>
        </div>
      </Card>

      {/* Streamlined Tabs - 4 instead of 6 */}
      <Tabs defaultValue="rari" className="w-full">
        <TabsList className="grid w-full grid-cols-4 gap-1 h-auto p-1">
          <TabsTrigger value="rari" className="py-2.5 text-sm">
            <Brain className="w-4 h-4 mr-2" />
            Rari
          </TabsTrigger>
          <TabsTrigger value="crm" className="py-2.5 text-sm">
            <Users className="w-4 h-4 mr-2" />
            CRM
          </TabsTrigger>
          <TabsTrigger value="insights" className="py-2.5 text-sm">
            <Zap className="w-4 h-4 mr-2" />
            Insights
          </TabsTrigger>
          <TabsTrigger value="settings" className="py-2.5 text-sm">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rari" className="mt-4">
          <Card className="card-premium p-0 overflow-hidden">
            <RariVoiceInterface />
          </Card>
        </TabsContent>

        <TabsContent value="crm" className="mt-4">
          <CRMSection />
        </TabsContent>

        <TabsContent value="insights" className="space-y-6 mt-4">

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

        <TabsContent value="settings" className="mt-4 space-y-6">
          <UserManagementSection />
          <SystemSettingsSection />
        </TabsContent>
      </Tabs>

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