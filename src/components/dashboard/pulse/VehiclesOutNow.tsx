import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CollapsibleSection } from "./CollapsibleSection";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { useNavigate } from "react-router-dom";
import { moduleIdToPath } from "@/lib/moduleRoutes";
import { 
  Car, 
  Clock, 
  User,
  AlertTriangle,
  CheckCircle2,
  Timer,
  ChevronRight
} from "lucide-react";
import { differenceInMinutes, differenceInHours, isPast, differenceInDays } from "date-fns";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface RentalWithCountdown {
  id: string;
  bookingId: string;
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
      const now = new Date();
      
      // Only show vehicles currently out (start_date <= now AND status is confirmed/active)
      // Filter out bookings more than 48 hours overdue (should be resolved)
      const activeBookings = bookings.filter(b => {
        const startDate = new Date(b.start_date);
        const endDate = new Date(b.end_date);
        const isActive = b.status === 'active' || b.status === 'confirmed';
        const daysOverdue = differenceInDays(now, endDate);
        
        // Vehicle is "out" if booking has started and not more than 2 days overdue
        return isActive && startDate <= now && daysOverdue <= 2;
      });

      const rentalsWithCountdown: RentalWithCountdown[] = activeBookings.map(booking => {
        const vehicle = vehicles.find(v => v.id === booking.vehicle_id);
        const returnDate = new Date(booking.end_date);
        
        const minutesRemaining = differenceInMinutes(returnDate, now);
        const hoursRemaining = differenceInHours(returnDate, now);
        const daysOverdue = differenceInDays(now, returnDate);
        
        let status: 'on-time' | 'returning-soon' | 'overdue' = 'on-time';
        let timeRemaining = '';
        
        if (isPast(returnDate)) {
          status = 'overdue';
          const overdueHours = Math.abs(hoursRemaining);
          
          // Capped overdue display for cleaner UI
          if (daysOverdue >= 3) {
            timeRemaining = '3+ days late';
          } else if (daysOverdue >= 1) {
            timeRemaining = `${daysOverdue}d late`;
          } else if (overdueHours >= 1) {
            timeRemaining = `${overdueHours}h late`;
          } else {
            timeRemaining = `${Math.abs(minutesRemaining)}m late`;
          }
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
          bookingId: booking.id,
          vehicleName: vehicle ? `${vehicle.make} ${vehicle.model}` : 'Unknown',
          customerName: booking.customer_name,
          returnDate,
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

  // Navigate to specific booking
  const handleCardClick = (bookingId: string) => {
    navigate(moduleIdToPath("book", { bookingId }));
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
            <Tooltip key={rental.id}>
              <TooltipTrigger asChild>
                <div
                  className={`p-3 rounded-lg ${styles.bg} cursor-pointer hover:scale-[1.02] transition-all group border border-transparent hover:border-primary/20`}
                  onClick={() => handleCardClick(rental.bookingId)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium truncate flex-1">{rental.vehicleName}</span>
                    <div className="flex items-center gap-0.5 flex-shrink-0 ml-1">
                      <StatusIcon className={`h-3 w-3 ${styles.text}`} />
                      <ChevronRight className="h-3 w-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
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
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                View booking details
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      {rentals.length > 8 && (
        <Button 
          variant="ghost" 
          size="sm"
          className="w-full mt-2"
          onClick={() => navigate(moduleIdToPath("book", { filter: "active" }))}
        >
          +{rentals.length - 8} more
        </Button>
      )}
    </CollapsibleSection>
  );
};
