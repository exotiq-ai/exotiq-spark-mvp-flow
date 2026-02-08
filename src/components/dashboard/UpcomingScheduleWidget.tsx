import { Button } from "@/components/ui/button";
import { Calendar, ArrowRight, Clock } from "lucide-react";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { useModuleNavigation } from "@/hooks/useModuleNavigation";

interface UpcomingScheduleWidgetProps {
  onViewCalendar: () => void;
}

export const UpcomingScheduleWidget = ({ onViewCalendar }: UpcomingScheduleWidgetProps) => {
  const { bookings, vehicles } = useLocationFilteredFleet();
  const { goToBookingDetails } = useModuleNavigation();
  
  // Get next 3 upcoming bookings (pickups and returns for today and future)
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  
  const upcomingBookings = bookings
    .filter(b => {
      const startDate = new Date(b.start_date);
      const endDate = new Date(b.end_date);
      return (
        (b.status === 'confirmed' || b.status === 'pending') &&
        (startDate >= todayStart || endDate >= todayStart)
      );
    })
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
    .slice(0, 3);
  
  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };
  
  const getVehicleName = (vehicleId: string) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    return vehicle ? `${vehicle.make} ${vehicle.model}` : 'Unknown Vehicle';
  };
  
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
        </div>
        <Button variant="ghost" size="sm" onClick={onViewCalendar}>
          View Calendar
          <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
      
      {upcomingBookings.length > 0 ? (
        <div className="space-y-3">
          {upcomingBookings.map((booking) => (
            <div key={booking.id} className={`p-3 rounded-lg hover:bg-muted/70 transition-colors ${
              booking.status === 'pending' ? 'bg-warning/10 border border-warning/30' : 'bg-muted/50'
            }`}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm text-foreground">{getVehicleName(booking.vehicle_id)}</p>
                    {booking.status === 'pending' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning/20 text-warning font-medium">
                        PENDING
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground cursor-pointer hover:text-primary transition-colors"
                    onClick={() => goToBookingDetails(booking.id)}
                  >{booking.customer_name}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>{formatTime(booking.start_date)}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-8 text-center text-sm text-muted-foreground">
          No upcoming bookings
        </div>
      )}
    </div>
  );
};
