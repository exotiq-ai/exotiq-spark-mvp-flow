import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFleet } from "@/contexts/FleetContext";
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
  const { vehicles, bookings, createVehicle, createBooking, createMaintenance, sendMessage, generateReport, applyPriceOptimization } = useFleet();
  
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

  const quickActions = [
    { 
      title: "Add New Vehicle", 
      icon: Car, 
      color: "text-primary",
      onClick: () => setShowAddVehicle(true)
    },
    { 
      title: "Create Booking", 
      icon: Users, 
      color: "text-success",
      onClick: () => setShowCreateBooking(true)
    },
    { 
      title: "Generate Report", 
      icon: BarChart3, 
      color: "text-accent",
      onClick: () => setShowGenerateReport(true)
    },
    { 
      title: "Update Pricing", 
      icon: DollarSign, 
      color: "text-warning",
      onClick: () => setShowUpdatePricing(true)
    },
    { 
      title: "Schedule Maintenance", 
      icon: Settings, 
      color: "text-destructive",
      onClick: () => setShowScheduleMaintenance(true)
    },
    { 
      title: "Send Message", 
      icon: MessageSquare, 
      color: "text-purple-500",
      onClick: () => setShowSendMessage(true)
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

  return (
    <div className="space-y-6">
      {/* AI Command Center Header */}
      <Card className="card-premium p-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl font-bold">FleetCopilot™</h2>
            <p className="text-xl text-muted-foreground mt-1">AI Command Center & CRM</p>
          </div>
          <Badge className="bg-primary/10 text-primary border-primary/20 text-lg px-4 py-2">
            <Brain className="w-5 h-5 mr-2" />
            Rari FleetCopilot™ Active
          </Badge>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-4 rounded-lg bg-white/50 border border-primary/20">
            <Brain className="w-8 h-8 text-primary mx-auto mb-3" />
            <div className="text-lg font-bold">24/7</div>
            <div className="text-sm text-muted-foreground">AI Monitoring</div>
          </div>
          
          <div className="text-center p-4 rounded-lg bg-white/50 border border-primary/20">
            <Zap className="w-8 h-8 text-success mx-auto mb-3" />
            <div className="text-lg font-bold">87%</div>
            <div className="text-sm text-muted-foreground">Tasks Automated</div>
          </div>
          
          <div className="text-center p-4 rounded-lg bg-white/50 border border-primary/20">
            <Clock className="w-8 h-8 text-accent mx-auto mb-3" />
            <div className="text-lg font-bold">4.2h</div>
            <div className="text-sm text-muted-foreground">Time Saved Daily</div>
          </div>
        </div>
      </Card>

      {/* Tabbed Interface for Rari, AI Insights & CRM */}
      <Tabs defaultValue="rari" className="w-full">
        <TabsList className="grid w-full grid-cols-6 gap-1">
          <TabsTrigger value="rari" className="text-primary text-xs sm:text-sm">
            <Brain className="w-4 h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Talk to</span> Rari
          </TabsTrigger>
          <TabsTrigger value="crm" className="text-xs sm:text-sm">
            <Users className="w-4 h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Customer</span> CRM
          </TabsTrigger>
          <TabsTrigger value="insights" className="text-xs sm:text-sm">
            <Brain className="w-4 h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">AI</span> Insights
          </TabsTrigger>
          <TabsTrigger value="actions" className="text-xs sm:text-sm">
            <Zap className="w-4 h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Quick</span> Actions
          </TabsTrigger>
          <TabsTrigger value="users" className="text-xs sm:text-sm">
            <Users className="w-4 h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">User</span> Mgmt
          </TabsTrigger>
          <TabsTrigger value="settings" className="text-xs sm:text-sm">
            <Settings className="w-4 h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">System</span> Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rari">
          <Card className="card-premium p-0 overflow-hidden">
            <RariVoiceInterface />
          </Card>
        </TabsContent>

        <TabsContent value="crm">
          <CRMSection />
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
                    <h4 className="font-semibold text-sm mb-1">{insight.title}</h4>
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

        <TabsContent value="actions">
          <Card className="card-premium p-6">
            <h3 className="text-xl font-semibold mb-6">Quick Actions</h3>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {quickActions.map((action, index) => (
                <div 
                  key={index} 
                  onClick={action.onClick}
                  className="p-4 rounded-lg bg-muted/30 border border-primary/10 hover-scale cursor-pointer group"
                >
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
        </TabsContent>

        <TabsContent value="users">
          <UserManagementSection />
        </TabsContent>

        <TabsContent value="settings">
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
  );
};