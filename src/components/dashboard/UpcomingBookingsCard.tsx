import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { VehicleThumbnail } from "@/components/common/VehicleThumbnail";
import { CalendarIcon, DollarSign, ArrowRight } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";
import { formatCurrency } from "@/lib/utils";

type Booking = Tables<"bookings">;
type Vehicle = Tables<"vehicles">;

interface UpcomingBookingsCardProps {
  bookings: Booking[];
  vehicles: Vehicle[];
  onBookingClick: (booking: Booking) => void;
}

export const UpcomingBookingsCard = ({ bookings, vehicles, onBookingClick }: UpcomingBookingsCardProps) => {
  const upcomingBookings = useMemo(() => {
    const now = new Date();
    now.setHours(23, 59, 59, 999); // end of today
    const future = new Date(now);
    future.setDate(future.getDate() + 15);

    return bookings
      .filter(b => {
        const start = new Date(b.start_date);
        return (b.status === 'confirmed' || b.status === 'pending') && start > now && start <= future;
      })
      .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
  }, [bookings]);

  const totalValue = useMemo(() => 
    upcomingBookings.reduce((sum, b) => sum + (b.total_value || 0), 0),
    [upcomingBookings]
  );

  const getVehicleDisplay = (booking: Booking) => {
    const vehicle = vehicles.find(v => v.id === booking.vehicle_id);
    if (vehicle) return `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
    return booking.vehicle_name || 'Unknown Vehicle';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getDuration = (start: string, end: string) => {
    const days = Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24));
    return `${days}d`;
  };

  const displayed = upcomingBookings.slice(0, 10);
  const remaining = upcomingBookings.length - 10;

  return (
    <CollapsibleSection
      title="Upcoming Bookings"
      icon={<CalendarIcon className="h-4 w-4" />}
      defaultOpen={true}
      badge={
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">{upcomingBookings.length}</Badge>
          {totalValue > 0 && (
            <span className="text-xs text-muted-foreground">{formatCurrency(totalValue)} pipeline</span>
          )}
        </div>
      }
    >
      {displayed.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No upcoming bookings in the next 15 days</p>
      ) : (
        <div className="space-y-2 pt-2">
          {displayed.map(booking => (
            <div
              key={booking.id}
              onClick={() => onBookingClick(booking)}
              className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
            >
              <VehicleThumbnail
                vehicleName={getVehicleDisplay(booking)}
                imageUrl={vehicles.find(v => v.id === booking.vehicle_id)?.image_url}
                size="avatar"
                className="flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{getVehicleDisplay(booking)}</p>
                <p className="text-xs text-muted-foreground truncate">{booking.customer_name}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 text-xs">
                <span className="text-muted-foreground">{formatDate(booking.start_date)}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">{getDuration(booking.start_date, booking.end_date)}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-sm font-medium">{formatCurrency(Number(booking.total_value))}</span>
                <Badge className={`text-[10px] ${
                  booking.status === 'confirmed' ? 'bg-success/20 text-success border-success/30' :
                  'bg-warning/20 text-warning border-warning/30'
                }`}>
                  {booking.status}
                </Badge>
              </div>
            </div>
          ))}
          {remaining > 0 && (
            <p className="text-xs text-muted-foreground text-center pt-1">+{remaining} more upcoming</p>
          )}
        </div>
      )}
    </CollapsibleSection>
  );
};
