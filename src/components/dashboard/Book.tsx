import { useState, useMemo } from "react";
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
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { NewBookingDialog } from "@/components/dialogs/NewBookingDialog";
import { isBlockingBooking } from "@/lib/conflictDetection";
import { format, isToday, isFuture, startOfWeek, endOfWeek, addDays } from "date-fns";
import { useMoney } from "@/hooks/useMoney";

export const Book = () => {
  const { money } = useMoney();
  const { vehicles, bookings, createBooking, isAllLocations, currentLocation, locations } = useLocationFilteredFleet();
  const [showNewBooking, setShowNewBooking] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Filter today's bookings
  const todayBookings = bookings.filter(b => {
    const startDate = new Date(b.start_date);
    return isToday(startDate) || (new Date(b.start_date) <= new Date() && new Date(b.end_date) >= new Date());
  });

  // This week's bookings
  const thisWeekStart = startOfWeek(new Date());
  const thisWeekEnd = endOfWeek(new Date());
  const thisWeekBookings = bookings.filter(b => {
    const startDate = new Date(b.start_date);
    return startDate >= thisWeekStart && startDate <= thisWeekEnd;
  });

  // Vehicles with active (pending/confirmed) bookings spanning now
  const bookedVehicleIds = useMemo(() => {
    const now = new Date();
    return new Set(
      bookings
        .filter(b =>
          isBlockingBooking(b.status) &&
          new Date(b.start_date) <= now &&
          new Date(b.end_date) >= now
        )
        .map(b => b.vehicle_id)
    );
  }, [bookings]);

  // Available vehicles: not booked right now, not in maintenance/retired, matches search
  const availableVehicles = vehicles.filter(v => {
    const matchesSearch = searchQuery === "" || 
      `${v.make} ${v.model}`.toLowerCase().includes(searchQuery.toLowerCase());
    const isAvailable = v.status !== 'maintenance' && v.status !== 'retired' && !bookedVehicleIds.has(v.id);
    return matchesSearch && isAvailable;
  }).slice(0, 5);

  // Calculate upcoming booking forecasts
  const tomorrow = addDays(new Date(), 1);
  const nextWeekStart = addDays(new Date(), 7);
  const nextWeekEnd = addDays(new Date(), 14);

  const tomorrowBookings = bookings.filter(b => {
    const startDate = new Date(b.start_date);
    return format(startDate, 'yyyy-MM-dd') === format(tomorrow, 'yyyy-MM-dd');
  });

  const weekendBookings = bookings.filter(b => {
    const startDate = new Date(b.start_date);
    const dayOfWeek = startDate.getDay();
    return (dayOfWeek === 0 || dayOfWeek === 6) && startDate >= new Date() && startDate <= addDays(new Date(), 7);
  });

  const nextWeekBookings = bookings.filter(b => {
    const startDate = new Date(b.start_date);
    return startDate >= nextWeekStart && startDate <= nextWeekEnd;
  });

  const upcomingBookings = [
    {
      date: "Tomorrow",
      bookings: tomorrowBookings.length,
      revenue: `$${tomorrowBookings.reduce((sum, b) => sum + (b.total_value || 0), 0).toLocaleString()}`
    },
    {
      date: "This Weekend",
      bookings: weekendBookings.length,
      revenue: `$${weekendBookings.reduce((sum, b) => sum + (b.total_value || 0), 0).toLocaleString()}`
    },
    {
      date: "Next Week",
      bookings: nextWeekBookings.length,
      revenue: `$${nextWeekBookings.reduce((sum, b) => sum + (b.total_value || 0), 0).toLocaleString()}`
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': 
      case 'completed': return 'bg-success/10 text-success border-success/20';
      case 'pending': return 'bg-warning/10 text-warning border-warning/20';
      case 'cancelled': return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'active': return 'bg-primary/10 text-primary border-primary/20';
      case 'available': return 'bg-success/10 text-success border-success/20';
      case 'maintenance': return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'rented':
      case 'booked': return 'bg-primary/10 text-primary border-primary/20';
      default: return 'bg-muted/10 text-muted-foreground border-muted/20';
    }
  };

  const getVehicleName = (vehicleId: string) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    return vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : 'Unknown Vehicle';
  };

  const getLocationName = (locationId: string | null) => {
    if (!locationId) return 'No location';
    const location = locations.find(l => l.id === locationId);
    return location?.name || 'Unknown Location';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Book</h2>
          <p className="text-muted-foreground mt-1">
            Direct booking management and calendar
            {!isAllLocations && currentLocation && (
              <span className="ml-2 text-primary">• {currentLocation.name}</span>
            )}
          </p>
        </div>
        <Button className="btn-premium" onClick={() => setShowNewBooking(true)}>
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
              <div className="text-2xl font-bold">{todayBookings.length}</div>
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
              <div className="text-2xl font-bold">{thisWeekBookings.length}</div>
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
              <div className="text-2xl font-bold">{vehicles.filter(v => v.status !== 'maintenance' && v.status !== 'retired' && !bookedVehicleIds.has(v.id)).length}</div>
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
              <div className="text-2xl font-bold">{isAllLocations ? locations.length : 1}</div>
              <div className="text-sm text-muted-foreground">Locations</div>
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
            {todayBookings.length > 0 ? (
              todayBookings.slice(0, 4).map((booking) => (
                <div 
                  key={booking.id} 
                  className="p-4 rounded-lg bg-muted/30 border border-primary/10 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold">{getVehicleName(booking.vehicle_id)}</h4>
                      <p className="text-sm text-muted-foreground">{booking.id.slice(0, 8)}</p>
                    </div>
                    <Badge className={getStatusColor(booking.status || 'pending')}>
                      {booking.status || 'pending'}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center text-sm">
                      <User className="w-4 h-4 mr-2 text-muted-foreground" />
                      {booking.customer_name}
                    </div>
                    <div className="flex items-center text-sm">
                      <Clock className="w-4 h-4 mr-2 text-muted-foreground" />
                      {format(new Date(booking.start_date), 'h:mm a')} - {format(new Date(booking.end_date), 'h:mm a')}
                    </div>
                    <div className="flex items-center text-sm">
                      <MapPin className="w-4 h-4 mr-2 text-muted-foreground" />
                      {booking.pickup_location || getLocationName(booking.pickup_location_id)}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between mt-4">
                    <span className="font-semibold text-primary">${booking.total_value?.toLocaleString()}</span>
                    <Button size="sm" variant="outline">
                      View Details
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No bookings scheduled for today
              </div>
            )}
          </div>
        </Card>

        {/* Available Vehicles */}
        <Card className="card-premium p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold">Available Vehicles</h3>
            <div className="flex space-x-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                <Input 
                  placeholder="Search vehicles..." 
                  className="pl-10 w-40" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            {availableVehicles.length > 0 ? (
              availableVehicles.map((vehicle) => (
                <div key={vehicle.id} className="p-4 rounded-lg bg-muted/30 border border-accent/10">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold">{vehicle.year} {vehicle.make} {vehicle.model}</h4>
                    <Badge className={getStatusColor(vehicle.status)}>
                      {vehicle.status}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center text-sm text-muted-foreground">
                        <MapPin className="w-3 h-3 mr-1" />
                        {getLocationName(vehicle.location_id)}
                      </div>
                      <div className="text-sm font-medium text-primary">${vehicle.current_rate}/day</div>
                    </div>
                    
                    <Button 
                      size="sm" 
                      disabled={vehicle.status !== 'available'}
                      variant={vehicle.status === 'available' ? 'default' : 'outline'}
                      onClick={() => setShowNewBooking(true)}
                    >
                      {vehicle.status === 'available' ? 'Book Now' : 'Unavailable'}
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No vehicles found
              </div>
            )}
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

      {/* Dialogs */}
      <NewBookingDialog
        open={showNewBooking}
        onOpenChange={setShowNewBooking}
        vehicles={vehicles}
        onSubmit={createBooking}
      />
    </div>
  );
};
