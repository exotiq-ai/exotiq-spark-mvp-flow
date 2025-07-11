import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart3, 
  TrendingUp, 
  Activity, 
  Eye,
  Calendar,
  Clock,
  Users,
  MapPin
} from "lucide-react";

export const Pulse = () => {
  const liveMetrics = [
    { label: "Active Bookings", value: "8", change: "+2 vs yesterday", trend: "up" },
    { label: "Revenue Today", value: "$1,240", change: "+15% vs yesterday", trend: "up" },
    { label: "Fleet Utilization", value: "67%", change: "-3% vs yesterday", trend: "down" },
    { label: "Avg Daily Rate", value: "$385", change: "+8% vs last week", trend: "up" }
  ];

  const recentActivity = [
    {
      type: "booking",
      message: "New booking: McLaren 720S for 3 days",
      time: "2 minutes ago",
      value: "$1,350"
    },
    {
      type: "payment", 
      message: "Payment received: Lamborghini Huracán",
      time: "15 minutes ago",
      value: "$2,100"
    },
    {
      type: "inquiry",
      message: "Inquiry: Ferrari 488 for weekend",
      time: "32 minutes ago",
      value: "Pending"
    },
    {
      type: "maintenance",
      message: "Maintenance completed: Porsche 911 GT3",
      time: "1 hour ago",
      value: "Available"
    }
  ];

  const upcomingEvents = [
    {
      title: "McLaren 720S Pickup",
      time: "Today, 2:00 PM",
      location: "Downtown Location",
      customer: "John S."
    },
    {
      title: "Ferrari 488 Return",
      time: "Today, 5:30 PM", 
      location: "Airport Location",
      customer: "Maria L."
    },
    {
      title: "Huracán Service",
      time: "Tomorrow, 9:00 AM",
      location: "Service Center",
      customer: "Scheduled Maintenance"
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Pulse</h2>
          <p className="text-muted-foreground mt-1">Live analytics and business insights</p>
        </div>
        <Badge className="bg-success/10 text-success border-success/20">
          <Activity className="w-4 h-4 mr-1" />
          Live
        </Badge>
      </div>

      {/* Live Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {liveMetrics.map((metric, index) => (
          <Card key={index} className="card-premium p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-2xl font-bold">{metric.value}</div>
              {metric.trend === 'up' ? (
                <TrendingUp className="h-5 w-5 text-success" />
              ) : (
                <BarChart3 className="h-5 w-5 text-destructive" />
              )}
            </div>
            <div className="text-sm font-medium mb-1">{metric.label}</div>
            <div className={`text-xs ${metric.trend === 'up' ? 'text-success' : 'text-destructive'}`}>
              {metric.change}
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity Feed */}
        <Card className="card-premium p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold">Recent Activity</h3>
            <Button variant="outline" size="sm">
              <Eye className="w-4 h-4 mr-2" />
              View All
            </Button>
          </div>
          
          <div className="space-y-4">
            {recentActivity.map((activity, index) => (
              <div key={index} className="flex items-start space-x-3 p-3 rounded-lg bg-muted/30">
                <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                <div className="flex-1">
                  <div className="text-sm font-medium">{activity.message}</div>
                  <div className="text-xs text-muted-foreground mt-1">{activity.time}</div>
                </div>
                <div className="text-sm font-semibold">
                  {activity.value}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Upcoming Events */}
        <Card className="card-premium p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold">Upcoming Events</h3>
            <Button variant="outline" size="sm">
              <Calendar className="w-4 h-4 mr-2" />
              Calendar
            </Button>
          </div>
          
          <div className="space-y-4">
            {upcomingEvents.map((event, index) => (
              <div key={index} className="p-3 rounded-lg bg-muted/30 border border-accent/20">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold text-sm">{event.title}</h4>
                  <Badge variant="outline" className="text-xs">
                    {event.time.includes('Today') ? 'Today' : 'Tomorrow'}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center text-xs text-muted-foreground">
                    <Clock className="w-3 h-3 mr-1" />
                    {event.time}
                  </div>
                  <div className="flex items-center text-xs text-muted-foreground">
                    <MapPin className="w-3 h-3 mr-1" />
                    {event.location}
                  </div>
                  <div className="flex items-center text-xs text-muted-foreground">
                    <Users className="w-3 h-3 mr-1" />
                    {event.customer}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Analytics Summary */}
      <Card className="card-premium p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold">Analytics Summary</h3>
          <div className="flex space-x-2">
            <Button variant="outline" size="sm">Last 7 Days</Button>
            <Button variant="outline" size="sm">Last 30 Days</Button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-4 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5">
            <div className="text-3xl font-bold text-primary mb-2">$18,450</div>
            <div className="text-sm text-muted-foreground">Total Revenue (7 days)</div>
            <div className="text-xs text-success mt-1">+12% vs last week</div>
          </div>
          
          <div className="text-center p-4 rounded-lg bg-gradient-to-br from-success/10 to-success/5">
            <div className="text-3xl font-bold text-success mb-2">24</div>
            <div className="text-sm text-muted-foreground">Completed Bookings</div>
            <div className="text-xs text-success mt-1">+8% vs last week</div>
          </div>
          
          <div className="text-center p-4 rounded-lg bg-gradient-to-br from-accent/10 to-accent/5">
            <div className="text-3xl font-bold text-accent mb-2">4.8</div>
            <div className="text-sm text-muted-foreground">Average Rating</div>
            <div className="text-xs text-success mt-1">Consistent</div>
          </div>
        </div>
      </Card>
    </div>
  );
};