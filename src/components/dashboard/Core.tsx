import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Brain, Users, MessageSquare, Settings, AlertTriangle, Shield, Bell, Activity, TrendingUp, Database, Server, Zap } from "lucide-react";

const Core = () => {
  const systemMetrics = [
    { label: "System Uptime", value: "99.8%", status: "excellent" },
    { label: "Response Time", value: "120ms", status: "good" },
    { label: "Active Users", value: "1,247", status: "normal" },
    { label: "API Calls Today", value: "45,892", status: "normal" }
  ];

  const aiAlerts = [
    {
      type: "pricing",
      priority: "high",
      title: "Dynamic Pricing Opportunity",
      message: "Weekend demand surge detected. Increase rates by 25% for Ferrari 488.",
      timestamp: "2 minutes ago",
      action: "auto_pricing"
    },
    {
      type: "maintenance",
      priority: "medium", 
      title: "Predictive Maintenance Alert",
      message: "McLaren 720S showing unusual vibration patterns. Service recommended.",
      timestamp: "15 minutes ago",
      action: "schedule_service"
    },
    {
      type: "customer",
      priority: "low",
      title: "Customer Satisfaction Insight",
      message: "VIP customer James Wilson highly satisfied. Consider loyalty program.",
      timestamp: "1 hour ago",
      action: "customer_outreach"
    }
  ];

  const adminActions = [
    { name: "Backup Database", status: "completed", lastRun: "2 hours ago" },
    { name: "System Health Check", status: "running", lastRun: "5 minutes ago" },
    { name: "Price Optimization", status: "scheduled", lastRun: "Daily at 6 AM" },
    { name: "Customer Analytics", status: "completed", lastRun: "30 minutes ago" }
  ];

  const userActivity = [
    { user: "James Wilson", action: "Completed booking", time: "5 min ago", type: "booking" },
    { user: "Sarah Chen", action: "Updated payment method", time: "12 min ago", type: "account" },
    { user: "Michael R.", action: "Submitted review", time: "25 min ago", type: "review" },
    { user: "Admin User", action: "Updated vehicle pricing", time: "1 hour ago", type: "admin" }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary">Core</h1>
          <p className="text-muted-foreground">Admin Control Center</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline">
            <Database className="h-4 w-4 mr-2" />
            System Status
          </Button>
          <Button className="btn-premium">
            <Settings className="h-4 w-4 mr-2" />
            Admin Settings
          </Button>
        </div>
      </div>

      {/* System Health Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <Server className="h-5 w-5 text-success" />
            <Badge className="bg-success/10 text-success">Live</Badge>
          </div>
          <div className="text-2xl font-bold text-primary">99.8%</div>
          <div className="text-sm text-muted-foreground">System Uptime</div>
        </Card>

        <Card className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <Users className="h-5 w-5 text-primary" />
            <Badge variant="outline">+12</Badge>
          </div>
          <div className="text-2xl font-bold text-primary">1,247</div>
          <div className="text-sm text-muted-foreground">Active Users</div>
        </Card>

        <Card className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <MessageSquare className="h-5 w-5 text-accent" />
            <Badge className="metric-positive">+8%</Badge>
          </div>
          <div className="text-2xl font-bold text-primary">45.8K</div>
          <div className="text-sm text-muted-foreground">API Calls Today</div>
        </Card>

        <Card className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <Brain className="h-5 w-5 text-warning" />
            <Badge className="bg-warning/10 text-warning">3 Active</Badge>
          </div>
          <div className="text-2xl font-bold text-primary">87%</div>
          <div className="text-sm text-muted-foreground">AI Accuracy</div>
        </Card>
      </div>

      <Tabs defaultValue="alerts" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="alerts">AI Alerts</TabsTrigger>
          <TabsTrigger value="users">User Activity</TabsTrigger>
          <TabsTrigger value="system">System Tasks</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>
        
        <TabsContent value="alerts" className="space-y-6">
          <Card className="card-premium">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">AI-Generated Alerts</h3>
              <div className="flex items-center space-x-2">
                <Brain className="h-5 w-5 text-accent" />
                <Badge variant="outline">{aiAlerts.length} active</Badge>
              </div>
            </div>
            
            <div className="space-y-4">
              {aiAlerts.map((alert, index) => (
                <div key={index} className={`p-4 rounded-lg border ${
                  alert.priority === 'high' ? 'bg-destructive/5 border-destructive/20' :
                  alert.priority === 'medium' ? 'bg-warning/5 border-warning/20' :
                  'bg-muted/30 border-border'
                }`}>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <AlertTriangle className={`h-4 w-4 ${
                          alert.priority === 'high' ? 'text-destructive' :
                          alert.priority === 'medium' ? 'text-warning' : 'text-muted-foreground'
                        }`} />
                        <span className="font-medium">{alert.title}</span>
                        <Badge variant={
                          alert.priority === 'high' ? 'destructive' :
                          alert.priority === 'medium' ? 'secondary' : 'outline'
                        }>
                          {alert.priority}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{alert.message}</p>
                      <p className="text-xs text-muted-foreground">{alert.timestamp}</p>
                    </div>
                    
                    <div className="flex space-x-2">
                      <Button size="sm" variant="outline">Dismiss</Button>
                      <Button size="sm">Take Action</Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <Card className="card-premium">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Recent User Activity</h3>
              <Activity className="h-5 w-5 text-muted-foreground" />
            </div>
            
            <div className="space-y-3">
              {userActivity.map((activity, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${
                      activity.type === 'booking' ? 'bg-success' :
                      activity.type === 'account' ? 'bg-primary' :
                      activity.type === 'review' ? 'bg-accent' : 'bg-warning'
                    }`} />
                    <div>
                      <div className="font-medium text-sm">{activity.user}</div>
                      <div className="text-xs text-muted-foreground">{activity.action}</div>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{activity.time}</span>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-6">
          <Card className="card-premium">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Automated System Tasks</h3>
              <Settings className="h-5 w-5 text-muted-foreground" />
            </div>
            
            <div className="space-y-4">
              {adminActions.map((action, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center space-x-3">
                    <div className={`w-2 h-2 rounded-full ${
                      action.status === 'completed' ? 'bg-success' :
                      action.status === 'running' ? 'bg-warning animate-pulse' : 'bg-muted-foreground'
                    }`} />
                    <div>
                      <div className="font-medium text-sm">{action.name}</div>
                      <div className="text-xs text-muted-foreground">Last run: {action.lastRun}</div>
                    </div>
                  </div>
                  <Badge variant={
                    action.status === 'completed' ? 'default' :
                    action.status === 'running' ? 'secondary' : 'outline'
                  }>
                    {action.status}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="card-premium">
              <h3 className="text-lg font-semibold mb-4">Performance Metrics</h3>
              <div className="space-y-4">
                {systemMetrics.map((metric, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>{metric.label}</span>
                      <span className="font-medium">{metric.value}</span>
                    </div>
                    <Progress 
                      value={
                        metric.label === "System Uptime" ? 99.8 :
                        metric.label === "Response Time" ? 75 :
                        85
                      } 
                      className="h-2" 
                    />
                  </div>
                ))}
              </div>
            </Card>

            <Card className="card-premium">
              <h3 className="text-lg font-semibold mb-4">AI Performance</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Recommendation Accuracy</span>
                  <span className="font-bold text-success">87%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Pricing Optimizations</span>
                  <span className="font-bold text-primary">156</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Anomalies Detected</span>
                  <span className="font-bold text-warning">3</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Revenue Impact</span>
                  <span className="font-bold text-accent">+$12.4K</span>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Core;