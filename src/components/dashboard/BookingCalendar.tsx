import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { useModuleNavigation } from "@/hooks/useModuleNavigation";
import { generateVehicleColors } from "@/lib/conflictDetection";
import { VehicleImageDialog } from "@/components/dialogs/VehicleImageDialog";
import { EnhancedBookingDialog } from "@/components/dialogs/EnhancedBookingDialog";
import { RealtimeIndicator } from "@/components/common/RealtimeIndicator";
import { downloadICS, bookingsToCalendarEvents } from "@/lib/calendarExport";
import { getVehicleImage } from "@/lib/vehicleImageMapping";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDebounce } from "@/hooks/useDebounce";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle,
  DrawerDescription 
} from "@/components/ui/drawer";
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  Filter,
  AlertTriangle,
  Download,
  ExternalLink,
  X,
  Phone,
  Mail,
  CreditCard,
  Car,
  MapPin,
  Clock,
  DollarSign,
  User,
  TrendingUp,
  Search,
  LayoutGrid,
  List,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, startOfDay, addDays } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";

interface BookingCalendarProps {
  onNavigateToModule?: (moduleId: string, context?: Record<string, any>) => void;
}

// Booking Preview Card Component
const BookingPreviewCard = ({ 
  booking, 
  vehicle, 
  onViewDetails,
  onCustomerClick
}: { 
  booking: any; 
  vehicle: any; 
  onViewDetails: () => void;
  onCustomerClick?: (customerId: string) => void;
}) => {
  const vehicleImage = vehicle ? getVehicleImage(vehicle.name) : null;
  
  return (
    <div className="w-72">
      {vehicleImage && (
        <div className="relative h-32 -mx-4 -mt-4 mb-3 overflow-hidden rounded-t-md">
          <img src={vehicleImage} alt={vehicle?.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-2 left-3 right-3">
            <h4 className="text-white font-bold text-sm truncate">{vehicle?.name}</h4>
            <p className="text-white/80 text-xs">${Number(vehicle?.current_rate || 0).toLocaleString()}/day</p>
          </div>
        </div>
      )}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className={`font-medium text-sm ${booking.customer_id && onCustomerClick ? 'cursor-pointer hover:text-primary transition-colors' : ''}`}
            onClick={(e) => { if (booking.customer_id && onCustomerClick) { e.stopPropagation(); onCustomerClick(booking.customer_id); } }}
          >{booking.customer_name}</span>
          <Badge variant="outline" className={`ml-auto text-[10px] ${
            booking.status === 'confirmed' ? 'bg-success/10 text-success border-success/30' :
            booking.status === 'completed' ? 'bg-primary/10 text-primary border-primary/30' :
            booking.status === 'cancelled' ? 'bg-destructive/10 text-destructive border-destructive/30' :
            'bg-warning/10 text-warning border-warning/30'
          }`}>{booking.status}</Badge>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{format(new Date(booking.start_date), 'MMM d, h:mm a')} → {format(new Date(booking.end_date), 'MMM d, h:mm a')}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" />
          <span className="truncate">{booking.pickup_location}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <DollarSign className="h-3 w-3 text-muted-foreground" />
          <span className="font-semibold text-success">${Number(booking.total_value).toLocaleString()}</span>
        </div>
      </div>
      <div className="flex gap-2 mt-3 pt-3 border-t">
        {booking.customer_phone && (
          <Button variant="outline" size="sm" className="flex-1 h-8 text-xs"
            onClick={(e) => { e.stopPropagation(); window.location.href = `tel:${booking.customer_phone}`; }}>
            <Phone className="h-3 w-3 mr-1" />Call
          </Button>
        )}
        {booking.customer_email && (
          <Button variant="outline" size="sm" className="flex-1 h-8 text-xs"
            onClick={(e) => { e.stopPropagation(); window.location.href = `mailto:${booking.customer_email}`; }}>
            <Mail className="h-3 w-3 mr-1" />Email
          </Button>
        )}
        <Button size="sm" className="flex-1 h-8 text-xs"
          onClick={(e) => { e.stopPropagation(); onViewDetails(); }}>
          <CreditCard className="h-3 w-3 mr-1" />Details
        </Button>
      </div>
    </div>
  );
};

// Day Detail Content — shared between side panel and drawer
const DayDetailContent = ({
  selectedDate,
  selectedDayBookings,
  vehicles,
  vehicleColors,
  onBookingClick,
  goToCustomerProfile,
}: {
  selectedDate: Date;
  selectedDayBookings: any[];
  vehicles: any[];
  vehicleColors: Record<string, string>;
  onBookingClick: (id: string) => void;
  goToCustomerProfile: (id: string) => void;
}) => {
  return (
    <>
      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="p-2.5 rounded-xl bg-muted/30 text-center">
          <div className="text-lg font-bold">{selectedDayBookings.length}</div>
          <div className="text-[10px] text-muted-foreground">Bookings</div>
        </div>
        <div className="p-2.5 rounded-xl bg-success/10 text-center">
          <div className="text-lg font-bold text-success">
            ${selectedDayBookings.reduce((sum, b) => sum + Number(b.total_value || 0), 0).toLocaleString()}
          </div>
          <div className="text-[10px] text-muted-foreground">Revenue</div>
        </div>
        <div className="p-2.5 rounded-xl bg-primary/10 text-center">
          <div className="text-lg font-bold text-primary">
            {new Set(selectedDayBookings.map(b => b.vehicle_id)).size}
          </div>
          <div className="text-[10px] text-muted-foreground">Vehicles</div>
        </div>
      </div>

      {/* Bookings List */}
      <div className="space-y-2.5">
        {selectedDayBookings.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <CalendarIcon className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="font-medium text-sm">No bookings on this date</p>
            <p className="text-xs mt-1">Select another day or create a new booking</p>
          </div>
        ) : (
          selectedDayBookings.map((booking, index) => {
            const vehicle = vehicles.find(v => v.id === booking.vehicle_id);
            const vehicleColor = vehicleColors[booking.vehicle_id];
            const vehicleImage = vehicle ? getVehicleImage(vehicle.name) : null;

            return (
              <motion.div 
                key={booking.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 + index * 0.03 }}
                onClick={() => onBookingClick(booking.id)}
                className="relative p-3 rounded-xl border cursor-pointer hover:shadow-md hover:border-primary/40 transition-all group overflow-hidden"
                style={{ borderLeftWidth: '3px', borderLeftColor: vehicleColor }}
              >
                {vehicleImage && (
                  <div className="absolute right-0 top-0 w-20 h-full opacity-[0.07] group-hover:opacity-[0.14] transition-opacity">
                    <img src={vehicleImage} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="relative">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      {vehicleImage && (
                        <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 shadow-sm">
                          <img src={vehicleImage} alt={vehicle?.name} className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div>
                        <h5 className="font-semibold text-sm group-hover:text-primary transition-colors leading-tight">
                          {vehicle?.name || booking.vehicle_name || 'Unknown'}
                        </h5>
                        <p className={`text-xs text-muted-foreground ${booking.customer_id ? 'cursor-pointer hover:text-primary transition-colors' : ''}`}
                          onClick={(e) => { if (booking.customer_id) { e.stopPropagation(); goToCustomerProfile(booking.customer_id); } }}
                        >{booking.customer_name}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className={`text-[10px] flex-shrink-0 ${
                      booking.status === 'confirmed' ? 'bg-success/10 text-success border-success/30' :
                      booking.status === 'completed' ? 'bg-primary/10 text-primary border-primary/30' :
                      booking.status === 'cancelled' ? 'bg-destructive/10 text-destructive border-destructive/30' :
                      'bg-warning/10 text-warning border-warning/30'
                    }`}>{booking.status}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-xs mb-1.5">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {format(new Date(booking.start_date), 'h:mm a')}
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      <span className="truncate">{booking.pickup_location}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1.5 border-t border-dashed">
                    <span className="font-bold text-success text-sm">
                      ${Number(booking.total_value).toLocaleString()}
                    </span>
                    <div className="flex gap-0.5">
                      {booking.customer_phone && (
                        <Button variant="ghost" size="icon" className="h-7 w-7"
                          onClick={(e) => { e.stopPropagation(); window.location.href = `tel:${booking.customer_phone}`; }}>
                          <Phone className="h-3 w-3" />
                        </Button>
                      )}
                      {booking.customer_email && (
                        <Button variant="ghost" size="icon" className="h-7 w-7"
                          onClick={(e) => { e.stopPropagation(); window.location.href = `mailto:${booking.customer_email}`; }}>
                          <Mail className="h-3 w-3" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7"
                        onClick={(e) => { e.stopPropagation(); onBookingClick(booking.id); }}>
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </>
  );
};

export const BookingCalendar = ({ onNavigateToModule }: BookingCalendarProps) => {
  const { bookings, vehicles, refreshBookings } = useLocationFilteredFleet();
  const { goToCustomerProfile } = useModuleNavigation();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedVehicle, setSelectedVehicle] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [focusedDateIndex, setFocusedDateIndex] = useState<number>(0);
  const [showVehicleImage, setShowVehicleImage] = useState(false);
  const [showRealtimeUpdate, setShowRealtimeUpdate] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedVehicleDetails, setSelectedVehicleDetails] = useState<{
    name: string; make: string; model: string; year: number; status: string; dailyRate: number;
  } | null>(null);

  useEffect(() => {
    const previousCount = bookings.length;
    return () => {
      if (bookings.length !== previousCount) setShowRealtimeUpdate(true);
    };
  }, [bookings.length]);

  const handleVehicleClick = (vehicleId: string) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (vehicle) {
      setSelectedVehicleDetails({
        name: vehicle.name, make: vehicle.make, model: vehicle.model,
        year: vehicle.year, status: vehicle.status || "available", dailyRate: Number(vehicle.current_rate),
      });
      setShowVehicleImage(true);
    }
  };

  const handleBookingClick = (bookingId: string) => setSelectedBookingId(bookingId);

  const handleExportCalendar = () => {
    const vehicleMap = vehicles.reduce((acc, v) => ({ ...acc, [v.id]: v.name }), {} as Record<string, string>);
    const events = bookingsToCalendarEvents(filteredBookings, vehicleMap);
    const monthName = format(currentDate, "MMMM-yyyy");
    downloadICS(events, `bookings-${monthName}.ics`);
    toast({ 
      title: "Calendar exported", 
      description: `${events.length} bookings exported. Import the .ics file into Google Calendar via Settings → Import & Export.` 
    });
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const vehicleColors = generateVehicleColors(vehicles.map(v => v.id));

  const filteredBookings = bookings.filter(booking => {
    if (selectedVehicle !== "all" && booking.vehicle_id !== selectedVehicle) return false;
    const bookingStart = new Date(booking.start_date);
    const bookingEnd = new Date(booking.end_date);
    return bookingStart <= monthEnd && bookingEnd >= monthStart;
  });

  // Month summary stats
  const monthStats = useMemo(() => ({
    totalBookings: filteredBookings.length,
    totalRevenue: filteredBookings.reduce((sum, b) => sum + Number(b.total_value || 0), 0),
    activeVehicles: new Set(filteredBookings.map(b => b.vehicle_id).filter(Boolean)).size,
    conflicts: daysInMonth.filter(d => {
      const dayBookings = getBookingsForDayStatic(filteredBookings, d);
      const vehicleIds = new Set(dayBookings.map(b => b.vehicle_id));
      return dayBookings.length > vehicleIds.size;
    }).length,
  }), [filteredBookings, daysInMonth]);

  const getBookingsForDay = (day: Date) => getBookingsForDayStatic(filteredBookings, day);
  const hasConflicts = (day: Date) => {
    const dayBookings = getBookingsForDay(day);
    const vehicleIds = new Set(dayBookings.map(b => b.vehicle_id));
    return dayBookings.length > vehicleIds.size;
  };

  const previousMonth = () => { setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1)); setSelectedDate(undefined); setDrawerOpen(false); };
  const nextMonth = () => { setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1)); setSelectedDate(undefined); setDrawerOpen(false); };
  const goToToday = () => { setCurrentDate(new Date()); setSelectedDate(undefined); setDrawerOpen(false); };
  const clearSelection = () => { setSelectedDate(undefined); setDrawerOpen(false); };

  const handleDayClick = (day: Date) => {
    const isSelected = selectedDate && isSameDay(day, selectedDate);
    if (isSelected) {
      clearSelection();
    } else {
      setSelectedDate(day);
      if (isMobile) setDrawerOpen(true);
    }
  };

  const selectedDayBookings = selectedDate ? getBookingsForDay(selectedDate) : [];

  const handleKeyDown = (e: React.KeyboardEvent, dayIndex: number, day: Date) => {
    const totalDays = daysInMonth.length;
    let newIndex = dayIndex;
    switch (e.key) {
      case 'ArrowRight': e.preventDefault(); newIndex = Math.min(dayIndex + 1, totalDays - 1); break;
      case 'ArrowLeft': e.preventDefault(); newIndex = Math.max(dayIndex - 1, 0); break;
      case 'ArrowDown': e.preventDefault(); newIndex = Math.min(dayIndex + 7, totalDays - 1); break;
      case 'ArrowUp': e.preventDefault(); newIndex = Math.max(dayIndex - 7, 0); break;
      case 'Enter': case ' ': e.preventDefault(); handleDayClick(day); return;
      case 'Escape': e.preventDefault(); clearSelection(); return;
      default: return;
    }
    setFocusedDateIndex(newIndex);
    const cells = document.querySelectorAll('[data-calendar-day]');
    if (cells[newIndex]) (cells[newIndex] as HTMLElement).focus();
  };

  const isCurrentMonth = isSameMonth(currentDate, new Date());

  // Day header labels
  const dayHeaders = isMobile 
    ? ['S', 'M', 'T', 'W', 'T', 'F', 'S'] 
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const showDesktopPanel = selectedDate && !isMobile;

  return (
    <>
      <RealtimeIndicator show={showRealtimeUpdate} message="📅 Calendar updated" />
      
      {selectedVehicleDetails && (
        <VehicleImageDialog
          open={showVehicleImage}
          onOpenChange={setShowVehicleImage}
          vehicleName={selectedVehicleDetails.name}
          vehicleDetails={selectedVehicleDetails}
        />
      )}

      <EnhancedBookingDialog
        open={!!selectedBookingId}
        onOpenChange={(open) => !open && setSelectedBookingId(null)}
        bookingId={selectedBookingId}
        onNavigateToModule={onNavigateToModule}
      />

      {/* Split View Container */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Calendar Section */}
        <motion.div 
          layout
          className={showDesktopPanel ? 'lg:w-[60%]' : 'w-full'}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <Card className="p-3 sm:p-5 border shadow-sm" role="region" aria-label="Booking calendar">
            {/* Row 1: Month nav + actions */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1 sm:gap-2">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={previousMonth} aria-label="Previous month">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <motion.h3 
                  key={format(currentDate, 'MMMM yyyy')}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-base sm:text-xl font-bold min-w-[140px] sm:min-w-[180px] text-center" 
                  aria-live="polite"
                >
                  {format(currentDate, 'MMMM yyyy')}
                </motion.h3>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextMonth} aria-label="Next month">
                  <ChevronRight className="h-4 w-4" />
                </Button>
                {!isCurrentMonth && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-7 px-2.5 text-xs font-medium rounded-full"
                    onClick={goToToday}
                  >
                    Today
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleExportCalendar} title="Export .ics">
                  <Download className="h-4 w-4" />
                </Button>
                <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
                  <SelectTrigger className="w-[130px] sm:w-[170px] h-8 text-xs sm:text-sm" aria-label="Filter by vehicle">
                    <Filter className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
                    <SelectValue placeholder="All Vehicles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Vehicles</SelectItem>
                    {vehicles.map((vehicle) => <SelectItem key={vehicle.id} value={vehicle.id}>{vehicle.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 2: Month summary stats */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/50 text-xs">
                <CalendarIcon className="h-3 w-3 text-muted-foreground" />
                <span className="font-medium">{monthStats.totalBookings}</span>
                <span className="text-muted-foreground hidden sm:inline">bookings</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success/10 text-xs">
                <DollarSign className="h-3 w-3 text-success" />
                <span className="font-medium text-success">${monthStats.totalRevenue.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-xs">
                <Car className="h-3 w-3 text-primary" />
                <span className="font-medium text-primary">{monthStats.activeVehicles}</span>
                <span className="text-muted-foreground hidden sm:inline">vehicles</span>
              </div>
              {monthStats.conflicts > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive/10 text-xs">
                  <AlertTriangle className="h-3 w-3 text-destructive" />
                  <span className="font-medium text-destructive">{monthStats.conflicts}</span>
                  <span className="text-muted-foreground hidden sm:inline">conflicts</span>
                </div>
              )}
            </div>

            {/* Calendar Grid */}
            <motion.div 
              layout
              className="grid grid-cols-7 border-t border-l border-border/40 rounded-lg overflow-hidden" 
              role="grid" 
              aria-label="Calendar grid"
              drag={isMobile ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.1}
              onDragEnd={(_, info) => {
                if (info.offset.x > 80) previousMonth();
                else if (info.offset.x < -80) nextMonth();
              }}
            >
              {/* Day headers */}
              {dayHeaders.map((day, i) => (
                <div key={i} className="text-center font-medium text-[10px] sm:text-xs text-muted-foreground py-1.5 sm:py-2 border-r border-b border-border/40 bg-muted/20">
                  {day}
                </div>
              ))}

              {/* Empty padding cells */}
              {Array.from({ length: monthStart.getDay() }).map((_, i) => <div key={`empty-${i}`} className="border-r border-b border-border/40" />)}
              
              {/* Day cells */}
              {daysInMonth.map((day, dayIndex) => {
                const dayBookings = getBookingsForDay(day);
                const bookingsCount = dayBookings.length;
                const hasConflict = hasConflicts(day);
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const isToday = isSameDay(day, new Date());
                
                const getDensityClass = () => {
                  if (bookingsCount === 0) return 'hover:bg-muted/30';
                  if (bookingsCount >= 5) return 'bg-success/10 hover:bg-success/15';
                  if (bookingsCount >= 3) return 'bg-warning/8 hover:bg-warning/12';
                  return 'bg-primary/5 hover:bg-primary/8';
                };

                return (
                  <div 
                    key={day.toISOString()} 
                    data-calendar-day 
                    role="gridcell" 
                    tabIndex={dayIndex === focusedDateIndex ? 0 : -1}
                    onClick={() => handleDayClick(day)} 
                    onKeyDown={(e) => handleKeyDown(e, dayIndex, day)}
                    aria-selected={isSelected}
                    className={`relative p-1 sm:p-1.5 min-h-[56px] sm:min-h-[72px] lg:min-h-[84px] border-r border-b border-border/40 cursor-pointer transition-colors
                      ${isSelected 
                        ? 'bg-primary text-primary-foreground ring-2 ring-inset ring-primary' 
                        : `${getDensityClass()}`}
                      ${hasConflict && !isSelected ? 'bg-destructive/5' : ''}
                      ${isToday && !isSelected ? 'border-b-2 border-b-primary' : ''}
                      focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset`}
                  >
                    {/* Date number */}
                    <div className="flex items-center justify-between mb-0.5">
                      {isToday && !isSelected ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-primary text-primary-foreground text-xs sm:text-sm font-bold">
                          {format(day, 'd')}
                        </span>
                      ) : (
                        <span className={`text-xs sm:text-sm ${isToday ? 'font-bold' : 'font-semibold'} ${isSelected ? 'text-primary-foreground' : ''}`}>
                          {format(day, 'd')}
                        </span>
                      )}
                      {hasConflict && (
                        <AlertTriangle className={`h-3 w-3 flex-shrink-0 ${isSelected ? 'text-primary-foreground' : 'text-destructive'}`} />
                      )}
                      {bookingsCount > 0 && !isMobile && (
                        <span className={`text-[9px] font-medium px-1 rounded-full ${
                          isSelected ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
                        }`}>
                          {bookingsCount}
                        </span>
                      )}
                    </div>
                    
                    {/* Mobile: dots only */}
                    {isMobile && bookingsCount > 0 && (
                      <div className="flex items-center gap-0.5 mt-0.5">
                        {dayBookings.slice(0, 3).map(b => (
                          <div 
                            key={b.id} 
                            className="w-1.5 h-1.5 rounded-full" 
                            style={{ backgroundColor: isSelected ? 'currentColor' : vehicleColors[b.vehicle_id] || '#888' }} 
                          />
                        ))}
                        {bookingsCount > 3 && (
                          <span className={`text-[8px] ${isSelected ? 'text-primary-foreground' : 'text-muted-foreground'}`}>
                            +{bookingsCount - 3}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Desktop/Tablet: booking pills */}
                    {!isMobile && bookingsCount > 0 && (
                      <div className="space-y-0.5 mt-0.5">
                        {dayBookings.slice(0, 2).map((booking) => {
                          const vehicle = vehicles.find(v => v.id === booking.vehicle_id);
                          const vehicleColor = vehicleColors[booking.vehicle_id];
                          const customerFirst = booking.customer_name?.split(' ')[0] || '';
                          const vehicleModel = vehicle?.model || vehicle?.name?.split(' ').slice(-1)[0] || booking.vehicle_name?.split(' ').slice(-1)[0] || '';
                          const pillText = customerFirst && vehicleModel 
                            ? `${customerFirst} - ${vehicleModel}` 
                            : customerFirst || vehicleModel || 'Booking';
                          
                          return (
                            <HoverCard key={booking.id} openDelay={300} closeDelay={100}>
                              <HoverCardTrigger asChild>
                                <div 
                                  className={`text-[10px] lg:text-[11px] px-1 py-0.5 rounded truncate cursor-pointer transition-all leading-tight ${
                                    isSelected ? 'bg-primary-foreground/20 text-primary-foreground' : ''
                                  }`}
                                  style={!isSelected ? { 
                                    backgroundColor: `${vehicleColor || '#888'}15`, 
                                    color: vehicleColor || '#888', 
                                    borderLeft: `3px solid ${vehicleColor || '#888'}` 
                                  } : { borderLeft: '3px solid currentColor' }}
                                  onClick={(e) => { e.stopPropagation(); handleBookingClick(booking.id); }}
                                >
                                  {pillText}
                                </div>
                              </HoverCardTrigger>
                              <HoverCardContent side="right" align="start" className="p-4 z-50 bg-popover border border-border shadow-lg"
                                onClick={(e) => e.stopPropagation()}>
                                <BookingPreviewCard 
                                  booking={booking} vehicle={vehicle}
                                  onViewDetails={() => handleBookingClick(booking.id)}
                                  onCustomerClick={goToCustomerProfile}
                                />
                              </HoverCardContent>
                            </HoverCard>
                          );
                        })}
                        {bookingsCount > 2 && (
                          <div className={`text-[9px] text-center ${isSelected ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                            +{bookingsCount - 2} more
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </motion.div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-3 pt-3 border-t text-[10px] sm:text-xs">
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground text-[8px] font-bold">1</span>
                <span className="text-muted-foreground">Today</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3.5 h-3.5 rounded-lg bg-primary border border-primary" />
                <span className="text-muted-foreground">Selected</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3.5 h-3.5 rounded-lg border border-success/40 bg-success/20" />
                <span className="text-muted-foreground">5+ bookings</span>
              </div>
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="h-3 w-3 text-destructive" />
                <span className="text-muted-foreground">Conflict</span>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Desktop Day Details Panel */}
        <AnimatePresence mode="wait">
          {showDesktopPanel && selectedDate && (
            <motion.div
              key="day-panel"
              initial={{ opacity: 0, x: 40, width: 0 }}
              animate={{ opacity: 1, x: 0, width: 'auto' }}
              exit={{ opacity: 0, x: 40, width: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="lg:w-[40%]"
            >
              <Card className="p-4 sm:p-5 h-full border shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-base sm:text-lg font-bold">{format(selectedDate, 'EEEE')}</h4>
                    <p className="text-xs text-muted-foreground">{format(selectedDate, 'MMMM d, yyyy')}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={clearSelection} className="h-8 w-8">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <ScrollArea className="h-[calc(100vh-320px)]">
                  <DayDetailContent
                    selectedDate={selectedDate}
                    selectedDayBookings={selectedDayBookings}
                    vehicles={vehicles}
                    vehicleColors={vehicleColors}
                    onBookingClick={handleBookingClick}
                    goToCustomerProfile={goToCustomerProfile}
                  />
                </ScrollArea>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile/Tablet Bottom Sheet */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="max-h-[70vh]">
          <DrawerHeader className="pb-2">
            <DrawerTitle>
              {selectedDate ? format(selectedDate, 'EEEE, MMMM d') : 'Day Details'}
            </DrawerTitle>
            <DrawerDescription>
              {selectedDayBookings.length} booking{selectedDayBookings.length !== 1 ? 's' : ''} on this date
            </DrawerDescription>
          </DrawerHeader>
          <ScrollArea className="px-4 pb-6 flex-1">
            {selectedDate && (
              <DayDetailContent
                selectedDate={selectedDate}
                selectedDayBookings={selectedDayBookings}
                vehicles={vehicles}
                vehicleColors={vehicleColors}
                onBookingClick={handleBookingClick}
                goToCustomerProfile={goToCustomerProfile}
              />
            )}
          </ScrollArea>
        </DrawerContent>
      </Drawer>
    </>
  );
};

// Static helper to avoid closure issues in useMemo
function getBookingsForDayStatic(filteredBookings: any[], day: Date) {
  const dayStart = startOfDay(day);
  return filteredBookings.filter(booking => {
    const bookingStart = startOfDay(new Date(booking.start_date));
    const bookingEnd = startOfDay(new Date(booking.end_date));
    return dayStart >= bookingStart && dayStart <= bookingEnd;
  });
}
