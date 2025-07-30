import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Car, 
  TrendingUp, 
  Calendar, 
  Shield, 
  Brain, 
  Users,
  Bell,
  Settings,
  DollarSign,
  BarChart3,
  BookOpen,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Zap,
  MessageSquare,
  Plus
} from "lucide-react";
import { MotorIQ } from "@/components/dashboard/MotorIQ";
import { Pulse } from "@/components/dashboard/Pulse";
import { Book } from "@/components/dashboard/Book";
import { Vault } from "@/components/dashboard/Vault";
import { Core } from "@/components/dashboard/Core";

const Dashboard = () => {
  const [activeModule, setActiveModule] = useState("overview");

  const modules = [
    {
      id: "motoriq",
      name: "MotorIQ",
      icon: TrendingUp,
      description: "Fleet Profitability Engine",
      color: "text-success",
      bgColor: "bg-success/10"
    },
    {
      id: "pulse",
      name: "Pulse",
      icon: BarChart3,
      description: "Live Fleet Analytics",
      color: "text-primary",
      bgColor: "bg-primary/10"
    },
    {
      id: "book",
      name: "Book",
      icon: Calendar,
      description: "Direct Booking Tools",
      color: "text-accent",
      bgColor: "bg-accent/10"
    },
    {
      id: "vault",
      name: "Vault",
      icon: Shield,
      description: "Compliance Hub",
      color: "text-warning",
      bgColor: "bg-warning/10"
    },
    {
      id: "core",
      name: "Core",
      icon: Brain,
      description: "Admin Control Center",
      color: "text-destructive",
      bgColor: "bg-destructive/10"
    }
  ];

  const quickStats = [
    {
      title: "Total Revenue",
      value: "$24,680",
      change: "+12%",
      trend: "up",
      icon: DollarSign
    },
    {
      title: "Active Bookings",
      value: "18",
      change: "+3",
      trend: "up",
      icon: Calendar
    },
    {
      title: "Fleet Utilization",
      value: "78%",
      change: "+5%",
      trend: "up",
      icon: Car
    },
    {
      title: "Avg. Daily Rate",
      value: "$342",
      change: "-2%",
      trend: "down",
      icon: TrendingUp
    }
  ];

  const alerts = [
    {
      type: "warning",
      title: "Vehicle Maintenance Due",
      description: "BMW M4 - Service required by Dec 15",
      icon: AlertTriangle
    },
    {
      type: "success",
      title: "New Booking Confirmed",
      description: "Lamborghini Huracan - 3 days",
      icon: CheckCircle2
    },
    {
      type: "info",
      title: "Insurance Expiring Soon",
      description: "Policy #INS-2024-001 expires in 7 days",
      icon: Clock
    }
  ];

  const renderModuleContent = () => {
    switch (activeModule) {
      case "motoriq":
        return <MotorIQ />;
      case "pulse":
        return <Pulse />;
      case "book":
        return <Book />;
      case "vault":
        return <Vault />;
      case "core":
        return <Core />;
      default:
        return (
          <div className="space-y-8">
            {/* Quick Stats */}
            <div className="mobile-grid gap-4 sm:gap-6">
              {quickStats.map((stat, index) => (
                <Card key={index} className="stat-card">
                  <div className="flex items-center justify-between mb-2">
                    <stat.icon className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                    <Badge variant={stat.trend === "up" ? "default" : "destructive"} className="text-xs">
                      {stat.change}
                    </Badge>
                  </div>
                  <div className="text-xl sm:text-2xl font-bold text-primary mb-1">{stat.value}</div>
                  <div className="text-xs sm:text-sm text-muted-foreground">{stat.title}</div>
                </Card>
              ))}
            </div>

            {/* Module Grid */}
            <div className="mobile-grid gap-4 sm:gap-6">
              {modules.map((module) => (
                <Card 
                  key={module.id} 
                  className="card-module cursor-pointer touch-target"
                  onClick={() => setActiveModule(module.id)}
                >
                  <div className={`p-3 sm:p-4 rounded-xl ${module.bgColor} mb-3 sm:mb-4 w-fit`}>
                    <module.icon className={`h-6 w-6 sm:h-8 sm:w-8 ${module.color}`} />
                  </div>
                  <h3 className="text-lg sm:text-xl font-semibold mb-2">{module.name}</h3>
                  <p className="mobile-text text-muted-foreground mb-3 sm:mb-4">{module.description}</p>
                  <Button variant="outline" className="w-full mobile-button">
                    Open Module
                  </Button>
                </Card>
              ))}
            </div>

            {/* Recent Activity & Alerts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="card-premium">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Smart Alerts</h3>
                  <Bell className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="space-y-4">
                  {alerts.map((alert, index) => (
                    <div key={index} className="flex items-start space-x-3 p-3 rounded-lg bg-muted/30">
                      <alert.icon className={`h-5 w-5 mt-0.5 ${
                        alert.type === "warning" ? "text-warning" :
                        alert.type === "success" ? "text-success" : "text-primary"
                      }`} />
                      <div className="flex-1">
                        <div className="font-medium text-sm">{alert.title}</div>
                        <div className="text-sm text-muted-foreground">{alert.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="card-premium">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">FleetCopilot™ Assistant</h3>
                  <Zap className="h-5 w-5 text-accent" />
                </div>
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20">
                    <div className="flex items-start space-x-3">
                      <MessageSquare className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <div className="font-medium text-sm mb-1">AI Recommendation</div>
                        <div className="text-sm text-muted-foreground mb-3">
                          Consider increasing the rate for your Ferrari 488 by 15% for weekend bookings. 
                          Market demand shows 89% probability of maintaining bookings at this price point.
                        </div>
                        <div className="flex space-x-2">
                          <Button size="sm" variant="default">Accept</Button>
                          <Button size="sm" variant="outline">Dismiss</Button>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 rounded-lg bg-muted/30">
                    <div className="text-sm text-muted-foreground mb-2">
                      💡 Your McLaren 720S has been idle for 5 days. 
                      <span className="text-accent font-medium"> Consider promotional pricing</span> to increase bookings.
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background mobile-friendly">
      {/* Top Navigation */}
      <nav className="bg-background border-b border-border sticky top-0 z-40">
        <div className="mobile-padding py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <img 
                src="/exotiq-logo.png" 
                alt="ExotIQ Logo" 
                className="h-8 w-auto sm:h-10 sm:w-auto"
              />
              {activeModule !== "overview" && (
                <Badge variant="outline" className="ml-2 sm:ml-4 text-xs sm:text-sm">
                  {modules.find(m => m.id === activeModule)?.name || "Overview"}
                </Badge>
              )}
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <Button variant="ghost" size="sm" className="touch-target">
                <Bell className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="touch-target">
                <Settings className="h-4 w-4" />
              </Button>
              <div className="hidden sm:flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-primary rounded-full flex items-center justify-center">
                  <Users className="h-4 w-4 text-primary-foreground" />
                </div>
                <span className="text-sm font-medium">John Doe</span>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Module Navigation - Desktop */}
      <div className="hidden md:block bg-muted/30 border-b border-border">
        <div className="mobile-padding py-2">
          <Tabs value={activeModule} onValueChange={setActiveModule} className="w-full">
            <TabsList className="grid w-full grid-cols-6 bg-transparent">
              <TabsTrigger 
                value="overview" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs sm:text-sm"
              >
                Overview
              </TabsTrigger>
              {modules.map((module) => (
                <TabsTrigger 
                  key={module.id}
                  value={module.id}
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs sm:text-sm"
                >
                  <module.icon className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">{module.name}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="mobile-nav">
        <div className="grid grid-cols-6 gap-1 p-2">
          <button
            onClick={() => setActiveModule("overview")}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg transition-colors touch-target ${
              activeModule === "overview" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            <BarChart3 className="h-5 w-5 mb-1" />
            <span className="text-xs">Overview</span>
          </button>
          {modules.map((module) => (
            <button
              key={module.id}
              onClick={() => setActiveModule(module.id)}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg transition-colors touch-target ${
                activeModule === module.id ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              <module.icon className="h-5 w-5 mb-1" />
              <span className="text-xs">{module.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <main className="mobile-padding py-4 sm:py-6 pb-20 md:pb-6">
        <div className="max-w-7xl mx-auto mobile-spacing">
          {renderModuleContent()}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;