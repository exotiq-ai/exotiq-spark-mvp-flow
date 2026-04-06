import { useState, useMemo, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TabsContent } from "@/components/ui/tabs";
import { ModuleTabs } from "@/components/common/ModuleTabs";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { useModuleNavigation } from "@/hooks/useModuleNavigation";
import { useSearchParams } from "react-router-dom";
import { NewBookingDialog } from "@/components/dialogs/NewBookingDialog";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { EnhancedBookingDialog } from "@/components/dialogs/EnhancedBookingDialog";
import { BookingCalendar } from "@/components/dashboard/BookingCalendar";
import { PaymentTracker } from "@/components/dashboard/PaymentTracker";
import { InspectionsTab } from "@/components/dashboard/InspectionsTab";
import { CRMSection } from "@/components/dashboard/CRMSection";
import { VehicleImageDialog } from "@/components/dialogs/VehicleImageDialog";
import { AskRariQuickAction } from "@/components/common/AskRariQuickAction";
import { LocationBadge } from "@/components/common/LocationBadge";
import { DataHealthBadge } from "@/components/common/DataHealthBadge";
import { SkeletonCard, SkeletonMetric } from "@/components/ui/skeleton-card";
import { EmptyState, NoBookingsState } from "@/components/common/EmptyState";
import { VehicleThumbnail } from "@/components/common/VehicleThumbnail";
import { UpcomingBookingsCard } from "@/components/dashboard/UpcomingBookingsCard";
import { PreviousBookingsCard } from "@/components/dashboard/PreviousBookingsCard";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  Car,
  DollarSign,
  Plus,
  Receipt,
  ClipboardCheck,
  CheckCircle,
  Circle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Users
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tables } from "@/integrations/supabase/types";

type Booking = Tables<"bookings">;

