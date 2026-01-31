import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { generateVehicleColors } from "@/lib/conflictDetection";
import { VehicleImageDialog } from "@/components/dialogs/VehicleImageDialog";
import { EnhancedBookingDialog } from "@/components/dialogs/EnhancedBookingDialog";
import { RealtimeIndicator } from "@/components/common/RealtimeIndicator";
import { downloadICS, bookingsToCalendarEvents } from "@/lib/calendarExport";
import { openGoogleCalendar } from "@/lib/googleCalendar";
import { getVehicleImage } from "@/lib/vehicleImageMapping";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  Filter,
  AlertTriangle,
  RefreshCw,
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
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isWithinInterval } from "date-fns";

interface BookingCalendarProps {
  onNavigateToModule?: (moduleId: string, context?: Record<string, any>) => void;
}

// Booking Preview Card Component
const BookingPreviewCard = ({ 
  booking, 
  vehicle, 
  onViewDetails 
}: { 
  booking: any; 
  vehicle: any; 
  onViewDetails: () => void;
}) => {
  const vehicleImage = vehicle ? getVehicleImage(vehicle.name) : null;
  
  return (
    <div className="w-72">
      {/* Vehicle Image */}
      {vehicleImage && (
        <div className="relative h-32 -mx-4 -mt-4 mb-3 overflow-hidden rounded-t-md">
          <img 
            src={vehicleImage} 
            alt={vehicle?.name} 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-2 left-3 right-3">
            <h4 className="text-white font-bold text-sm truncate">{vehicle?.name}</h4>
            <p className="text-white/80 text-xs">${Number(vehicle?.current_rate || 0).toLocaleString()}/day</p>
          </div>
        </div>
      )}
      
      {/* Customer Info */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">{booking.customer_name}</span>
          <Badge 
            variant="outline" 
            className={`ml-auto text-[10px] ${
              booking.status === 'confirmed' ? 'bg-success/10 text-success border-success/30' :
              booking.status === 'completed' ? 'bg-primary/10 text-primary border-primary/30' :
              booking.status === 'cancelled' ? 'bg-destructive/10 text-destructive border-destructive/30' :
              'bg-warning/10 text-warning border-warning/30'
            }`}
          >
            {booking.status}
          </Badge>
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
      
      {/* Quick Actions */}
      <div className="flex gap-2 mt-3 pt-3 border-t">
        {booking.customer_phone && (
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 h-8 text-xs"
            onClick={(e) => { e.stopPropagation(); window.location.href = `tel:${booking.customer_phone}`; }}
          >
            <Phone className="h-3 w-3 mr-1" />
            Call
          </Button>
        )}
        {booking.customer_email && (
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 h-8 text-xs"
            onClick={(e) => { e.stopPropagation(); window.location.href = `mailto:${booking.customer_email}`; }}
          >
            <Mail className="h-3 w-3 mr-1" />
            Email
          </Button>
        )}
        <Button 
          size="sm" 
          className="flex-1 h-8 text-xs"
          onClick={(e) => { e.stopPropagation(); onViewDetails(); }}
        >
          <CreditCard className="h-3 w-3 mr-1" />
          Details
        </Button>
      </div>
    </div>
  );
};

export const BookingCalendar = ({ onNavigateToModule }: BookingCalendarProps) => {
  const { bookings, vehicles, refreshBookings } = useLocationFilteredFleet();
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedVehicle, setSelectedVehicle] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [focusedDateIndex, setFocusedDateIndex] = useState<number>(0);
  const [showVehicleImage, setShowVehicleImage] = useState(false);
  const [showRealtimeUpdate, setShowRealtimeUpdate] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [hoveredBooking, setHoveredBooking] = useState<string | null>(null);
  const [selectedVehicleDetails, setSelectedVehicleDetails] = useState<{
    name: string;
    make: string;
    model: string;
    year: number;
    status: string;
    dailyRate: number;
  } | null>(null);

  useEffect(() => {
    const previousCount = bookings.length;
    return () => {
      if (bookings.length !== previousCount) {
        setShowRealtimeUpdate(true);
      }
    };
  }, [bookings.length]);

  const handleVehicleClick = (vehicleId: string) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (vehicle) {
      setSelectedVehicleDetails({
        name: vehicle.name,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        status: vehicle.status || "available",
        dailyRate: Number(vehicle.current_rate),
      });
      setShowVehicleImage(true);
    }
  };

  const handleBookingClick = (bookingId: string) => {
    setSelectedBookingId(bookingId);
  };

  const handleExportCalendar = () => {
    const vehicleMap = vehicles.reduce((acc, v) => ({ ...acc, [v.id]: v.name }), {} as Record<string, string>);
    const events = bookingsToCalendarEvents(filteredBookings, vehicleMap);
    const monthName = format(currentDate, "MMMM-yyyy");
    downloadICS(events, `bookings-${monthName}.ics`);
    toast({ title: "Calendar exported", description: `${events.length} bookings exported to .ics file` });
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const vehicleColors = generateVehicleColors(vehicles.map(v => v.id));

  const filteredBookings = bookings.filter(booking => {
    if (selectedVehicle !== "all" && booking.vehicle_id !== selectedVehicle) return false;
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
      return isSameDay(day, bookingStart) || isSameDay(day, bookingEnd) || isWithinInterval(day, { start: bookingStart, end: bookingEnd });
    });
  };

  const getDayBookingsCount = (day: Date) => getBookingsForDay(day).length;

  const hasConflicts = (day: Date) => {
    const dayBookings = getBookingsForDay(day);
    const vehicleIds = new Set(dayBookings.map(b => b.vehicle_id));
    return dayBookings.length > vehicleIds.size;
  };

  const previousMonth = () => { setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1)); setSelectedDate(undefined); };
  const nextMonth = () => { setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1)); setSelectedDate(undefined); };
  const clearSelection = () => setSelectedDate(undefined);

  const selectedDayBookings = selectedDate ? getBookingsForDay(selectedDate) : [];

  const handleKeyDown = (e: React.KeyboardEvent, dayIndex: number, day: Date) => {
    const totalDays = daysInMonth.length;
    let newIndex = dayIndex;
    switch (e.key) {
      case 'ArrowRight': e.preventDefault(); newIndex = Math.min(dayIndex + 1, totalDays - 1); break;
      case 'ArrowLeft': e.preventDefault(); newIndex = Math.max(dayIndex - 1, 0); break;
      case 'ArrowDown': e.preventDefault(); newIndex = Math.min(dayIndex + 7, totalDays - 1); break;
      case 'ArrowUp': e.preventDefault(); newIndex = Math.max(dayIndex - 7, 0); break;
      case 'Enter': case ' ': e.preventDefault(); setSelectedDate(day); return;
      case 'Escape': e.preventDefault(); clearSelection(); return;
      case 'Home': e.preventDefault(); newIndex = 0; break;
      case 'End': e.preventDefault(); newIndex = totalDays - 1; break;
      default: return;
    }
    setFocusedDateIndex(newIndex);
    const cells = document.querySelectorAll('[data-calendar-day]');
    if (cells[newIndex]) (cells[newIndex] as HTMLElement).focus();
  };

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
        {/* Calendar Section - Animated */}
        <motion.div 
          layout
          className={`${selectedDate ? 'lg:w-[55%]' : 'w-full'}`}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <Card className="card-premium p-4 sm:p-6" role="region" aria-label="Booking calendar">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center space-x-2 sm:space-x-4">
                <Button variant="outline" size="icon" onClick={previousMonth} aria-label="Previous month">
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </Button>
                <motion.h3 
                  key={format(currentDate, 'MMMM yyyy')}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-lg sm:text-2xl font-bold" 
                  aria-live="polite"
                >
                  {format(currentDate, 'MMMM yyyy')}
                </motion.h3>
                <Button variant="outline" size="icon" onClick={nextMonth} aria-label="Next month">
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => refreshBookings()} aria-label="Refresh" title="Refresh">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center space-x-2 w-full sm:w-auto">
                <Button variant="outline" size="sm" onClick={handleExportCalendar} className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Export</span>
                </Button>
                <Button variant="outline" size="sm" onClick={() => {
                  const vehicleMap = vehicles.reduce((acc, v) => ({ ...acc, [v.id]: v.name }), {} as Record<string, string>);
                  if (filteredBookings.length > 0) {
                    openGoogleCalendar(filteredBookings[0], vehicleMap[filteredBookings[0].vehicle_id]);
                  }
                  toast({ title: "Opening Google Calendar" });
                }} className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">Google</span>
                </Button>
                <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
                  <SelectTrigger className="w-full sm:w-[180px]" aria-label="Filter by vehicle">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="All Vehicles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Vehicles</SelectItem>
                    {vehicles.map((vehicle) => <SelectItem key={vehicle.id} value={vehicle.id}>{vehicle.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Calendar Grid */}
            <motion.div 
              layout
              className="grid grid-cols-7 gap-1 sm:gap-2" 
              role="grid" 
              aria-label="Calendar grid"
            >
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="text-center font-semibold text-xs sm:text-sm text-muted-foreground p-1 sm:p-2">
                  {day}
                </div>
              ))}
              {Array.from({ length: monthStart.getDay() }).map((_, i) => <div key={`empty-${i}`} className="p-2" />)}
              
              {daysInMonth.map((day, dayIndex) => {
                const dayBookings = getBookingsForDay(day);
                const bookingsCount = dayBookings.length;
                const hasConflict = hasConflicts(day);
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const isToday = isSameDay(day, new Date());
                
                const getDensityClass = () => {
                  if (bookingsCount === 0) return '';
                  if (bookingsCount >= 5) return 'bg-success/30 border-success/40';
                  if (bookingsCount >= 3) return 'bg-warning/20 border-warning/30';
                  return 'bg-primary/10 border-primary/20';
                };

                return (
                  <motion.div 
                    key={day.toISOString()} 
                    data-calendar-day 
                    role="gridcell" 
                    tabIndex={dayIndex === focusedDateIndex ? 0 : -1}
                    onClick={() => setSelectedDate(isSelected ? undefined : day)} 
                    onKeyDown={(e) => handleKeyDown(e, dayIndex, day)}
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    animate={isSelected ? { scale: 1.05 } : { scale: 1 }}
                    aria-selected={isSelected}
                    className={`relative p-1 sm:p-2 min-h-[50px] sm:min-h-[70px] rounded-lg border cursor-pointer transition-colors
                      ${isSelected ? 'border-primary bg-primary/20 shadow-lg shadow-primary/20' : getDensityClass() || 'border-border hover:border-primary/50'}
                      ${isToday ? 'ring-2 ring-accent ring-offset-1 ring-offset-background' : ''} 
                      ${hasConflict ? 'border-destructive bg-destructive/10' : ''}
                      focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className={`text-xs sm:text-sm font-semibold ${isToday ? 'text-accent' : bookingsCount >= 5 ? 'text-success' : bookingsCount >= 3 ? 'text-warning' : ''}`}>
                        {format(day, 'd')}
                      </span>
                      {hasConflict && <AlertTriangle className="h-3 w-3 text-destructive flex-shrink-0 animate-pulse" />}
                    </div>
                    
                    {/* Booking Pills with Hover Preview */}
                    {bookingsCount > 0 && (
                      <div className="space-y-0.5">
                        {dayBookings.slice(0, 2).map((booking) => {
                          const vehicle = vehicles.find(v => v.id === booking.vehicle_id);
                          const vehicleColor = vehicleColors[booking.vehicle_id];
                          
                          return (
                            <HoverCard key={booking.id} openDelay={300} closeDelay={100}>
                              <HoverCardTrigger asChild>
                                <div 
                                  className="text-[9px] sm:text-[10px] px-1 py-0.5 rounded truncate cursor-pointer hover:brightness-110 transition-all"
                                  style={{ backgroundColor: `${vehicleColor || '#888'}20`, color: vehicleColor || '#888', borderLeft: `2px solid ${vehicleColor || '#888'}` }}
                                  onClick={(e) => { e.stopPropagation(); handleBookingClick(booking.id); }}
                                >
                                  {vehicle?.name?.split(' ').slice(-1)[0] || booking.vehicle_name?.split(' ').slice(-1)[0] || 'Booking'}
                                </div>
                              </HoverCardTrigger>
                              <HoverCardContent 
                                side="right" 
                                align="start" 
                                className="p-4 z-50"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <BookingPreviewCard 
                                  booking={booking} 
                                  vehicle={vehicle}
                                  onViewDetails={() => handleBookingClick(booking.id)}
                                />
                              </HoverCardContent>
                            </HoverCard>
                          );
                        })}
                        {bookingsCount > 2 && (
                          <div className="text-[9px] text-muted-foreground text-center">
                            +{bookingsCount - 2} more
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </motion.div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t text-xs">
              <div className="flex items-center space-x-1.5"><div className="w-3 h-3 rounded border border-primary bg-primary/20" /><span className="text-muted-foreground">Selected</span></div>
              <div className="flex items-center space-x-1.5"><div className="w-3 h-3 rounded ring-2 ring-accent ring-offset-1" /><span className="text-muted-foreground">Today</span></div>
              <div className="flex items-center space-x-1.5"><div className="w-3 h-3 rounded border border-success/40 bg-success/30" /><span className="text-muted-foreground">High</span></div>
              <div className="flex items-center space-x-1.5"><div className="w-3 h-3 rounded border border-warning/30 bg-warning/20" /><span className="text-muted-foreground">Moderate</span></div>
              <div className="flex items-center space-x-1.5"><AlertTriangle className="h-3 w-3 text-destructive" /><span className="text-muted-foreground">Conflict</span></div>
            </div>
          </Card>
        </motion.div>

        {/* Day Details Panel - Animated Slide-in */}
        <AnimatePresence mode="wait">
          {selectedDate && (
            <motion.div
              key="day-panel"
              initial={{ opacity: 0, x: 50, width: 0 }}
              animate={{ opacity: 1, x: 0, width: 'auto' }}
              exit={{ opacity: 0, x: 50, width: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="lg:w-[45%]"
            >
              <Card className="card-premium p-4 sm:p-6 h-full">
                {/* Panel Header */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <motion.h4 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-lg sm:text-xl font-bold"
                    >
                      {format(selectedDate, 'EEEE')}
                    </motion.h4>
                    <motion.p 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.1 }}
                      className="text-sm text-muted-foreground"
                    >
                      {format(selectedDate, 'MMMM d, yyyy')}
                    </motion.p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={clearSelection} className="h-8 w-8">
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Stats Bar */}
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="grid grid-cols-3 gap-2 mb-4"
                >
                  <div className="p-2 rounded-lg bg-muted/30 text-center">
                    <div className="text-lg font-bold">{selectedDayBookings.length}</div>
                    <div className="text-[10px] text-muted-foreground">Bookings</div>
                  </div>
                  <div className="p-2 rounded-lg bg-success/10 text-center">
                    <div className="text-lg font-bold text-success">
                      ${selectedDayBookings.reduce((sum, b) => sum + Number(b.total_value || 0), 0).toLocaleString()}
                    </div>
                    <div className="text-[10px] text-muted-foreground">Revenue</div>
                  </div>
                  <div className="p-2 rounded-lg bg-primary/10 text-center">
                    <div className="text-lg font-bold text-primary">
                      {new Set(selectedDayBookings.map(b => b.vehicle_id)).size}
                    </div>
                    <div className="text-[10px] text-muted-foreground">Vehicles</div>
                  </div>
                </motion.div>

                {/* Bookings List */}
                <div className="space-y-3 max-h-[calc(100vh-400px)] overflow-y-auto pr-1">
                  {selectedDayBookings.length === 0 ? (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-center py-12 text-muted-foreground"
                    >
                      <CalendarIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p className="font-medium">No bookings</p>
                      <p className="text-sm">This day is wide open!</p>
                    </motion.div>
                  ) : (
                    selectedDayBookings.map((booking, index) => {
                      const vehicle = vehicles.find(v => v.id === booking.vehicle_id);
                      const vehicleColor = vehicleColors[booking.vehicle_id];
                      const vehicleImage = vehicle ? getVehicleImage(vehicle.name) : null;

                      return (
                        <motion.div 
                          key={booking.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.1 + index * 0.05 }}
                          onClick={() => handleBookingClick(booking.id)}
                          className="relative p-3 rounded-xl border cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all group overflow-hidden"
                          style={{ borderLeftWidth: '4px', borderLeftColor: vehicleColor }}
                          whileHover={{ scale: 1.01, y: -2 }}
                          whileTap={{ scale: 0.99 }}
                        >
                          {/* Background Vehicle Image */}
                          {vehicleImage && (
                            <div className="absolute right-0 top-0 w-24 h-full opacity-10 group-hover:opacity-20 transition-opacity">
                              <img src={vehicleImage} alt="" className="w-full h-full object-cover" />
                            </div>
                          )}
                          
                          <div className="relative">
                            {/* Header */}
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2">
                                {vehicleImage && (
                                  <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 shadow-sm">
                                    <img src={vehicleImage} alt={vehicle?.name} className="w-full h-full object-cover" />
                                  </div>
                                )}
                                <div>
                                  <h5 className="font-semibold text-sm group-hover:text-primary transition-colors">
                                    {vehicle?.name || 'Unknown'}
                                  </h5>
                                  <p className="text-xs text-muted-foreground">{booking.customer_name}</p>
                                </div>
                              </div>
                              <Badge 
                                variant="outline"
                                className={`text-[10px] ${
                                  booking.status === 'confirmed' ? 'bg-success/10 text-success border-success/30' :
                                  booking.status === 'completed' ? 'bg-primary/10 text-primary border-primary/30' :
                                  booking.status === 'cancelled' ? 'bg-destructive/10 text-destructive border-destructive/30' :
                                  'bg-warning/10 text-warning border-warning/30'
                                }`}
                              >
                                {booking.status}
                              </Badge>
                            </div>

                            {/* Details */}
                            <div className="grid grid-cols-2 gap-1 text-xs mb-2">
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {format(new Date(booking.start_date), 'h:mm a')}
                              </div>
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <MapPin className="h-3 w-3" />
                                <span className="truncate">{booking.pickup_location}</span>
                              </div>
                            </div>

                            {/* Footer */}
                            <div className="flex items-center justify-between pt-2 border-t border-dashed">
                              <span className="font-bold text-success">
                                ${Number(booking.total_value).toLocaleString()}
                              </span>
                              <div className="flex gap-1">
                                {booking.customer_phone && (
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-7 w-7"
                                    onClick={(e) => { e.stopPropagation(); window.location.href = `tel:${booking.customer_phone}`; }}
                                  >
                                    <Phone className="h-3 w-3" />
                                  </Button>
                                )}
                                {booking.customer_email && (
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-7 w-7"
                                    onClick={(e) => { e.stopPropagation(); window.location.href = `mailto:${booking.customer_email}`; }}
                                  >
                                    <Mail className="h-3 w-3" />
                                  </Button>
                                )}
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7"
                                  onClick={(e) => { e.stopPropagation(); handleBookingClick(booking.id); }}
                                >
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
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};
