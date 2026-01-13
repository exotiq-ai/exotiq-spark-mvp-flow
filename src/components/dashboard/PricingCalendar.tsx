import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { VehicleThumbnail } from "@/components/common/VehicleThumbnail";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isSameDay, addMonths, subMonths } from "date-fns";
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  DollarSign,
  Car,
  Wrench,
  AlertTriangle,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DayData {
  date: Date;
  revenue: number;
  bookingCount: number;
  maintenanceCount: number;
  damageCount: number;
  bookings: Array<{
    id: string;
    vehicleName: string;
    customerName: string;
    dailyRate: number;
  }>;
  maintenance: Array<{
    id: string;
    vehicleName: string;
    type: string;
  }>;
  damages: Array<{
    id: string;
    vehicleName: string;
    description: string;
    severity: string;
  }>;
}

export const PricingCalendar = () => {
  const { vehicles, bookings, maintenance, damageClaims } = useLocationFilteredFleet();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [vehicleFilter, setVehicleFilter] = useState<string>("all");

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Calculate data for each day
  const calendarData = useMemo(() => {
    const dataMap = new Map<string, DayData>();

    daysInMonth.forEach(day => {
      const dateKey = format(day, 'yyyy-MM-dd');
      dataMap.set(dateKey, {
        date: day,
        revenue: 0,
        bookingCount: 0,
        maintenanceCount: 0,
        damageCount: 0,
        bookings: [],
        maintenance: [],
        damages: [],
      });
    });

    // Add booking data
    bookings.forEach(booking => {
      const startDate = new Date(booking.start_date);
      const endDate = new Date(booking.end_date);
      const vehicle = vehicles.find(v => v.id === booking.vehicle_id);
      
      if (vehicleFilter !== "all" && booking.vehicle_id !== vehicleFilter) return;

      daysInMonth.forEach(day => {
        if (day >= startDate && day <= endDate) {
          const dateKey = format(day, 'yyyy-MM-dd');
          const dayData = dataMap.get(dateKey);
          if (dayData) {
            dayData.revenue += Number(booking.daily_rate);
            dayData.bookingCount += 1;
            dayData.bookings.push({
              id: booking.id,
              vehicleName: vehicle?.name || 'Unknown Vehicle',
              customerName: booking.customer_name,
              dailyRate: Number(booking.daily_rate),
            });
          }
        }
      });
    });

    // Add maintenance data
    maintenance.forEach(schedule => {
      const scheduleDate = new Date(schedule.scheduled_date);
      const vehicle = vehicles.find(v => v.id === schedule.vehicle_id);
      
      if (vehicleFilter !== "all" && schedule.vehicle_id !== vehicleFilter) return;

      const dateKey = format(scheduleDate, 'yyyy-MM-dd');
      const dayData = dataMap.get(dateKey);
      if (dayData) {
        dayData.maintenanceCount += 1;
        dayData.maintenance.push({
          id: schedule.id,
          vehicleName: vehicle?.name || 'Unknown Vehicle',
          type: schedule.maintenance_type,
        });
      }
    });

    // Add damage claims
    damageClaims.forEach(claim => {
      const reportedDate = new Date(claim.reported_date || '');
      const vehicle = vehicles.find(v => v.id === claim.vehicle_id);
      
      if (vehicleFilter !== "all" && claim.vehicle_id !== vehicleFilter) return;

      const dateKey = format(reportedDate, 'yyyy-MM-dd');
      const dayData = dataMap.get(dateKey);
      if (dayData) {
        dayData.damageCount += 1;
        dayData.damages.push({
          id: claim.id,
          vehicleName: vehicle?.name || 'Unknown Vehicle',
          description: claim.description,
          severity: claim.severity,
        });
      }
    });

    return dataMap;
  }, [daysInMonth, bookings, vehicles, maintenance, damageClaims, vehicleFilter]);

  // Calculate max revenue for heatmap scaling
  const maxRevenue = useMemo(() => {
    let max = 0;
    calendarData.forEach(data => {
      if (data.revenue > max) max = data.revenue;
    });
    return max || 1;
  }, [calendarData]);

  const getRevenueColor = (revenue: number) => {
    if (revenue === 0) return '';
    const intensity = Math.min(revenue / maxRevenue, 1);
    if (intensity > 0.7) return 'bg-success/30 text-success-foreground';
    if (intensity > 0.4) return 'bg-success/20';
    return 'bg-success/10';
  };

  const selectedDayData = selectedDate 
    ? calendarData.get(format(selectedDate, 'yyyy-MM-dd')) 
    : null;

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Add padding days at start
  const startPadding = monthStart.getDay();
  const paddedDays = [...Array(startPadding).fill(null), ...daysInMonth];

  return (
    <div className={cn(
      "grid gap-4 transition-all duration-300",
      selectedDate ? "lg:grid-cols-[1fr,400px]" : "grid-cols-1"
    )}>
      {/* Calendar Grid */}
      <Card className="card-premium p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div className="flex items-center gap-2 sm:gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-lg sm:text-xl font-semibold">
              {format(currentMonth, 'MMMM yyyy')}
            </h3>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Vehicles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Vehicles</SelectItem>
              {vehicles.map(vehicle => (
                <SelectItem key={vehicle.id} value={vehicle.id}>
                  {vehicle.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-4 text-xs sm:text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-success/30" />
            <span>High Revenue</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-success/10" />
            <span>Low Revenue</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Wrench className="h-3.5 w-3.5 text-info" />
            <span>Maintenance</span>
          </div>
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-warning" />
            <span>Damage</span>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {/* Week day headers */}
          {weekDays.map(day => (
            <div key={day} className="text-center text-xs sm:text-sm font-medium text-muted-foreground py-2">
              {day}
            </div>
          ))}
          
          {/* Days */}
          {paddedDays.map((day, index) => {
            if (!day) {
              return <div key={`pad-${index}`} className="aspect-square" />;
            }

            const dateKey = format(day, 'yyyy-MM-dd');
            const dayData = calendarData.get(dateKey);
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            
            return (
              <button
                key={dateKey}
                onClick={() => setSelectedDate(isSelected ? null : day)}
                className={cn(
                  "aspect-square p-1 sm:p-2 rounded-lg border transition-all",
                  "flex flex-col items-center justify-start gap-0.5",
                  "hover:border-primary/40 hover:shadow-sm",
                  getRevenueColor(dayData?.revenue || 0),
                  isToday(day) && "ring-2 ring-primary ring-offset-1",
                  isSelected && "border-primary border-2 shadow-md",
                  !isSameMonth(day, currentMonth) && "opacity-50"
                )}
              >
                <span className={cn(
                  "text-xs sm:text-sm font-medium",
                  isToday(day) && "text-primary font-bold"
                )}>
                  {format(day, 'd')}
                </span>
                
                {dayData && dayData.revenue > 0 && (
                  <span className="text-[10px] sm:text-xs font-semibold text-success">
                    ${(dayData.revenue / 1000).toFixed(1)}k
                  </span>
                )}
                
                <div className="flex items-center gap-0.5 mt-auto">
                  {dayData && dayData.bookingCount > 0 && (
                    <span className="text-[10px] text-muted-foreground flex items-center">
                      <CalendarIcon className="h-2.5 w-2.5 mr-0.5" />
                      {dayData.bookingCount}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {dayData && dayData.maintenanceCount > 0 && (
                    <Wrench className="h-3 w-3 text-info" />
                  )}
                  {dayData && dayData.damageCount > 0 && (
                    <AlertTriangle className="h-3 w-3 text-warning" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Side Panel for Selected Day */}
      {selectedDate && selectedDayData && (
        <Card className="card-premium p-4 sm:p-6 h-fit lg:sticky lg:top-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">
                {format(selectedDate, 'MMMM d, yyyy')}
              </h3>
            </div>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setSelectedDate(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Day Stats */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="p-3 rounded-lg bg-success/10 border border-success/20">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-success" />
                <span className="text-xs text-muted-foreground">Revenue</span>
              </div>
              <p className="text-xl font-bold text-success">
                ${selectedDayData.revenue.toLocaleString()}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
              <div className="flex items-center gap-2 mb-1">
                <Car className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">Bookings</span>
              </div>
              <p className="text-xl font-bold text-primary">
                {selectedDayData.bookingCount}
              </p>
            </div>
          </div>

          <ScrollArea className="h-[400px] pr-4">
            {/* Bookings */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                <CalendarIcon className="h-4 w-4 text-primary" />
                Bookings ({selectedDayData.bookingCount})
              </h4>
              {selectedDayData.bookings.length === 0 ? (
                <p className="text-sm text-muted-foreground">No bookings on this date</p>
              ) : (
                <div className="space-y-2">
                  {selectedDayData.bookings.map(booking => (
                    <div 
                      key={booking.id}
                      className="p-3 rounded-lg bg-muted/30 border border-primary/10"
                    >
                      <div className="flex items-center gap-3">
                        <VehicleThumbnail vehicleName={booking.vehicleName} size="icon" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{booking.vehicleName}</p>
                          <p className="text-xs text-muted-foreground truncate">{booking.customerName}</p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          ${booking.dailyRate}/day
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Maintenance */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                <Wrench className="h-4 w-4 text-info" />
                Maintenance ({selectedDayData.maintenanceCount})
              </h4>
              {selectedDayData.maintenance.length === 0 ? (
                <p className="text-sm text-muted-foreground">No maintenance scheduled</p>
              ) : (
                <div className="space-y-2">
                  {selectedDayData.maintenance.map(maint => (
                    <div 
                      key={maint.id}
                      className="p-3 rounded-lg bg-info/10 border border-info/20"
                    >
                      <div className="flex items-center gap-3">
                        <VehicleThumbnail vehicleName={maint.vehicleName} size="icon" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{maint.vehicleName}</p>
                          <p className="text-xs text-muted-foreground capitalize">{maint.type.replace('_', ' ')}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Damage Claims */}
            <div>
              <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                <AlertTriangle className="h-4 w-4 text-warning" />
                Damage Claims ({selectedDayData.damageCount})
              </h4>
              {selectedDayData.damages.length === 0 ? (
                <p className="text-sm text-muted-foreground">No damage claims on this date</p>
              ) : (
                <div className="space-y-2">
                  {selectedDayData.damages.map(damage => (
                    <div 
                      key={damage.id}
                      className="p-3 rounded-lg bg-warning/10 border border-warning/20"
                    >
                      <div className="flex items-center gap-3">
                        <VehicleThumbnail vehicleName={damage.vehicleName} size="icon" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{damage.vehicleName}</p>
                          <p className="text-xs text-muted-foreground truncate">{damage.description}</p>
                        </div>
                        <Badge className={cn(
                          "text-xs capitalize",
                          damage.severity === 'minor' && "bg-success/10 text-success",
                          damage.severity === 'moderate' && "bg-warning/10 text-warning",
                          damage.severity === 'major' && "bg-destructive/10 text-destructive"
                        )}>
                          {damage.severity}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </Card>
      )}
    </div>
  );
};
