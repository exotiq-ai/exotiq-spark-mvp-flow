import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { differenceInMinutes, differenceInHours, isPast, format } from "date-fns";

interface RentalWithCountdown {
  id: string;
  vehicleName: string;
  customerName: string;
  returnDate: Date;
  pickupLocation: string;
  dropoffLocation: string;
  status: 'on-time' | 'returning-soon' | 'overdue';
  timeRemaining: string;
  minutesRemaining: number;
}

export const VehiclesOutNow = () => {
  const { bookings, vehicles } = useLocationFilteredFleet();
  const navigate = useNavigate();
  const [rentals, setRentals] = useState<RentalWithCountdown[]>([]);

  // Calculate active rentals with countdown
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
          if (overdueMins >= 60) {
            timeRemaining = `${Math.floor(overdueMins / 60)}h ${overdueMins % 60}m overdue`;
          } else {
            timeRemaining = `${overdueMins}m overdue`;
          }
        } else if (hoursRemaining <= 2) {
          status = 'returning-soon';
          if (minutesRemaining >= 60) {
            timeRemaining = `${hoursRemaining}h ${minutesRemaining % 60}m`;
          } else {
            timeRemaining = `${minutesRemaining}m`;
          }
        } else {
          if (hoursRemaining >= 24) {
            const days = Math.floor(hoursRemaining / 24);
            timeRemaining = `${days}d ${hoursRemaining % 24}h`;
          } else {
            timeRemaining = `${hoursRemaining}h ${minutesRemaining % 60}m`;
          }
        }

        return {
          id: booking.id,
          vehicleName: vehicle ? `${vehicle.make} ${vehicle.model}` : 'Unknown Vehicle',
          customerName: booking.customer_name,
          returnDate,
          pickupLocation: booking.pickup_location,
          dropoffLocation: booking.dropoff_location || booking.pickup_location,
          status,
          timeRemaining,
          minutesRemaining
        };
      });

      // Sort: overdue first, then by time remaining
      rentalsWithCountdown.sort((a, b) => {
        if (a.status === 'overdue' && b.status !== 'overdue') return -1;
        if (a.status !== 'overdue' && b.status === 'overdue') return 1;
        return a.minutesRemaining - b.minutesRemaining;
      });

      setRentals(rentalsWithCountdown);
    };

    calculateRentals();
    const interval = setInterval(calculateRentals, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [bookings, vehicles]);

  const getStatusStyles = (status: RentalWithCountdown['status']) => {
    switch (status) {
      case 'overdue':
        return {
          border: 'border-destructive/30',
          bg: 'bg-destructive/5',
          badge: 'bg-destructive/20 text-destructive border-destructive/30',
          icon: AlertTriangle,
          iconColor: 'text-destructive'
        };
      case 'returning-soon':
        return {
          border: 'border-warning/30',
          bg: 'bg-warning/5',
          badge: 'bg-warning/20 text-warning border-warning/30',
          icon: Timer,
          iconColor: 'text-warning'
        };
      default:
        return {
          border: 'border-success/30',
          bg: 'bg-success/5',
          badge: 'bg-success/20 text-success border-success/30',
          icon: CheckCircle2,
          iconColor: 'text-success'
        };
    }
  };

  if (rentals.length === 0) {
    return (
      <Card className="p-6 border-dashed">
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Car className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Active Rentals</h3>
          <p className="text-sm text-muted-foreground mb-4">
            All vehicles are currently available
          </p>
          <Button 
            variant="outline" 
            onClick={() => navigate('/dashboard?module=book')}
          >
            Create Booking
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Car className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Vehicles Out Now</h3>
          <Badge variant="secondary" className="ml-2">
            {rentals.length}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {rentals.slice(0, 6).map((rental) => {
          const styles = getStatusStyles(rental.status);
          const StatusIcon = styles.icon;
          
          return (
            <div
              key={rental.id}
              className={`p-4 rounded-xl ${styles.bg} border ${styles.border} cursor-pointer hover:scale-[1.02] transition-transform`}
              onClick={() => navigate(`/dashboard?module=book`)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold truncate">{rental.vehicleName}</h4>
                  <div className="flex items-center text-sm text-muted-foreground mt-1">
                    <User className="h-3 w-3 mr-1 flex-shrink-0" />
                    <span className="truncate">{rental.customerName}</span>
                  </div>
                </div>
                <Badge className={styles.badge}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {rental.status === 'overdue' ? 'Late' : rental.status === 'returning-soon' ? 'Soon' : 'OK'}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3 mr-1" />
                  {rental.dropoffLocation}
                </div>
                <div className={`flex items-center text-sm font-semibold ${styles.iconColor}`}>
                  <Clock className="h-3 w-3 mr-1" />
                  {rental.timeRemaining}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {rentals.length > 6 && (
        <Button 
          variant="ghost" 
          className="w-full mt-4"
          onClick={() => navigate('/dashboard?module=book')}
        >
          View all {rentals.length} active rentals
        </Button>
      )}
    </Card>
  );
};
