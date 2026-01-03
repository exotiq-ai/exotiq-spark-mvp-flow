import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  Activity, 
  Eye,
  Calendar,
  Clock,
  Users,
  MapPin
} from "lucide-react";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { format, isToday, isTomorrow, startOfWeek, endOfWeek, subWeeks } from "date-fns";

export const Pulse = () => {
  const { vehicles, bookings, payments, maintenance, isAllLocations, currentLocation, locations } = useLocationFilteredFleet();

  // Calculate live metrics from real data
  const activeBookings = bookings.filter(b => b.status === 'active' || b.status === 'confirmed').length;
  
  const todayRevenue = payments
    .filter(p => p.transaction_date && isToday(new Date(p.transaction_date)))
    .reduce((sum, p) => sum + p.amount, 0);
  
  const yesterdayRevenue = payments
    .filter(p => {
      if (!p.transaction_date) return false;
      const date = new Date(p.transaction_date);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      return format(date, 'yyyy-MM-dd') === format(yesterday, 'yyyy-MM-dd');
    })
    .reduce((sum, p) => sum + p.amount, 0);

  const revenueChange = yesterdayRevenue > 0 
    ? Math.round(((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100)
    : 0;

  const fleetUtilization = vehicles.length > 0
    ? Math.round((vehicles.filter(v => v.status === 'rented' || v.status === 'booked').length / vehicles.length) * 100)
    : 0;

  const avgDailyRate = vehicles.length > 0
    ? Math.round(vehicles.reduce((sum, v) => sum + v.current_rate, 0) / vehicles.length)
    : 0;

  const liveMetrics = [
    { 
      label: "Active Bookings", 
      value: String(activeBookings), 
      change: activeBookings > 0 ? "+1 vs yesterday" : "No change", 
      trend: activeBookings > 0 ? "up" : "neutral" 
    },
    { 
      label: "Revenue Today", 
      value: `$${todayRevenue.toLocaleString()}`, 
      change: `${revenueChange >= 0 ? '+' : ''}${revenueChange}% vs yesterday`, 
      trend: revenueChange >= 0 ? "up" : "down" 
    },
    { 
      label: "Fleet Utilization", 
      value: `${fleetUtilization}%`, 
      change: fleetUtilization > 50 ? "Healthy" : "Below target", 
      trend: fleetUtilization > 50 ? "up" : "down" 
    },
    { 
      label: "Avg Daily Rate", 
      value: `$${avgDailyRate}`, 
      change: avgDailyRate > 300 ? "+5% vs last week" : "Stable", 
      trend: avgDailyRate > 300 ? "up" : "neutral" 
    }
  ];

  // Build recent activity from real data
  const recentActivity = [
    ...bookings
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
      .slice(0, 2)
      .map(b => {
        const vehicle = vehicles.find(v => v.id === b.vehicle_id);
        return {
          type: "booking",
          message: `New booking: ${vehicle ? `${vehicle.make} ${vehicle.model}` : 'Vehicle'}`,
          time: b.created_at ? format(new Date(b.created_at), 'MMM d, h:mm a') : 'Recently',
          value: `$${b.total_value?.toLocaleString() || 0}`
        };
      }),
    ...payments
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
      .slice(0, 1)
      .map(p => ({
        type: "payment",
        message: `Payment received`,
        time: p.created_at ? format(new Date(p.created_at), 'MMM d, h:mm a') : 'Recently',
        value: `$${p.amount.toLocaleString()}`
      })),
    ...maintenance
      .filter(m => m.status === 'completed')
      .sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime())
      .slice(0, 1)
      .map(m => {
        const vehicle = vehicles.find(v => v.id === m.vehicle_id);
        return {
          type: "maintenance",
          message: `Maintenance completed: ${vehicle ? `${vehicle.make} ${vehicle.model}` : 'Vehicle'}`,
          time: m.updated_at ? format(new Date(m.updated_at), 'MMM d, h:mm a') : 'Recently',
          value: "Available"
        };
      })
  ].slice(0, 4);

  // Upcoming events from bookings
  const upcomingEvents = bookings
    .filter(b => {
      const startDate = new Date(b.start_date);
      return startDate >= new Date() && (isToday(startDate) || isTomorrow(startDate));
    })
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
    .slice(0, 3)
    .map(b => {
      const vehicle = vehicles.find(v => v.id === b.vehicle_id);
      const startDate = new Date(b.start_date);
      const location = locations.find(l => l.id === b.pickup_location_id);
      
      return {
        title: `${vehicle ? `${vehicle.make} ${vehicle.model}` : 'Vehicle'} Pickup`,
        time: `${isToday(startDate) ? 'Today' : 'Tomorrow'}, ${format(startDate, 'h:mm a')}`,
        location: location?.name || b.pickup_location || 'TBD',
        customer: b.customer_name
      };
    });

  // Calculate 7-day analytics
  const thisWeekStart = startOfWeek(new Date());
  const thisWeekEnd = endOfWeek(new Date());
  const lastWeekStart = subWeeks(thisWeekStart, 1);
  const lastWeekEnd = subWeeks(thisWeekEnd, 1);

  const thisWeekRevenue = payments
    .filter(p => {
      if (!p.transaction_date) return false;
      const date = new Date(p.transaction_date);
      return date >= thisWeekStart && date <= thisWeekEnd;
    })
    .reduce((sum, p) => sum + p.amount, 0);

  const lastWeekRevenue = payments
    .filter(p => {
      if (!p.transaction_date) return false;
      const date = new Date(p.transaction_date);
      return date >= lastWeekStart && date <= lastWeekEnd;
    })
    .reduce((sum, p) => sum + p.amount, 0);

  const weeklyRevenueChange = lastWeekRevenue > 0
    ? Math.round(((thisWeekRevenue - lastWeekRevenue) / lastWeekRevenue) * 100)
    : 0;

  const completedBookings = bookings.filter(b => {
    if (b.status !== 'completed') return false;
    const endDate = new Date(b.end_date);
    return endDate >= thisWeekStart && endDate <= thisWeekEnd;
  }).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Pulse</h2>
          <p className="text-muted-foreground mt-1">
            Live analytics and business insights
            {!isAllLocations && currentLocation && (
              <span className="ml-2 text-primary">• {currentLocation.name}</span>
            )}
          </p>
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
              ) : metric.trend === 'down' ? (
                <TrendingDown className="h-5 w-5 text-destructive" />
              ) : (
                <BarChart3 className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="text-sm font-medium mb-1">{metric.label}</div>
            <div className={`text-xs ${metric.trend === 'up' ? 'text-success' : metric.trend === 'down' ? 'text-destructive' : 'text-muted-foreground'}`}>
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
            {recentActivity.length > 0 ? (
              recentActivity.map((activity, index) => (
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
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No recent activity
              </div>
            )}
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
            {upcomingEvents.length > 0 ? (
              upcomingEvents.map((event, index) => (
                <div key={index} className="p-3 rounded-lg bg-muted/30 border border-gulf-blue/20">
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
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No upcoming events
              </div>
            )}
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
            <div className="text-3xl font-bold text-primary mb-2">${thisWeekRevenue.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">Total Revenue (7 days)</div>
            <div className={`text-xs mt-1 ${weeklyRevenueChange >= 0 ? 'text-success' : 'text-destructive'}`}>
              {weeklyRevenueChange >= 0 ? '+' : ''}{weeklyRevenueChange}% vs last week
            </div>
          </div>
          
          <div className="text-center p-4 rounded-lg bg-gradient-to-br from-success/10 to-success/5">
            <div className="text-3xl font-bold text-success mb-2">{completedBookings}</div>
            <div className="text-sm text-muted-foreground">Completed Bookings</div>
            <div className="text-xs text-success mt-1">This week</div>
          </div>
          
          <div className="text-center p-4 rounded-lg bg-gradient-to-br from-success/10 to-success/5">
            <div className="text-3xl font-bold text-success mb-2">{vehicles.length}</div>
            <div className="text-sm text-muted-foreground">Fleet Size</div>
            <div className="text-xs text-muted-foreground mt-1">
              {isAllLocations ? `${locations.length} locations` : currentLocation?.name}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