// Compact collapsible pending approvals bar
const PendingApprovalsBar = ({
  pendingBookings,
  getVehicleDisplay,
  formatDate,
  goToCustomerProfile,
  onView,
  onDecline,
  onApprove,
}: {
  pendingBookings: Booking[];
  getVehicleDisplay: (booking: Booking) => string;
  formatDate: (dateString: string) => string;
  goToCustomerProfile: (id: string) => void;
  onView: (booking: Booking) => void;
  onDecline: (id: string) => void;
  onApprove: (id: string) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="overflow-hidden border-warning/40">
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-warning" />
              <span className="text-sm font-semibold">Pending Approval</span>
              <Badge className="bg-warning/20 text-warning border-warning/30 text-xs">{pendingBookings.length}</Badge>
            </div>
            {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-3 space-y-2">
            <AnimatePresence mode="popLayout">
              {pendingBookings.slice(0, 5).map((booking) => (
                <motion.div
                  key={booking.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 100, height: 0 }}
                  transition={{ type: "spring", damping: 20, stiffness: 300 }}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                >
                  <div className="min-w-0 flex-1">
                    <p className={`font-medium text-sm truncate ${booking.customer_id ? 'cursor-pointer hover:text-primary transition-colors' : ''}`}
                      onClick={() => booking.customer_id && goToCustomerProfile(booking.customer_id)}
                    >{booking.customer_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {getVehicleDisplay(booking)} · {formatDate(booking.start_date)}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0 ml-3">
                    <Button size="sm" variant="ghost" onClick={() => onView(booking)}>View</Button>
                    <Button size="sm" variant="outline" onClick={() => onDecline(booking.id)}>Decline</Button>
                    <Button size="sm" onClick={() => onApprove(booking.id)}>Approve</Button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {pendingBookings.length > 5 && (
              <p className="text-xs text-muted-foreground text-center pt-1">
                +{pendingBookings.length - 5} more pending
              </p>
            )}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

export const BookEnhanced = () => {
  const { bookings, vehicles, customers, createBooking, updateBookingStatus, loading } = useLocationFilteredFleet();
  const { goToBookingDetails, goToVehicleDetails, goToCustomerProfile, goToPayments } = useModuleNavigation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showNewBooking, setShowNewBooking] = useState(false);
  const [showBookingDetails, setShowBookingDetails] = useState(false);
  const [activeTab, setActiveTab] = useState<string | undefined>(undefined);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [cancellingBookingId, setCancellingBookingId] = useState<string | null>(null);
  const [showVehicleImage, setShowVehicleImage] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<{
    name: string;
    make: string;
    model: string;
    year: number;
    status: string;
    dailyRate: number;
    utilization?: number;
    revenue?: number;
    returnDate?: string;
    maintenanceAlerts?: Array<{
      type: string;
      description: string;
      severity: 'low' | 'medium' | 'high';
    }>;
  } | null>(null);

  // Handle tab and customerId URL parameters
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) {
      // Map URL param 'crm' to tab id 'customers'
      const tabMap: Record<string, string> = { crm: 'customers' };
      setActiveTab(tabMap[tab] || tab);
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('tab');
      newParams.delete('customerId'); // consumed by CRM component or future use
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Handle bookingId URL parameter to auto-open booking details
  useEffect(() => {
    const bookingId = searchParams.get('bookingId');
    if (bookingId && bookings.length > 0 && !loading) {
      const booking = bookings.find(b => b.id === bookingId);
      if (booking) {
        setSelectedBooking(booking);
        setShowBookingDetails(true);
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('bookingId');
        setSearchParams(newParams, { replace: true });
      }
    }
  }, [searchParams, bookings, loading, setSearchParams]);

  // Deep-link: auto-open new booking dialog from action param
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'new') {
      setShowNewBooking(true);
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('action');
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Show empty state if no bookings
  const hasNoBookings = !loading && bookings.length === 0;

  const handleVehicleClick = (vehicleId: string, returnDate?: string) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    
    if (vehicle) {
      setSelectedVehicle({
        name: vehicle.name,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        status: vehicle.status,
        dailyRate: Number(vehicle.current_rate),
        utilization: vehicle.utilization || 0,
        revenue: Number(vehicle.revenue || 0),
        returnDate,
        maintenanceAlerts: [],
      });
      setShowVehicleImage(true);
    } else if (vehicleId === 'f067336b-a039-429b-9d64-a17b6cce06c7') {
      // Fallback for mock Audi S8 Plus
      setSelectedVehicle({
        name: 'Audi S8 Plus',
        make: 'Audi',
        model: 'S8 Plus',
        year: 2017,
        status: 'rented',
        dailyRate: 450,
        utilization: 85,
        revenue: 12500,
        returnDate,
        maintenanceAlerts: [],
      });
      setShowVehicleImage(true);
    }
  };

  // Updated to accept booking object and fall back to vehicle_name for imported bookings
  const getVehicleDisplay = (booking: Booking) => {
    const vehicle = vehicles.find(v => v.id === booking.vehicle_id);
    if (vehicle) {
      return `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
    }
    // Fall back to stored vehicle_name from import
    if (booking.vehicle_name) {
      return booking.vehicle_name;
    }
    // Fallback for mock data
    return booking.vehicle_id === 'f067336b-a039-429b-9d64-a17b6cce06c7' ? 'Audi S8 Plus' : 'Unknown Vehicle';
  };

  // Find next confirmed booking starting from now (sorted by start_date)
  const nextBooking = useMemo(() => {
    const now = new Date();
    return bookings
      .filter(b => b.status === 'confirmed' && new Date(b.start_date) >= now)
      .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())[0] || null;
  }, [bookings]);

  // Get pending bookings for approval section
  const pendingBookings = useMemo(() => {
    return bookings.filter(b => b.status === 'pending');
  }, [bookings]);

  const todayBookings = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);
    
    return bookings.filter(b => {
      const startDate = new Date(b.start_date);
      const endDate = new Date(b.end_date);
      // Starts today OR is actively spanning today
      return (
        (startDate >= todayStart && startDate <= todayEnd) ||
        (startDate <= now && endDate >= now)
      );
    }).slice(0, 5);
  }, [bookings]);

  // Calculate live stats - only Active Rentals and Today's Bookings
  const todayStats = useMemo(() => {
    const now = new Date();
    
    // Active rentals (confirmed bookings spanning now)
    const activeRentals = bookings.filter(b => 
      b.status === 'confirmed' && 
      new Date(b.start_date) <= now && 
      new Date(b.end_date) >= now
    ).length;
    
    // Today's total bookings count
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const todayBookingCount = bookings.filter(b => {
      const startDate = new Date(b.start_date);
      const endDate = new Date(b.end_date);
      return (startDate >= today && startDate < tomorrow) || (startDate <= now && endDate >= now);
    }).length;
    
    return { activeRentals, todayBookingCount };
  }, [bookings]);

  const handleViewDetails = (booking: Booking) => {
    goToBookingDetails(booking.id);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="h-12 bg-muted/50 rounded-lg animate-pulse" />
        <SkeletonCard />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
          <SkeletonMetric />
          <SkeletonMetric />
          <SkeletonMetric />
          <SkeletonMetric />
        </div>
      </div>
    );
  }

  return (
    <>
      {selectedVehicle && (
        <VehicleImageDialog
          open={showVehicleImage}
          onOpenChange={setShowVehicleImage}
          vehicleName={selectedVehicle.name}
          vehicleDetails={selectedVehicle}
        />
      )}

      <NewBookingDialog
        open={showNewBooking}
        onOpenChange={setShowNewBooking}
        vehicles={vehicles}
        onSubmit={createBooking}
      />
      
      <EnhancedBookingDialog
        open={showBookingDetails}
        onOpenChange={(open) => {
          setShowBookingDetails(open);
          if (!open) setSelectedBooking(null);
        }}
        bookingId={selectedBooking?.id || null}
        onNavigateToModule={(moduleId, context) => {
          setShowBookingDetails(false);
          setSelectedBooking(null);
          
          if (moduleId === 'motoriq' && context?.vehicleId) {
            goToVehicleDetails(context.vehicleId);
          } else if (moduleId === 'core' && context?.customerId) {
            goToCustomerProfile(context.customerId);
          } else if (moduleId === 'pulse' && context?.bookingId) {
            goToPayments(context.bookingId);
          }
        }}
      />

      <ModuleTabs
        tabs={[
          { id: "overview", label: "Overview", shortLabel: "Home", icon: Car },
          { id: "calendar", label: "Calendar", shortLabel: "Cal", icon: CalendarIcon },
          { id: "customers", label: "CRM", shortLabel: "CRM", icon: Users },
          { id: "payments", label: "Payments", shortLabel: "Pay", icon: Receipt },
          { id: "inspections", label: "Inspections", shortLabel: "Check", icon: ClipboardCheck },
        ]}
        defaultValue="overview"
        value={activeTab}
        onValueChange={(val) => setActiveTab(val)}
        data-tour="book-tabs"
      >
        <TabsContent value="overview" className="space-y-4 sm:space-y-6">
        {/* Page-level header with prominent New Booking button */}
        <div className="flex items-center justify-between">
          <h2 className="font-brand text-lg font-semibold text-foreground">Booking Overview</h2>
          <Button onClick={() => setShowNewBooking(true)} size="default" className="shadow-md text-xs sm:text-sm">
            <Plus className="h-5 w-5 mr-2" />
            New Booking
          </Button>
        </div>

        {/* Pending Approvals — compact collapsible bar, hidden when 0 */}
        {pendingBookings.length > 0 && (
          <PendingApprovalsBar
            pendingBookings={pendingBookings}
            getVehicleDisplay={getVehicleDisplay}
            formatDate={formatDate}
            goToCustomerProfile={goToCustomerProfile}
            onView={(booking) => { setSelectedBooking(booking); setShowBookingDetails(true); }}
            onDecline={(id) => setCancellingBookingId(id)}
            onApprove={(id) => updateBookingStatus(id, 'confirmed')}
          />
        )}

        {/* Compact metrics + Next Pickup grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Car className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Active Rentals</span>
            </div>
            <div className="text-2xl font-bold">{todayStats.activeRentals}</div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <CalendarIcon className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Today's Bookings</span>
            </div>
            <div className="text-2xl font-bold">{todayStats.todayBookingCount}</div>
          </Card>

          <Card className="p-4 col-span-2 lg:col-span-1 border-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Next Pickup</span>
            </div>
            {nextBooking ? (
              <div className="space-y-1">
                <div 
                  className="font-semibold text-sm truncate cursor-pointer hover:text-primary transition-colors"
                  onClick={() => nextBooking.vehicle_id && handleVehicleClick(nextBooking.vehicle_id, nextBooking.end_date)}
                >
                  {getVehicleDisplay(nextBooking)}
                </div>
                <div 
                  className="text-xs text-muted-foreground truncate cursor-pointer hover:text-primary transition-colors"
                  onClick={() => { setSelectedBooking(nextBooking); setShowBookingDetails(true); }}
                >
                  {nextBooking.customer_name}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatTime(nextBooking.start_date)}
                  </span>
                  <span className="flex items-center gap-1 truncate">
                    <MapPin className="h-3 w-3 flex-shrink-0" />
                    {nextBooking.pickup_location}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No upcoming pickups</p>
            )}
          </Card>
        </div>

        {/* Today's Schedule */}
        <Card className="card-module p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-semibold flex items-center">
                <CalendarIcon className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-primary flex-shrink-0" />
                Today's Schedule
              </h3>
              <AskRariQuickAction
                variant="icon"
                prompt="Help me optimize today's booking schedule. Show me any conflicts, suggest better time slots, or identify opportunities for additional bookings."
              />
            </div>
            <Button onClick={() => setShowNewBooking(true)} size="sm" variant="outline" className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Add
            </Button>
          </div>

          <div className="space-y-3">
            {todayBookings.length === 0 ? (
              <EmptyState
                icon={<CalendarIcon className="h-16 w-16" />}
                title="No bookings today"
                description="Start by creating your first booking."
                action={{
                  label: "Create Booking",
                  onClick: () => setShowNewBooking(true)
                }}
              />
            ) : (
              todayBookings.map((booking) => (
              <div
                key={booking.id}
                className="p-3 sm:p-4 rounded-xl bg-muted/30 hover:bg-muted/50 active:bg-muted/70 active:scale-[0.99] transition-all flex items-start gap-3 sm:gap-4"
              >
                <VehicleThumbnail
                  vehicleName={getVehicleDisplay(booking)}
                  imageUrl={vehicles.find(v => v.id === booking.vehicle_id)?.image_url}
                  size="avatar"
                  onClick={() => booking.vehicle_id && handleVehicleClick(booking.vehicle_id)}
                  className="flex-shrink-0 mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <DataHealthBadge hasCustomer={!!booking.customer_id} hasVehicle={!!booking.vehicle_id} size="sm" />
                      <span className="font-semibold cursor-pointer hover:text-primary transition-colors leading-tight"
                        onClick={() => booking.vehicle_id && handleVehicleClick(booking.vehicle_id)}
                      >{getVehicleDisplay(booking)}</span>
                    </div>
                    <div className="sm:hidden flex-shrink-0">
                      {booking.status === 'confirmed' ? <CheckCircle className="h-5 w-5 text-success" /> :
                       booking.status === 'pending' ? <Clock className="h-5 w-5 text-warning" /> :
                       <Circle className="h-5 w-5 text-muted-foreground" />}
                    </div>
                    <AskRariQuickAction variant="icon" className="hidden sm:inline-flex"
                      prompt={`Tell me about this booking: ${getVehicleDisplay(booking)} for ${booking.customer_name}. Start: ${formatDate(booking.start_date)}, Status: ${booking.status}, Value: $${Number(booking.total_value).toLocaleString()}`}
                    />
                  </div>
                  <div className="text-sm text-muted-foreground mt-0.5 cursor-pointer hover:text-primary transition-colors"
                    onClick={() => { setSelectedBooking(booking); setShowBookingDetails(true); }}
                  >{booking.customer_name}</div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1 sm:hidden">
                    <span>{formatDate(booking.start_date)}, {formatTime(booking.start_date)}</span>
                    <span>·</span>
                    <LocationBadge locationId={booking.pickup_location_id} showIcon={false} size="sm" />
                  </div>
                  <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                    <LocationBadge locationId={booking.pickup_location_id} showIcon={false} />
                  </div>
                </div>
                <div className="hidden sm:flex flex-col items-end text-sm gap-0.5">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-3 w-3" /><span>{formatTime(booking.start_date)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-semibold">
                    <DollarSign className="h-3 w-3 text-muted-foreground" /><span>${Number(booking.total_value).toLocaleString()}</span>
                  </div>
                </div>
                <Badge className={`hidden sm:flex flex-shrink-0 ${
                  booking.status === 'confirmed' ? 'bg-success/20 text-success border-success/30' :
                  booking.status === 'pending' ? 'bg-warning/20 text-warning border-warning/30' :
                  'bg-muted/20 text-muted-foreground'
                }`}>{booking.status}</Badge>
              </div>
            )))}
          </div>
        </Card>

        {/* Upcoming Bookings - Next 15 Days */}
        <UpcomingBookingsCard bookings={bookings} vehicles={vehicles}
          onBookingClick={(booking) => { setSelectedBooking(booking); setShowBookingDetails(true); }}
        />

        {/* Previous Bookings - Last 30 Days */}
        <PreviousBookingsCard bookings={bookings} vehicles={vehicles}
          onBookingClick={(booking) => { setSelectedBooking(booking); setShowBookingDetails(true); }}
        />
        </TabsContent>

        <TabsContent value="calendar">
          <BookingCalendar 
            onNavigateToModule={(moduleId, context) => {
              if (moduleId === 'core' && context?.customerId) {
                goToCustomerProfile(context.customerId);
              } else if (moduleId === 'motoriq' && context?.vehicleId) {
                goToVehicleDetails(context.vehicleId);
              } else if (moduleId === 'pulse' && context?.bookingId) {
                goToPayments(context.bookingId);
              }
            }}
          />
        </TabsContent>

        <TabsContent value="customers">
          <CRMSection />
        </TabsContent>

        <TabsContent value="payments">
          <PaymentTracker />
        </TabsContent>

        <TabsContent value="inspections">
          <InspectionsTab vehicles={vehicles} />
        </TabsContent>
      </ModuleTabs>
      <ConfirmationDialog
        open={!!cancellingBookingId}
        onOpenChange={(open) => { if (!open) setCancellingBookingId(null); }}
        title="Decline Booking?"
        description="Are you sure you want to decline this booking? This action cannot be undone."
        confirmText="Yes, Decline"
        cancelText="Keep Booking"
        variant="destructive"
        onConfirm={() => {
          if (cancellingBookingId) {
            updateBookingStatus(cancellingBookingId, 'cancelled');
            setCancellingBookingId(null);
          }
        }}
      />
    </>
  );
};

export default BookEnhanced;
