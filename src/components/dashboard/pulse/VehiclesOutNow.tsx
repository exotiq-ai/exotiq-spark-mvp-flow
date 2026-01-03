import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CollapsibleSection } from "./CollapsibleSection";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { useNavigate } from "react-router-dom";
import { 
  Car, 
  Clock, 
  MapPin, 
  User,
  AlertTriangle,
  CheckCircle2,
  Timer
} from "lucide-react";
import { differenceInMinutes, differenceInHours, isPast } from "date-fns";

interface RentalWithCountdown {
  id: string;
  vehicleName: string;
  customerName: string;
  returnDate: Date;
  dropoffLocation: string;
  status: 'on-time' | 'returning-soon' | 'overdue';
  timeRemaining: string;
  minutesRemaining: number;
}

export const VehiclesOutNow = () => {
  const { bookings, vehicles } = useLocationFilteredFleet();
  const navigate = useNavigate();
  const [rentals, setRentals] = useState<RentalWithCountdown[]>([]);

  useEffect(() => {
    const calculateRentals = () => {
      const activeBookings = bookings.filter(b => 
        b.status === 'active' || b.status === 'confirmed'
      );

      const rentalsWithCountdown: RentalWithCountdown[] = activeBookings.map(booking => {
        const vehicle = vehicles.find(v => v.id === booking.vehicle_id);
        const returnDate = new Date(booking.end_date);
        const now = new Date();
        
        const minutesRemaining = differenceInMinutes(returnDate, now);
        const hoursRemaining = differenceInHours(returnDate, now);
        
        let status: 'on-time' | 'returning-soon' | 'overdue' = 'on-time';
        let timeRemaining = '';
        
        if (isPast(returnDate)) {
          status = 'overdue';
          const overdueMins = Math.abs(minutesRemaining);
          timeRemaining = overdueMins >= 60 
            ? `${Math.floor(overdueMins / 60)}h ${overdueMins % 60}m late`
            : `${overdueMins}m late`;
        } else if (hoursRemaining <= 2) {
          status = 'returning-soon';
          timeRemaining = minutesRemaining >= 60 
            ? `${hoursRemaining}h ${minutesRemaining % 60}m`
            : `${minutesRemaining}m`;
        } else {
          timeRemaining = hoursRemaining >= 24
            ? `${Math.floor(hoursRemaining / 24)}d ${hoursRemaining % 24}h`
            : `${hoursRemaining}h`;
        }

        return {
          id: booking.id,
          vehicleName: vehicle ? `${vehicle.make} ${vehicle.model}` : 'Unknown',
          customerName: booking.customer_name,
          returnDate,
          dropoffLocation: booking.dropoff_location || booking.pickup_location,
          status,
          timeRemaining,
          minutesRemaining
        };
      });

      rentalsWithCountdown.sort((a, b) => {
        if (a.status === 'overdue' && b.status !== 'overdue') return -1;
        if (a.status !== 'overdue' && b.status === 'overdue') return 1;
        return a.minutesRemaining - b.minutesRemaining;
      });

      setRentals(rentalsWithCountdown);
    };

    calculateRentals();
    const interval = setInterval(calculateRentals, 60000);
    return () => clearInterval(interval);
  }, [bookings, vehicles]);

  const getStatusStyles = (status: RentalWithCountdown['status']) => {
    switch (status) {
      case 'overdue':
        return { text: 'text-destructive', bg: 'bg-destructive/10', icon: AlertTriangle };
      case 'returning-soon':
        return { text: 'text-warning', bg: 'bg-warning/10', icon: Timer };
      default:
        return { text: 'text-success', bg: 'bg-success/10', icon: CheckCircle2 };
    }
  };

  if (rentals.length === 0) {
    return (
      <CollapsibleSection
        id="vehicles-out"
        title="Vehicles Out"
        icon={<Car className="h-4 w-4 text-primary" />}
        badge={0}
      >
        <div className="flex items-center justify-center py-6 text-center">
          <div>
            <Car className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">All vehicles available</p>
          </div>
        </div>
      </CollapsibleSection>
    );
  }

  return (
    <CollapsibleSection
      id="vehicles-out"
      title="Vehicles Out"
      icon={<Car className="h-4 w-4 text-primary" />}
      badge={rentals.length}
    >
      {/* Compact grid - 2 cols on mobile, 4 on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {rentals.slice(0, 8).map((rental) => {
          const styles = getStatusStyles(rental.status);
          const StatusIcon = styles.icon;
          
          return (
            <div
              key={rental.id}
              className={`p-3 rounded-lg ${styles.bg} cursor-pointer hover:scale-[1.02] transition-transform`}
              onClick={() => navigate('/dashboard?module=book')}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium truncate flex-1">{rental.vehicleName}</span>
                <StatusIcon className={`h-3 w-3 ${styles.text} flex-shrink-0 ml-1`} />
              </div>
              <div className="flex items-center text-xs text-muted-foreground mb-1">
                <User className="h-3 w-3 mr-1 flex-shrink-0" />
                <span className="truncate">{rental.customerName}</span>
              </div>
              <div className={`flex items-center text-xs font-semibold ${styles.text}`}>
                <Clock className="h-3 w-3 mr-1" />
                {rental.timeRemaining}
              </div>
            </div>
          );
        })}
      </div>

      {rentals.length > 8 && (
        <Button 
          variant="ghost" 
          size="sm"
          className="w-full mt-2"
          onClick={() => navigate('/dashboard?module=book')}
        >
          +{rentals.length - 8} more
        </Button>
      )}
    </CollapsibleSection>
  );
};
