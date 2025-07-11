import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Calendar, 
  Clock, 
  MapPin, 
  User,
  Car,
  Plus,
  Search,
  Filter,
  ChevronRight
} from "lucide-react";

export const Book = () => {
  const todayBookings = [
    {
      id: "BK001",
      vehicle: "McLaren 720S",
      customer: "John Smith",
      time: "2:00 PM - 5:00 PM",
      location: "Downtown Pickup",
      status: "confirmed",
      value: "$450"
    },
    {
      id: "BK002", 
      vehicle: "Lamborghini Huracán",
      customer: "Sarah Johnson",
      time: "6:00 PM - 11:59 PM",
      location: "Airport Pickup",
      status: "pending",
      value: "$520"
    },
    {
      id: "BK003",
      vehicle: "Ferrari 488",
      customer: "Mike Chen",
      time: "All Day",
      location: "Hotel Delivery",
      status: "confirmed",
      value: "$680"
    }
  ];

  const upcomingBookings = [
    {
      date: "Tomorrow",
      bookings: 5,
      revenue: "$2,340"
    },
    {
      date: "This Weekend",
      bookings: 12,
      revenue: "$8,650"
    },
    {
      date: "Next Week",
      bookings: 18,
      revenue: "$12,400"
    }
  ];

  const availableVehicles = [
    {
      name: "Porsche 911 GT3",
      location: "Downtown",
      rate: "$320/day",
      status: "available"
    },
    {
      name: "BMW i8",
      location: "Airport",
      rate: "$280/day", 
      status: "available"
    },
    {
      name: "Audi R8",
      location: "Hotel District",
      rate: "$380/day",
      status: "maintenance"
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-success/10 text-success border-success/20';
      case 'pending': return 'bg-warning/10 text-warning border-warning/20';
      case 'maintenance': return 'bg-destructive/10 text-destructive border-destructive/20';
      default: return 'bg-muted/10 text-muted-foreground border-muted/20';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Book</h2>
          <p className="text-muted-foreground mt-1">Direct booking management and calendar</p>
        </div>
        <Button className="btn-premium">
          <Plus className="w-4 h-4 mr-2" />
          New Booking
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="card-premium p-6">
          <div className="flex items-center">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Calendar className="h-6 w-6 text-primary" />
            </div>
            <div className="ml-4">
              <div className="text-2xl font-bold">3</div>
              <div className="text-sm text-muted-foreground">Today's Bookings</div>
            </div>
          </div>
        </Card>
        
        <Card className="card-premium p-6">
          <div className="flex items-center">
            <div className="p-2 bg-success/10 rounded-lg">
              <Clock className="h-6 w-6 text-success" />
            </div>
            <div className="ml-4">
              <div className="text-2xl font-bold">35</div>
              <div className="text-sm text-muted-foreground">This Week</div>
            </div>
          </div>
        </Card>

        <Card className="card-premium p-6">
          <div className="flex items-center">
            <div className="p-2 bg-accent/10 rounded-lg">
              <Car className="h-6 w-6 text-accent" />
            </div>
            <div className="ml-4">
              <div className="text-2xl font-bold">8</div>
              <div className="text-sm text-muted-foreground">Available Cars</div>
            </div>
          </div>
        </Card>

        <Card className="card-premium p-6">
          <div className="flex items-center">
            <div className="p-2 bg-warning/10 rounded-lg">
              <MapPin className="h-6 w-6 text-warning" />
            </div>
            <div className="ml-4">
              <div className="text-2xl font-bold">3</div>
              <div className="text-sm text-muted-foreground">Pickup Locations</div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Bookings */}
        <Card className="card-premium p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold">Today's Schedule</h3>
            <div className="flex space-x-2">
              <Button variant="outline" size="sm">
                <Filter className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm">View Calendar</Button>
            </div>
          </div>
          
          <div className="space-y-4">
            {todayBookings.map((booking) => (
              <div key={booking.id} className="p-4 rounded-lg bg-muted/30 border border-primary/10">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold">{booking.vehicle}</h4>
                    <p className="text-sm text-muted-foreground">{booking.id}</p>
                  </div>
                  <Badge className={getStatusColor(booking.status)}>
                    {booking.status}
                  </Badge>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center text-sm">
                    <User className="w-4 h-4 mr-2 text-muted-foreground" />
                    {booking.customer}
                  </div>
                  <div className="flex items-center text-sm">
                    <Clock className="w-4 h-4 mr-2 text-muted-foreground" />
                    {booking.time}
                  </div>
                  <div className="flex items-center text-sm">
                    <MapPin className="w-4 h-4 mr-2 text-muted-foreground" />
                    {booking.location}
                  </div>
                </div>
                
                <div className="flex items-center justify-between mt-4">
                  <span className="font-semibold text-primary">{booking.value}</span>
                  <Button size="sm" variant="outline">
                    View Details
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Available Vehicles */}
        <Card className="card-premium p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold">Available Vehicles</h3>
            <div className="flex space-x-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search vehicles..." className="pl-10 w-40" />
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            {availableVehicles.map((vehicle, index) => (
              <div key={index} className="p-4 rounded-lg bg-muted/30 border border-accent/10">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold">{vehicle.name}</h4>
                  <Badge className={getStatusColor(vehicle.status)}>
                    {vehicle.status}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center text-sm text-muted-foreground">
                      <MapPin className="w-3 h-3 mr-1" />
                      {vehicle.location}
                    </div>
                    <div className="text-sm font-medium text-primary">{vehicle.rate}</div>
                  </div>
                  
                  <Button 
                    size="sm" 
                    disabled={vehicle.status === 'maintenance'}
                    variant={vehicle.status === 'available' ? 'default' : 'outline'}
                  >
                    {vehicle.status === 'available' ? 'Book Now' : 'Unavailable'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Upcoming Bookings Summary */}
      <Card className="card-premium p-6">
        <h3 className="text-xl font-semibold mb-6">Booking Forecast</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {upcomingBookings.map((period, index) => (
            <div key={index} className="text-center p-4 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
              <h4 className="font-semibold mb-2">{period.date}</h4>
              <div className="space-y-2">
                <div className="text-2xl font-bold text-primary">{period.bookings}</div>
                <div className="text-sm text-muted-foreground">Bookings</div>
                <div className="text-lg font-semibold text-success">{period.revenue}</div>
                <div className="text-xs text-muted-foreground">Expected Revenue</div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};