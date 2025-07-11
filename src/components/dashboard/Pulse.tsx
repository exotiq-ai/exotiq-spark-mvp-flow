import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart3, 
  TrendingUp, 
  Calendar, 
  Car, 
  DollarSign,
  Eye,
  Download,
  RefreshCw,
  Activity,
  Target
} from "lucide-react";

const Pulse = () => {
  const [timeRange, setTimeRange] = useState("30d");

  const bookingData = [
    { month: "Jan", bookings: 12, revenue: 18400 },
    { month: "Feb", bookings: 15, revenue: 22100 },
    { month: "Mar", bookings: 18, revenue: 28800 },
    { month: "Apr", bookings: 14, revenue: 21600 },
    { month: "May", bookings: 22, revenue: 34200 },
    { month: "Jun", bookings: 25, revenue: 38750 }
  ];

  const vehiclePerformance = [
    {
      vehicle: "Ferrari 488 GTB",
      bookings: 18,
      revenue: 8100,
      utilization: 60,
      avgDailyRate: 450,
      trend: "up"
    },
    {
      vehicle: "Lamborghini Huracan",
      bookings: 24,
      revenue: 12480,
      utilization: 80,
      avgDailyRate: 520,
      trend: "up"
    },
    {
      vehicle: "McLaren 720S",
      bookings: 11,
      revenue: 4180,
      utilization: 36,
      avgDailyRate: 380,
      trend: "down"
    },
    {
      vehicle: "Porsche 911 Turbo",
      bookings: 16,
      revenue: 6400,
      utilization: 53,
      avgDailyRate: 400,
      trend: "stable"
    }
  ];

  const forecasts = [
    {
      metric: "Revenue",
      current: "$38,750",
      predicted: "$42,500",
      confidence: 87,
      period: "Next 30 days"
    },
    {
      metric: "Bookings",
      current: "25",
      predicted: "29",
      confidence: 79,
      period: "Next 30 days"
    },
    {
      metric: "Utilization",
      current: "67%",
      predicted: "73%",
      confidence: 82,
      period: "Next 30 days"
    }
  ];

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "up":
        return <TrendingUp className="h-4 w-4 text-success" />;
      case "down":
        return <TrendingUp className="h-4 w-4 text-destructive rotate-180" />;
      default:
        return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary">Pulse</h1>
          <p className="text-muted-foreground">Live Fleet Analytics</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Data
          </Button>
          <Button variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Time Range Selector */}
      <div className="flex space-x-2">
        {["7d", "30d", "90d", "1y"].map((range) => (
          <Button
            key={range}
            variant={timeRange === range ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeRange(range)}
          >
            {range === "7d" ? "7 Days" : 
             range === "30d" ? "30 Days" : 
             range === "90d" ? "90 Days" : "1 Year"}
          </Button>
        ))}
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <Calendar className="h-5 w-5 text-primary" />
            <Badge className="metric-positive">+16%</Badge>
          </div>
          <div className="text-2xl font-bold text-primary">25</div>
          <div className="text-sm text-muted-foreground">Total Bookings</div>
        </Card>

        <Card className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="h-5 w-5 text-success" />
            <Badge className="metric-positive">+12%</Badge>
          </div>
          <div className="text-2xl font-bold text-primary">$38,750</div>
          <div className="text-sm text-muted-foreground">Total Revenue</div>
        </Card>

        <Card className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <Car className="h-5 w-5 text-accent" />
            <Badge className="metric-positive">+8%</Badge>
          </div>
          <div className="text-2xl font-bold text-primary">67%</div>
          <div className="text-sm text-muted-foreground">Fleet Utilization</div>
        </Card>

        <Card className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <BarChart3 className="h-5 w-5 text-warning" />
            <Badge variant="outline">$467</Badge>
          </div>
          <div className="text-2xl font-bold text-primary">4.2</div>
          <div className="text-sm text-muted-foreground">Avg Booking Days</div>
        </Card>
      </div>

      <Tabs defaultValue="performance" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="performance">Vehicle Performance</TabsTrigger>
          <TabsTrigger value="trends">Revenue Trends</TabsTrigger>
          <TabsTrigger value="forecasts">AI Forecasts</TabsTrigger>
        </TabsList>
        
        <TabsContent value="performance" className="space-y-6">
          <Card className="card-premium">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Vehicle Performance Analysis</h3>
              <Eye className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 font-medium">Vehicle</th>
                    <th className="text-left py-3 font-medium">Bookings</th>
                    <th className="text-left py-3 font-medium">Revenue</th>
                    <th className="text-left py-3 font-medium">Utilization</th>
                    <th className="text-left py-3 font-medium">Avg Rate</th>
                    <th className="text-left py-3 font-medium">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {vehiclePerformance.map((vehicle, index) => (
                    <tr key={index} className="border-b border-border/50">
                      <td className="py-4">
                        <div className="flex items-center space-x-3">
                          <Car className="h-5 w-5 text-muted-foreground" />
                          <span className="font-medium">{vehicle.vehicle}</span>
                        </div>
                      </td>
                      <td className="py-4">{vehicle.bookings}</td>
                      <td className="py-4 metric-positive">${vehicle.revenue.toLocaleString()}</td>
                      <td className="py-4">
                        <div className="flex items-center space-x-2">
                          <div className={`w-12 h-2 rounded-full ${
                            vehicle.utilization >= 70 ? 'bg-success' :
                            vehicle.utilization >= 40 ? 'bg-warning' : 'bg-destructive'
                          }`}>
                            <div 
                              className="h-full bg-current rounded-full"
                              style={{ width: `${vehicle.utilization}%` }}
                            />
                          </div>
                          <span className="text-sm">{vehicle.utilization}%</span>
                        </div>
                      </td>
                      <td className="py-4">${vehicle.avgDailyRate}/day</td>
                      <td className="py-4">
                        {getTrendIcon(vehicle.trend)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <Card className="card-premium">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Revenue & Booking Trends</h3>
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
            </div>
            
            {/* Simple chart representation */}
            <div className="space-y-4">
              {bookingData.map((month, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center space-x-4">
                    <span className="font-medium w-12">{month.month}</span>
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-primary" />
                      <span className="text-sm">{month.bookings} bookings</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className="font-bold text-success">${month.revenue.toLocaleString()}</span>
                    <div className={`w-20 h-2 rounded-full bg-muted`}>
                      <div 
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${(month.revenue / 40000) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="forecasts" className="space-y-6">
          <Card className="card-premium">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">AI-Powered Forecasts</h3>
              <Target className="h-5 w-5 text-accent" />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {forecasts.map((forecast, index) => (
                <div key={index} className="p-4 rounded-lg bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{forecast.metric}</span>
                    <Badge variant="outline" className="text-xs">
                      {forecast.confidence}% confidence
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Current</span>
                      <span className="text-sm font-medium">{forecast.current}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Predicted</span>
                      <span className="text-sm font-bold text-primary">{forecast.predicted}</span>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">{forecast.period}</div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Pulse;