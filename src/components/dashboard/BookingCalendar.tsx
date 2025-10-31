import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useFleet } from "@/contexts/FleetContext";
import { generateVehicleColors } from "@/lib/conflictDetection";
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  Filter,
  AlertTriangle
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isWithinInterval } from "date-fns";

export const BookingCalendar = () => {
  const { bookings, vehicles } = useFleet();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedVehicle, setSelectedVehicle] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const vehicleColors = generateVehicleColors(vehicles.map(v => v.id));

  const filteredBookings = bookings.filter(booking => {
    if (selectedVehicle !== "all" && booking.vehicle_id !== selectedVehicle) {
      return false;
    }
    const bookingStart = new Date(booking.start_date);
    const bookingEnd = new Date(booking.end_date);
    return isWithinInterval(monthStart, { start: bookingStart, end: bookingEnd }) ||
           isWithinInterval(monthEnd, { start: bookingStart, end: bookingEnd }) ||
           (bookingStart <= monthStart && bookingEnd >= monthEnd);
  });

  const getBookingsForDay = (day: Date) => {
    return filteredBookings.filter(booking => {
      const bookingStart = new Date(booking.start_date);
      const bookingEnd = new Date(booking.end_date);
      return isSameDay(day, bookingStart) || 
             isSameDay(day, bookingEnd) ||
             isWithinInterval(day, { start: bookingStart, end: bookingEnd });
    });
  };

  const getDayBookingsCount = (day: Date) => {
    return getBookingsForDay(day).length;
  };

  const hasConflicts = (day: Date) => {
    const dayBookings = getBookingsForDay(day);
    const vehicleIds = new Set(dayBookings.map(b => b.vehicle_id));
    return dayBookings.length > vehicleIds.size; // Multiple bookings for same vehicle
  };

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const selectedDayBookings = selectedDate ? getBookingsForDay(selectedDate) : [];

  return (
    <div className="space-y-6">
      {/* Calendar Controls */}
      <Card className="card-premium p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="icon" onClick={previousMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-2xl font-bold">
              {format(currentDate, 'MMMM yyyy')}
            </h3>
            <Button variant="outline" size="icon" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Vehicles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vehicles</SelectItem>
                {vehicles.map((vehicle) => (
                  <SelectItem key={vehicle.id} value={vehicle.id}>
                    {vehicle.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-2">
          {/* Day Headers */}
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="text-center font-semibold text-sm text-muted-foreground p-2">
              {day}
            </div>
          ))}

          {/* Empty cells for days before month start */}
          {Array.from({ length: monthStart.getDay() }).map((_, i) => (
            <div key={`empty-${i}`} className="p-2" />
          ))}

          {/* Day Cells */}
          {daysInMonth.map((day) => {
            const bookingsCount = getDayBookingsCount(day);
            const hasConflict = hasConflicts(day);
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const isToday = isSameDay(day, new Date());

            return (
              <div
                key={day.toISOString()}
                onClick={() => setSelectedDate(day)}
                className={`
                  relative p-2 min-h-[80px] rounded-lg border cursor-pointer transition-all
                  ${isSelected ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}
                  ${isToday ? 'bg-accent/5' : 'bg-background'}
                  ${hasConflict ? 'border-destructive' : ''}
                `}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm font-medium ${isToday ? 'text-primary' : ''}`}>
                    {format(day, 'd')}
                  </span>
                  {hasConflict && (
                    <AlertTriangle className="h-3 w-3 text-destructive" />
                  )}
                </div>

                {bookingsCount > 0 && (
                  <div className="space-y-1">
                    <Badge variant="outline" className="text-xs">
                      {bookingsCount} booking{bookingsCount > 1 ? 's' : ''}
                    </Badge>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 mt-6 pt-4 border-t">
          <div className="flex items-center space-x-2 text-sm">
            <div className="w-3 h-3 rounded bg-primary"></div>
            <span className="text-muted-foreground">Selected</span>
          </div>
          <div className="flex items-center space-x-2 text-sm">
            <div className="w-3 h-3 rounded bg-accent/50"></div>
            <span className="text-muted-foreground">Today</span>
          </div>
          <div className="flex items-center space-x-2 text-sm">
            <AlertTriangle className="h-3 w-3 text-destructive" />
            <span className="text-muted-foreground">Conflict Detected</span>
          </div>
        </div>
      </Card>

      {/* Selected Day Details */}
      {selectedDate && (
        <Card className="card-premium p-6">
          <h4 className="text-lg font-semibold mb-4">
            Bookings for {format(selectedDate, 'MMMM d, yyyy')}
          </h4>

          {selectedDayBookings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CalendarIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No bookings for this day</p>
            </div>
          ) : (
            <div className="space-y-3">
              {selectedDayBookings.map((booking) => {
                const vehicle = vehicles.find(v => v.id === booking.vehicle_id);
                const vehicleColor = vehicleColors[booking.vehicle_id];

                return (
                  <div
                    key={booking.id}
                    className="p-4 rounded-lg border"
                    style={{ borderLeftWidth: '4px', borderLeftColor: vehicleColor }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h5 className="font-semibold">{vehicle?.name || 'Unknown Vehicle'}</h5>
                        <p className="text-sm text-muted-foreground">{booking.customer_name}</p>
                      </div>
                      <Badge className={
                        booking.status === 'confirmed' ? 'bg-success/10 text-success' :
                        booking.status === 'completed' ? 'bg-primary/10 text-primary' :
                        booking.status === 'cancelled' ? 'bg-destructive/10 text-destructive' :
                        'bg-warning/10 text-warning'
                      }>
                        {booking.status}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Pickup:</span>
                        <span className="ml-2">{format(new Date(booking.start_date), 'h:mm a')}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Return:</span>
                        <span className="ml-2">{format(new Date(booking.end_date), 'h:mm a')}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Location:</span>
                        <span className="ml-2">{booking.pickup_location}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}
    </div>
  );
};
