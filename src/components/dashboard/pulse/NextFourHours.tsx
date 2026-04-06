import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CollapsibleSection } from "./CollapsibleSection";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { useNavigate } from "react-router-dom";
import { moduleIdToPath } from "@/lib/moduleRoutes";
import { 
  Clock, 
  ArrowUpRight, 
  ArrowDownLeft,
  Phone
} from "lucide-react";
import { format, addHours, isWithinInterval } from "date-fns";

interface ScheduleEvent {
  id: string;
  bookingId: string;
  type: 'pickup' | 'return';
  time: Date;
  vehicleName: string;
  customerName: string;
  phone?: string;
}

export const NextFourHours = () => {
  const { bookings, vehicles } = useLocationFilteredFleet();
  const navigate = useNavigate();

  const now = new Date();
  const fourHoursFromNow = addHours(now, 4);

  const events: ScheduleEvent[] = [];

  bookings.forEach(booking => {
    const vehicle = vehicles.find(v => v.id === booking.vehicle_id);
    const vehicleName = vehicle ? `${vehicle.make} ${vehicle.model}` : 'Unknown';

    const startDate = new Date(booking.start_date);
    const endDate = new Date(booking.end_date);

    if (booking.status === 'confirmed' && 
        isWithinInterval(startDate, { start: now, end: fourHoursFromNow })) {
      events.push({
        id: `pickup-${booking.id}`,
        bookingId: booking.id,
        type: 'pickup',
        time: startDate,
        vehicleName,
        customerName: booking.customer_name,
        phone: booking.customer_phone || undefined
      });
    }

    if ((booking.status === 'active' || booking.status === 'confirmed') && 
        isWithinInterval(endDate, { start: now, end: fourHoursFromNow })) {
      events.push({
        id: `return-${booking.id}`,
        bookingId: booking.id,
        type: 'return',
        time: endDate,
        vehicleName,
        customerName: booking.customer_name,
        phone: booking.customer_phone || undefined
      });
    }
  });

  events.sort((a, b) => a.time.getTime() - b.time.getTime());

  // Navigate to specific booking
  const handleEventClick = (bookingId: string) => {
    navigate(`/dashboard?module=book&bookingId=${bookingId}`);
  };

  return (
    <CollapsibleSection
      id="next-4-hours"
      title="Next 4 Hours"
      icon={<Clock className="h-4 w-4 text-primary" />}
      badge={events.length}
    >
      {events.length === 0 ? (
        <div className="flex items-center justify-center py-4 text-center">
          <p className="text-sm text-muted-foreground">No scheduled events</p>
        </div>
      ) : (
        <div className="space-y-2">
          {events.slice(0, 4).map((event) => {
            const isPickup = event.type === 'pickup';
            const Icon = isPickup ? ArrowUpRight : ArrowDownLeft;
            const color = isPickup ? 'text-success' : 'text-warning';
            const bgColor = isPickup ? 'bg-success/10' : 'bg-warning/10';
            
            return (
              <div
                key={event.id}
                className={`flex items-center justify-between p-2 rounded-lg ${bgColor} cursor-pointer hover:opacity-80 transition-opacity`}
                onClick={() => handleEventClick(event.bookingId)}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Icon className={`h-4 w-4 ${color} flex-shrink-0`} />
                  <span className="text-sm font-medium">{format(event.time, 'h:mm a')}</span>
                  <span className="text-sm truncate">{event.vehicleName}</span>
                  <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                    • {event.customerName}
                  </span>
                </div>
                {event.phone && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.location.href = `tel:${event.phone}`;
                    }}
                  >
                    <Phone className="h-3 w-3" />
                  </Button>
                )}
              </div>
            );
          })}
          
          {events.length > 4 && (
            <Button 
              variant="ghost" 
              size="sm"
              className="w-full"
              onClick={() => navigate('/dashboard?module=book&tab=calendar')}
            >
              +{events.length - 4} more
            </Button>
          )}
        </div>
      )}
    </CollapsibleSection>
  );
};
