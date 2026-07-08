import { useState, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { VehicleThumbnail } from "@/components/common/VehicleThumbnail";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isSameDay, addMonths, subMonths } from "date-fns";
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  DollarSign,
  Car,
  Wrench,
  AlertTriangle,
  X,
  Sparkles,
  Music,
  Trophy,
  Building2,
  Tent,
  Theater,
  Star,
  Users,
  Flame,
  Eye
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useMoney } from "@/hooks/useMoney";

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

interface EventData {
  id: string;
  name: string;
  date: string;
  endDate?: string;
  category: string;
  attendance: number;
  impactScore: number;
  description?: string;
  source?: string;
}

// Category styling config
const CATEGORY_CONFIG: Record<string, { icon: typeof Music; color: string; stripe: string }> = {
  concerts: { icon: Music, color: 'text-pink-500', stripe: 'from-pink-500/30 to-pink-500/5' },
  sports: { icon: Trophy, color: 'text-orange-500', stripe: 'from-orange-500/30 to-orange-500/5' },
  conferences: { icon: Building2, color: 'text-blue-500', stripe: 'from-blue-500/30 to-blue-500/5' },
  festivals: { icon: Tent, color: 'text-purple-500', stripe: 'from-purple-500/30 to-purple-500/5' },
  'performing-arts': { icon: Theater, color: 'text-indigo-500', stripe: 'from-indigo-500/30 to-indigo-500/5' },
  expos: { icon: Star, color: 'text-amber-500', stripe: 'from-amber-500/30 to-amber-500/5' },
  community: { icon: Users, color: 'text-green-500', stripe: 'from-green-500/30 to-green-500/5' },
};

const getCategoryConfig = (category: string) => {
  const key = category.toLowerCase().replace(' ', '-');
  return CATEGORY_CONFIG[key] || { icon: CalendarIcon, color: 'text-muted-foreground', stripe: 'from-muted/30 to-muted/5' };
};

// PEAK_SEASONS for surge period indicators
const PEAK_SEASONS = [
  { name: 'Art Basel Miami', start: '12-01', end: '12-08', city: 'miami', surge: 1.35 },
  { name: 'Miami Boat Show', start: '02-12', end: '02-16', city: 'miami', surge: 1.30 },
  { name: 'Ultra Music Festival', start: '03-28', end: '03-30', city: 'miami', surge: 1.35 },
  { name: 'Miami Grand Prix', start: '05-02', end: '05-04', city: 'miami', surge: 1.40 },
  { name: 'Miami Open Tennis', start: '03-17', end: '03-30', city: 'miami', surge: 1.25 },
  { name: 'Spring Break', start: '03-10', end: '03-25', city: 'miami', surge: 1.25 },
  { name: 'Barrett-Jackson Auction', start: '01-18', end: '01-26', city: 'scottsdale', surge: 1.35 },
  { name: 'WM Phoenix Open', start: '02-03', end: '02-09', city: 'scottsdale', surge: 1.40 },
  { name: 'Spring Training Baseball', start: '02-22', end: '03-25', city: 'scottsdale', surge: 1.20 },
  { name: 'Christmas & New Years', start: '12-20', end: '01-03', city: 'all', surge: 1.45 },
  { name: 'Super Bowl Weekend', start: '02-05', end: '02-12', city: 'all', surge: 1.50 },
  { name: 'Summer Peak', start: '06-15', end: '08-15', city: 'all', surge: 1.15 },
  { name: 'Thanksgiving Week', start: '11-24', end: '11-30', city: 'all', surge: 1.30 },
];

