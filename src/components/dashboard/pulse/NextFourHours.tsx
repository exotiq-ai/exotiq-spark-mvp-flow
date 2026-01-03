import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { useNavigate } from "react-router-dom";
import { 
  Clock, 
  ArrowUpRight, 
  ArrowDownLeft,
  MapPin,
  User,
  Phone
} from "lucide-react";
import { format, addHours, isWithinInterval, isBefore } from "date-fns";

interface ScheduleEvent {
  id: string;
  type: 'pickup' | 'return';
  time: Date;
  vehicleName: string;
  customerName: string;
  location: string;
  phone?: string;
}

export const NextFourHours = () => {
  const { bookings, vehicles } = useLocationFilteredFleet();
  const navigate = useNavigate();

  const now = new Date();
  const fourHoursFromNow = addHours(now, 4);

  // Get upcoming pickups and returns
  const events: ScheduleEvent[] = [];

  bookings.forEach(booking => {
    const vehicle = vehicles.find(v => v.id === booking.vehicle_id);
    const vehicleName = vehicle ? `${vehicle.make} ${vehicle.model}` : 'Unknown';

    const startDate = new Date(booking.start_date);
    const endDate = new Date(booking.end_date);

    // Upcoming pickups (status confirmed, start_date within 4 hours)
    if (booking.status === 'confirmed' && 
        isWithinInterval(startDate, { start: now, end: fourHoursFromNow })) {
      events.push({
        id: `pickup-${booking.id}`,
        type: 'pickup',
        time: startDate,
        vehicleName,
        customerName: booking.customer_name,
        location: booking.pickup_location,
        phone: booking.customer_phone || undefined
      });
    }

    // Upcoming returns (status active, end_date within 4 hours)
    if (booking.status === 'active' && 
        isWithinInterval(endDate, { start: now, end: fourHoursFromNow })) {
      events.push({
        id: `return-${booking.id}`,
        type: 'return',
        time: endDate,
        vehicleName,
        customerName: booking.customer_name,
        location: booking.dropoff_location || booking.pickup_location,
        phone: booking.customer_phone || undefined
      });
    }
  });

  // Sort by time
  events.sort((a, b) => a.time.getTime() - b.time.getTime());

  if (events.length === 0) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Next 4 Hours</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <Clock className="h-8 w-8 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">No scheduled events in the next 4 hours</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Next 4 Hours</h3>
          <Badge variant="secondary" className="ml-2">
            {events.length}
          </Badge>
        </div>
      </div>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

        <div className="space-y-3">
          {events.slice(0, 5).map((event, index) => {
            const isPickup = event.type === 'pickup';
            const Icon = isPickup ? ArrowUpRight : ArrowDownLeft;
            const color = isPickup ? 'text-success' : 'text-warning';
            const bgColor = isPickup ? 'bg-success/10' : 'bg-warning/10';
            
            return (
              <div key={event.id} className="relative pl-10">
                {/* Timeline dot */}
                <div className={`absolute left-2 top-3 w-4 h-4 rounded-full ${bgColor} border-2 border-background flex items-center justify-center`}>
                  <div className={`w-2 h-2 rounded-full ${isPickup ? 'bg-success' : 'bg-warning'}`} />
                </div>

                <div 
                  className={`p-3 rounded-lg ${bgColor} border border-${isPickup ? 'success' : 'warning'}/20 cursor-pointer hover:scale-[1.01] transition-transform`}
                  onClick={() => navigate('/dashboard?module=book')}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className={`h-4 w-4 ${color}`} />
                        <span className="font-semibold text-sm">{format(event.time, 'h:mm a')}</span>
                        <Badge variant="outline" className="text-xs">
                          {isPickup ? 'Pickup' : 'Return'}
                        </Badge>
                      </div>
                      <div className="font-medium truncate">{event.vehicleName}</div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {event.customerName}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {event.location}
                        </span>
                      </div>
                    </div>
                    
                    {event.phone && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.location.href = `tel:${event.phone}`;
                        }}
                      >
                        <Phone className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {events.length > 5 && (
        <Button 
          variant="ghost" 
          className="w-full mt-4"
          onClick={() => navigate('/dashboard?module=book')}
        >
          View all {events.length} upcoming events
        </Button>
      )}
    </Card>
  );
};
