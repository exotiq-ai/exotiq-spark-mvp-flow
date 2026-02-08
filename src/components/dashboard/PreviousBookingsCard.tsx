import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { VehicleThumbnail } from "@/components/common/VehicleThumbnail";
import { History, DollarSign } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";

type Booking = Tables<"bookings">;
type Vehicle = Tables<"vehicles">;

interface PreviousBookingsCardProps {
  bookings: Booking[];
  vehicles: Vehicle[];
  onBookingClick: (booking: Booking) => void;
}

export const PreviousBookingsCard = ({ bookings, vehicles, onBookingClick }: PreviousBookingsCardProps) => {
  const previousBookings = useMemo(() => {
    const now = new Date();
    const past = new Date(now);
    past.setDate(past.getDate() - 30);

    return bookings
      .filter(b => {
        const end = new Date(b.end_date);
        return b.status === 'completed' && end >= past && end <= now;
      })
      .sort((a, b) => new Date(b.end_date).getTime() - new Date(a.end_date).getTime());
  }, [bookings]);

  const totalRevenue = useMemo(() =>
    previousBookings.reduce((sum, b) => sum + (b.total_value || 0), 0),
    [previousBookings]
  );

  const getVehicleDisplay = (booking: Booking) => {
    const vehicle = vehicles.find(v => v.id === booking.vehicle_id);
    if (vehicle) return `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
    return booking.vehicle_name || 'Unknown Vehicle';
  };

  const formatDateRange = (start: string, end: string) => {
    const s = new Date(start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const e = new Date(end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${s} – ${e}`;
  };

  const displayed = previousBookings.slice(0, 10);
  const remaining = previousBookings.length - 10;

  return (
    <CollapsibleSection
      title="Completed Bookings"
      icon={<History className="h-4 w-4" />}
      defaultOpen={false}
      badge={
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">{previousBookings.length}</Badge>
          {totalRevenue > 0 && (
            <span className="text-xs text-muted-foreground">${totalRevenue.toLocaleString()} collected</span>
          )}
        </div>
      }
    >
      {displayed.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No completed bookings in the last 30 days</p>
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
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {formatDateRange(booking.start_date, booking.end_date)}
              </span>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <DollarSign className="h-3 w-3 text-muted-foreground" />
                <span className="text-sm font-medium">${Number(booking.total_value).toLocaleString()}</span>
              </div>
              <Badge className="bg-success/20 text-success border-success/30 text-[10px]">completed</Badge>
            </div>
          ))}
          {remaining > 0 && (
            <p className="text-xs text-muted-foreground text-center pt-1">+{remaining} more completed</p>
          )}
        </div>
      )}
    </CollapsibleSection>
  );
};