export const PricingCalendar = () => {
  const { vehicles, bookings, maintenance, damageClaims } = useLocationFilteredFleet();
  const { money } = useMoney();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [vehicleFilter, setVehicleFilter] = useState<string>("all");
  const [showDemandHeatmap, setShowDemandHeatmap] = useState(false);
  const [events, setEvents] = useState<EventData[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Fetch events for the displayed month
  useEffect(() => {
    const fetchEvents = async () => {
      setEventsLoading(true);
      try {
        const startDate = format(monthStart, 'yyyy-MM-dd');
        const endDate = format(monthEnd, 'yyyy-MM-dd');
        
        const { data, error } = await supabase.functions.invoke('ai-event-intelligence', {
          body: { city: 'miami', startDate, endDate },
        });
        
        if (!error && data?.events) {
          setEvents(data.events);
        }
      } catch (err) {
        console.error('Failed to fetch calendar events:', err);
      } finally {
        setEventsLoading(false);
      }
    };
    fetchEvents();
  }, [currentMonth]);

  // Map events to dates
  const eventsByDate = useMemo(() => {
    const map = new Map<string, EventData[]>();
    events.forEach(event => {
      const start = new Date(event.date);
      const end = event.endDate ? new Date(event.endDate) : start;
      const days = eachDayOfInterval({ start, end });
      days.forEach(day => {
        const key = format(day, 'yyyy-MM-dd');
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(event);
      });
    });
    return map;
  }, [events]);

  // Surge period indicators for this month
  const surgeIndicators = useMemo(() => {
    const month = currentMonth.getMonth() + 1;
    const monthStr = String(month).padStart(2, '0');
    
    return PEAK_SEASONS.filter(season => {
      const sMonth = parseInt(season.start.split('-')[0]);
      const eMonth = parseInt(season.end.split('-')[0]);
      // Simple check: does this month overlap with the season?
      if (sMonth <= eMonth) {
        return month >= sMonth && month <= eMonth;
      }
      // Wraps around year (e.g., Dec-Jan)
      return month >= sMonth || month <= eMonth;
    });
  }, [currentMonth]);

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

  const maxRevenue = useMemo(() => {
    let max = 0;
    calendarData.forEach(data => { if (data.revenue > max) max = data.revenue; });
    return max || 1;
  }, [calendarData]);

  // Demand heatmap: compute demand score per day based on events + day-of-week
  const getDemandColor = (dateKey: string, dayOfWeek: number) => {
    const dayEvents = eventsByDate.get(dateKey) || [];
    const baseScore = [40, 30, 30, 35, 45, 65, 60][dayOfWeek]; // Sun-Sat
    const eventBoost = dayEvents.reduce((sum, e) => sum + (e.impactScore / 10), 0);
    const score = Math.min(100, baseScore + eventBoost);
    
    if (score >= 80) return 'bg-destructive/25';
    if (score >= 65) return 'bg-warning/25';
    if (score >= 50) return 'bg-warning/15';
    if (score >= 35) return 'bg-primary/10';
    return 'bg-muted/10';
  };

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
  const selectedDayEvents = selectedDate
    ? eventsByDate.get(format(selectedDate, 'yyyy-MM-dd')) || []
    : [];

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const startPadding = monthStart.getDay();
  const paddedDays = [...Array(startPadding).fill(null), ...daysInMonth];

  return (
    <div className={cn(
      "grid gap-4 transition-all duration-300",
      selectedDate ? "lg:grid-cols-[1fr,400px]" : "grid-cols-1"
    )}>
      <Card className="card-premium p-4 sm:p-6">
        {/* Surge Period Indicators */}
        {surgeIndicators.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {surgeIndicators.map((surge, i) => (
              <div 
                key={i}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-warning/20 to-warning/5 border border-warning/30"
              >
                <Flame className="h-3.5 w-3.5 text-warning" />
                <span className="text-xs font-medium">{surge.name}</span>
                <Badge className="bg-warning/20 text-warning text-[10px] px-1.5 py-0">
                  {surge.surge}x
                </Badge>
              </div>
            ))}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div className="flex items-center gap-2 sm:gap-4">
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-lg sm:text-xl font-semibold">
              {format(currentMonth, 'MMMM yyyy')}
            </h3>
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            {eventsLoading && (
              <Badge variant="outline" className="text-xs animate-pulse">
                <Sparkles className="h-3 w-3 mr-1" />
                Loading events...
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {/* Demand Heatmap Toggle */}
            <div className="flex items-center gap-2">
              <Switch 
                id="heatmap-toggle"
                checked={showDemandHeatmap}
                onCheckedChange={setShowDemandHeatmap}
              />
              <Label htmlFor="heatmap-toggle" className="text-xs text-muted-foreground cursor-pointer">
                <Eye className="h-3.5 w-3.5 inline mr-1" />
                Demand
              </Label>
            </div>
            
            <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Vehicles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vehicles</SelectItem>
                {vehicles.map(vehicle => (
                  <SelectItem key={vehicle.id} value={vehicle.id}>{vehicle.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-4 text-xs sm:text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-success/30" />
            <span>Revenue</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Wrench className="h-3.5 w-3.5 text-info" />
            <span>Maintenance</span>
          </div>
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-warning" />
            <span>Damage</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            <span>Events</span>
          </div>
          {showDemandHeatmap && (
            <>
              <div className="h-3 w-px bg-border" />
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-destructive/25" />
                <span>Peak</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-warning/25" />
                <span>High</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-primary/10" />
                <span>Normal</span>
              </div>
            </>
          )}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {weekDays.map(day => (
            <div key={day} className="text-center text-xs sm:text-sm font-medium text-muted-foreground py-2">
              {day}
            </div>
          ))}
          
          {paddedDays.map((day, index) => {
            if (!day) return <div key={`pad-${index}`} className="aspect-square" />;

            const dateKey = format(day, 'yyyy-MM-dd');
            const dayData = calendarData.get(dateKey);
            const dayEvents = eventsByDate.get(dateKey) || [];
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const hasEvents = dayEvents.length > 0;
            const topEvent = dayEvents[0];
            const topCat = topEvent ? getCategoryConfig(topEvent.category) : null;
            
            return (
              <TooltipProvider key={dateKey}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setSelectedDate(isSelected ? null : day)}
                      className={cn(
                        "aspect-square p-1 sm:p-2 rounded-lg border transition-all relative overflow-hidden",
                        "flex flex-col items-center justify-start gap-0.5",
                        "hover:border-primary/40 hover:shadow-sm",
                        showDemandHeatmap 
                          ? getDemandColor(dateKey, day.getDay())
                          : getRevenueColor(dayData?.revenue || 0),
                        isToday(day) && "ring-2 ring-primary ring-offset-1",
                        isSelected && "border-primary border-2 shadow-md",
                        !isSameMonth(day, currentMonth) && "opacity-50"
                      )}
                    >
                      <span className={cn(
                        "text-xs sm:text-sm font-medium relative z-10",
                        isToday(day) && "text-primary font-bold"
                      )}>
                        {format(day, 'd')}
                      </span>
                      
                      {dayData && dayData.revenue > 0 && (
                        <span className="text-[10px] sm:text-xs font-semibold text-success relative z-10">
                          {money(dayData.revenue)}
                        </span>
                      )}
                      
                      <div className="flex items-center gap-0.5 mt-auto relative z-10">
                        {dayData && dayData.bookingCount > 0 && (
                          <span className="text-[10px] text-muted-foreground flex items-center">
                            <CalendarIcon className="h-2.5 w-2.5 mr-0.5" />
                            {dayData.bookingCount}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 relative z-10">
                        {dayData && dayData.maintenanceCount > 0 && (
                          <Wrench className="h-3 w-3 text-info" />
                        )}
                        {dayData && dayData.damageCount > 0 && (
                          <AlertTriangle className="h-3 w-3 text-warning" />
                        )}
                      </div>

                      {/* Event overlay stripe */}
                      {hasEvents && (
                        <>
                          <div className={cn(
                            "absolute bottom-0 left-0 right-0 h-1.5 bg-gradient-to-r",
                            topCat?.stripe || 'from-accent/30 to-accent/5'
                          )} />
                          <div className="absolute top-0.5 right-0.5 z-10">
                            <Badge className="text-[8px] px-1 py-0 bg-accent/80 text-white leading-tight">
                              {dayEvents.length}
                            </Badge>
                          </div>
                        </>
                      )}
                    </button>
                  </TooltipTrigger>
                  {hasEvents && (
                    <TooltipContent side="bottom" className="max-w-[200px]">
                      <div className="space-y-1">
                        {dayEvents.slice(0, 3).map(e => {
                          const cat = getCategoryConfig(e.category);
                          const Icon = cat.icon;
                          return (
                            <div key={e.id} className="flex items-center gap-1.5 text-xs">
                              <Icon className={cn("h-3 w-3", cat.color)} />
                              <span className="truncate">{e.name}</span>
                            </div>
                          );
                        })}
                        {dayEvents.length > 3 && (
                          <span className="text-[10px] text-muted-foreground">+{dayEvents.length - 3} more</span>
                        )}
                      </div>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>
      </Card>

      {/* Side Panel */}
      {selectedDate && selectedDayData && (
        <Card className="card-premium p-4 sm:p-6 h-fit lg:sticky lg:top-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">
                {format(selectedDate, 'MMMM d, yyyy')}
              </h3>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setSelectedDate(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Day Stats */}
          <div className="grid grid-cols-2 gap-3 mb-4">
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
            {/* Events Section */}
            {selectedDayEvents.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-accent" />
                  Events ({selectedDayEvents.length})
                </h4>
                <div className="space-y-2">
                  {selectedDayEvents.map(event => {
                    const cat = getCategoryConfig(event.category);
                    const Icon = cat.icon;
                    return (
                      <div key={event.id} className="p-3 rounded-lg bg-accent/5 border border-accent/20">
                        <div className="flex items-center gap-3">
                          <div className={cn("p-2 rounded-lg bg-accent/10")}>
                            <Icon className={cn("h-4 w-4", cat.color)} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{event.name}</p>
                            <p className="text-xs text-muted-foreground capitalize">{event.category}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <Badge className={cn(
                              "text-[10px]",
                              event.impactScore >= 70 ? 'bg-warning/20 text-warning' : 'bg-muted'
                            )}>
                              Impact: {event.impactScore}
                            </Badge>
                            {event.attendance > 0 && (
                              <p className="text-[10px] text-muted-foreground mt-1">
                                {event.attendance >= 1000 
                                  ? `${(event.attendance / 1000).toFixed(0)}K` 
                                  : event.attendance} attendees
                              </p>
                            )}
                          </div>
                        </div>
                        {event.description && (
                          <p className="text-xs text-muted-foreground mt-2 pl-11">{event.description}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

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
                    <div key={booking.id} className="p-3 rounded-lg bg-muted/30 border border-primary/10">
                      <div className="flex items-center gap-3">
                        <VehicleThumbnail vehicleName={booking.vehicleName} size="icon" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{booking.vehicleName}</p>
                          <p className="text-xs text-muted-foreground truncate">{booking.customerName}</p>
                        </div>
                        <Badge variant="outline" className="text-xs">${booking.dailyRate}/day</Badge>
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
                    <div key={maint.id} className="p-3 rounded-lg bg-info/10 border border-info/20">
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
                    <div key={damage.id} className="p-3 rounded-lg bg-warning/10 border border-warning/20">
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
