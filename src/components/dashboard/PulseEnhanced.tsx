import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Activity, 
  TrendingUp, 
  DollarSign,
  Calendar,
  Clock,
  MapPin,
  User,
  ArrowRight
} from "lucide-react";

export const PulseEnhanced = () => {
  const todayRevenue = {
    amount: "$3,240",
    change: "+12%",
    trend: "up"
  };

  const liveMetrics = [
    { label: "Active Rentals", value: "12", change: "+2", icon: Activity },
    { label: "Today's Bookings", value: "8", change: "+3", icon: Calendar },
    { label: "Avg. Daily Rate", value: "$342", change: "+5%", icon: DollarSign }
  ];

  const recentActivity = [
    {
      type: "booking",
      message: "New booking confirmed",
      vehicle: "McLaren 720S",
      time: "5 min ago",
      value: "$450"
    },
    {
      type: "checkin",
      message: "Vehicle checked in",
      vehicle: "Lamborghini Huracán",
      time: "23 min ago",
      value: "$380"
    },
    {
      type: "payment",
      message: "Payment received",
      vehicle: "Ferrari 488",
      time: "1 hour ago",
      value: "$680"
    }
  ];

  const upcomingEvents = [
    {
      title: "McLaren 720S Pickup",
      time: "2:00 PM",
      location: "Downtown",
      customer: "John Smith"
    },
    {
      title: "Ferrari 488 Return",
      time: "4:30 PM",
      location: "Airport",
      customer: "Sarah Johnson"
    }
  ];

  return (
    <div className="space-y-6">
      {/* Hero Metric */}
      <Card className="card-premium bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20 p-8">
        <div className="flex items-start justify-between mb-4">
          <div>
            <Badge className="bg-primary/20 text-primary border-primary/30 mb-3">
              <Activity className="w-3 h-3 mr-1" />
              Live Now
            </Badge>
            <h2 className="text-5xl font-bold mb-2">{todayRevenue.amount}</h2>
            <p className="text-xl text-muted-foreground">Today's Revenue</p>
          </div>
          <div className="text-right">
            <div className="flex items-center text-success text-2xl font-semibold mb-1">
              <TrendingUp className="w-6 h-6 mr-2" />
              {todayRevenue.change}
            </div>
            <p className="text-sm text-muted-foreground">vs yesterday</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-6">
          {liveMetrics.map((metric, index) => (
            <div key={index} className="bg-card/50 backdrop-blur-sm rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <metric.icon className="h-4 w-4 text-primary" />
                <span className="text-xs text-success">{metric.change}</span>
              </div>
              <div className="text-2xl font-bold">{metric.value}</div>
              <div className="text-xs text-muted-foreground">{metric.label}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Live Telematics Section */}
      <Card className="card-premium p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-semibold">Driver Telematics</h3>
            <p className="text-sm text-muted-foreground mt-1">Real-time driver performance monitoring</p>
          </div>
          <Badge className="bg-primary/20 text-primary border-primary/30">
            <Activity className="w-3 h-3 mr-1" />
            Live
          </Badge>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Driver 1 - High Performance */}
          <div className="p-5 rounded-xl bg-gradient-to-br from-success/10 to-success/5 border border-success/20">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-success/20 rounded-lg">
                  <User className="h-5 w-5 text-success" />
                </div>
                <div>
                  <h4 className="font-semibold">Marcus Chen</h4>
                  <p className="text-xs text-muted-foreground">Lamborghini Huracán</p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-muted-foreground">Performance Score</span>
                  <span className="text-2xl font-bold text-success">86%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-success" style={{ width: '86%' }}></div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <div className="text-xs">
                  <div className="text-muted-foreground">Smooth Driving</div>
                  <div className="font-semibold">Excellent</div>
                </div>
                <div className="text-xs">
                  <div className="text-muted-foreground">Safety</div>
                  <div className="font-semibold">95/100</div>
                </div>
              </div>
            </div>
          </div>

          {/* Driver 2 - Needs Improvement */}
          <div className="p-5 rounded-xl bg-gradient-to-br from-destructive/10 to-destructive/5 border border-destructive/20">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-destructive/20 rounded-lg">
                  <User className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <h4 className="font-semibold">Sarah Mitchell</h4>
                  <p className="text-xs text-muted-foreground">Ferrari 488</p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-muted-foreground">Performance Score</span>
                  <span className="text-2xl font-bold text-destructive">72%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-destructive" style={{ width: '72%' }}></div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <div className="text-xs">
                  <div className="text-muted-foreground">Smooth Driving</div>
                  <div className="font-semibold">Fair</div>
                </div>
                <div className="text-xs">
                  <div className="text-muted-foreground">Safety</div>
                  <div className="font-semibold">78/100</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground">
          💡 API Integration Ready: Connect your telematics provider to display live driver data
        </div>
      </Card>

      {/* Recent Activity */}
      <Card className="card-premium p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold">Live Activity Feed</h3>
          <Button variant="outline" size="sm">View All</Button>
        </div>
        
        <div className="space-y-4">
          {recentActivity.map((activity, index) => (
            <div 
              key={index} 
              className="p-4 rounded-xl bg-muted/30 border border-primary/10 hover-scale cursor-pointer transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-success/10 rounded-lg">
                    <Activity className="h-4 w-4 text-success" />
                  </div>
                  <div>
                    <div className="font-semibold">{activity.message}</div>
                    <div className="text-sm text-muted-foreground">{activity.vehicle}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-primary">{activity.value}</div>
                  <div className="text-xs text-muted-foreground">{activity.time}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Upcoming Events */}
      <Card className="card-premium p-6">
        <h3 className="text-xl font-semibold mb-6">Next 4 Hours</h3>
        
        <div className="space-y-4">
          {upcomingEvents.map((event, index) => (
            <div 
              key={index} 
              className="p-4 rounded-xl bg-gradient-to-br from-accent/10 to-primary/5 border border-accent/20"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-semibold text-lg mb-2">{event.title}</h4>
                  <div className="space-y-1">
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Clock className="w-4 h-4 mr-2" />
                      {event.time}
                    </div>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <MapPin className="w-4 h-4 mr-2" />
                      {event.location}
                    </div>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <User className="w-4 h-4 mr-2" />
                      {event.customer}
                    </div>
                  </div>
                </div>
              </div>
              <Button size="sm" variant="outline" className="w-full">
                View Details
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
