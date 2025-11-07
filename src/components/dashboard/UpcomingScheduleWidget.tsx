import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, ArrowRight, Clock } from "lucide-react";
import { useFleet } from "@/contexts/FleetContext";

interface UpcomingScheduleWidgetProps {
  onViewCalendar: () => void;
}

export const UpcomingScheduleWidget = ({ onViewCalendar }: UpcomingScheduleWidgetProps) => {
  const { bookings, vehicles } = useFleet();
  
  // Get next 3 upcoming bookings
  const upcomingBookings = bookings
    .filter(b => new Date(b.start_date) >= new Date())
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
    <Card className="p-6 border-2 border-border shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Upcoming Schedule</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={onViewCalendar}>
          View Calendar
          <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
      
      {upcomingBookings.length > 0 ? (
        <div className="space-y-3">
          {upcomingBookings.map((booking) => (
            <div key={booking.id} className="p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <p className="font-medium text-sm">{getVehicleName(booking.vehicle_id)}</p>
                  <p className="text-xs text-muted-foreground">{booking.customer_name}</p>
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
    </Card>
  );
};
