import { useState, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TabsContent } from "@/components/ui/tabs";
import { ModuleTabs } from "@/components/common/ModuleTabs";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { useModuleNavigation } from "@/hooks/useModuleNavigation";
import { useSearchParams } from "react-router-dom";
import { NewBookingDialog } from "@/components/dialogs/NewBookingDialog";
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
import { 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  Car,
  TrendingUp,
  DollarSign,
  Users,
  Plus,
  Receipt,
  ClipboardCheck,
  CheckCircle,
  Circle,
  AlertCircle
} from "lucide-react";
import { Tables } from "@/integrations/supabase/types";

type Booking = Tables<"bookings">;

export const BookEnhanced = () => {
  const { bookings, vehicles, customers, createBooking, updateBookingStatus, loading } = useLocationFilteredFleet();
  const { goToBookingDetails, goToVehicleDetails, goToCustomerProfile, goToPayments } = useModuleNavigation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showNewBooking, setShowNewBooking] = useState(false);
  const [showBookingDetails, setShowBookingDetails] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
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

  // Handle bookingId URL parameter to auto-open booking details
  useEffect(() => {
    const bookingId = searchParams.get('bookingId');
    if (bookingId && bookings.length > 0 && !loading) {
      const booking = bookings.find(b => b.id === bookingId);
      if (booking) {
        setSelectedBooking(booking);
        setShowBookingDetails(true);
        // Clear the bookingId param after opening
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('bookingId');
        setSearchParams(newParams, { replace: true });
      }
    }
  }, [searchParams, bookings, loading, setSearchParams]);

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

  // Calculate live stats
  const todayStats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const now = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    
    // Today's Revenue from confirmed/completed bookings starting today
    const todayRevenue = bookings
      .filter(b => {
        const startDate = new Date(b.start_date);
        return (b.status === 'confirmed' || b.status === 'completed') && 
               startDate >= today && startDate < tomorrow;
      })
      .reduce((sum, b) => sum + (b.total_value || 0), 0);
    
    // Active rentals (confirmed bookings spanning now)
    const activeRentals = bookings.filter(b => 
      b.status === 'confirmed' && 
      new Date(b.start_date) <= now && 
      new Date(b.end_date) >= now
    ).length;
    
    // New customers this month
    const newCustomers = customers.filter(c => 
      c.created_at && new Date(c.created_at) >= monthStart
    ).length;
    
    // Utilization rate
    const utilization = vehicles.length > 0 
      ? Math.round((activeRentals / vehicles.length) * 100) 
      : 0;
    
    return [
      { label: "Today's Revenue", value: `$${todayRevenue.toLocaleString()}`, icon: DollarSign },
      { label: 'Active Rentals', value: String(activeRentals), icon: Car },
      { label: 'New Customers', value: String(newCustomers), icon: Users },
      { label: 'Utilization', value: `${utilization}%`, icon: TrendingUp },
    ];
  }, [bookings, vehicles, customers]);

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
        data-tour="book-tabs"
      >
        <TabsContent value="overview" className="space-y-4 sm:space-y-6">
        {/* Pending Reservations Section */}
        {pendingBookings.length > 0 && (
          <Card className="card-module p-4 sm:p-6 border-warning/50 bg-warning/5">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="h-5 w-5 text-warning" />
              <h3 className="text-base font-semibold">Pending Approval</h3>
              <Badge className="bg-warning/20 text-warning border-warning/30">{pendingBookings.length}</Badge>
            </div>
            <div className="space-y-3">
              {pendingBookings.slice(0, 3).map((booking) => (
                <div key={booking.id} className="flex items-center justify-between p-3 bg-card rounded-lg">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <DataHealthBadge 
                      hasCustomer={!!booking.customer_id}
                      hasVehicle={!!booking.vehicle_id}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className={`font-medium truncate ${booking.customer_id ? 'cursor-pointer hover:text-primary transition-colors' : ''}`}
                        onClick={() => booking.customer_id && goToCustomerProfile(booking.customer_id)}
                      >{booking.customer_name}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {getVehicleDisplay(booking)} - {formatDate(booking.start_date)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0 ml-3">
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => {
                        setSelectedBooking(booking);
                        setShowBookingDetails(true);
                      }}
                    >
                      View
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => updateBookingStatus(booking.id, 'cancelled')}
                    >
                      Decline
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={() => updateBookingStatus(booking.id, 'confirmed')}
                    >
                      Approve
                    </Button>
                  </div>
                </div>
              ))}
              {pendingBookings.length > 3 && (
                <p className="text-xs text-muted-foreground text-center pt-2">
                  +{pendingBookings.length - 3} more pending bookings
                </p>
              )}
            </div>
          </Card>
        )}

        {/* Next Pickup Card */}
        {nextBooking ? (
          <Card className="card-premium bg-gradient-to-br from-primary/10 to-accent/5 border-primary/20 p-3 sm:p-4" data-tour="next-pickup">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold">Next Pickup</h3>
              <Badge className="bg-success/20 text-success border-success/30">
                {nextBooking.status?.toUpperCase()}
              </Badge>
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <VehicleThumbnail
                  vehicleName={(() => {
                    const vehicle = vehicles.find(v => v.id === nextBooking.vehicle_id);
                    return vehicle ? vehicle.name : nextBooking.vehicle_name || 'Unknown Vehicle';
                  })()}
                  imageUrl={vehicles.find(v => v.id === nextBooking.vehicle_id)?.image_url}
                  size="lg"
                  onClick={() => nextBooking.vehicle_id && handleVehicleClick(nextBooking.vehicle_id, nextBooking.end_date)}
                />
                <div className="min-w-0 flex-1">
                  <div 
                    className="font-semibold text-base truncate cursor-pointer hover:text-primary transition-colors"
                    onClick={() => nextBooking.vehicle_id && handleVehicleClick(nextBooking.vehicle_id, nextBooking.end_date)}
                  >
                    {getVehicleDisplay(nextBooking)}
                  </div>
                  <div className="text-sm text-muted-foreground truncate cursor-pointer hover:text-primary transition-colors"
                    onClick={() => { setSelectedBooking(nextBooking); setShowBookingDetails(true); }}
                  >{nextBooking.customer_name}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center space-x-2 p-2 rounded-lg bg-card/50 min-w-0">
                  <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-muted-foreground">Time</div>
                    <div className="font-medium truncate">{formatTime(nextBooking.start_date)}</div>
                  </div>
                </div>
                <div className="flex items-center space-x-2 p-2 rounded-lg bg-card/50 min-w-0">
                  <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-muted-foreground">Location</div>
                    <div className="font-medium truncate">{nextBooking.pickup_location}</div>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <div className="text-xl font-bold text-primary">${Number(nextBooking.total_value).toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Booking Value</div>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="card-premium bg-gradient-to-br from-primary/10 to-accent/5 border-primary/20 p-4 sm:p-6 text-center">
            <CalendarIcon className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground mb-4">No upcoming confirmed bookings</p>
            <Button onClick={() => setShowNewBooking(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create New Booking
            </Button>
          </Card>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {todayStats.map((stat, idx) => (
            <Card key={idx} className="card-module p-3 sm:p-4">
              <div className="flex items-center space-x-2 sm:space-x-3 mb-2">
                <stat.icon className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
                <span className="text-xs sm:text-sm text-muted-foreground truncate">{stat.label}</span>
              </div>
              <div className="text-xl sm:text-2xl font-bold">{stat.value}</div>
            </Card>
          ))}
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
            <Button onClick={() => setShowNewBooking(true)} size="sm" className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              New Booking
            </Button>
          </div>

          <div className="space-y-3">
            {todayBookings.length === 0 ? (
              <EmptyState
                icon={<CalendarIcon className="h-16 w-16" />}
                title="No bookings today"
                description="Start by creating your first booking. Track rentals, manage schedules, and monitor your fleet performance."
                action={{
                  label: "Create Booking",
                  onClick: () => setShowNewBooking(true)
                }}
              />
            ) : (
              todayBookings.map((booking) => (
              <div
                key={booking.id}
                className="p-3 sm:p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors flex items-start gap-3 sm:gap-4"
              >
                {/* Vehicle Avatar */}
                <VehicleThumbnail
                  vehicleName={getVehicleDisplay(booking)}
                  imageUrl={vehicles.find(v => v.id === booking.vehicle_id)?.image_url}
                  size="avatar"
                  onClick={() => booking.vehicle_id && handleVehicleClick(booking.vehicle_id)}
                  className="flex-shrink-0 mt-0.5"
                />

                {/* Vehicle + Customer + Location - Stacked for mobile */}
                <div className="flex-1 min-w-0">
                  {/* Line 1: Vehicle Name + Status Icon (mobile) */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <DataHealthBadge 
                        hasCustomer={!!booking.customer_id}
                        hasVehicle={!!booking.vehicle_id}
                        size="sm"
                      />
                      <span 
                        className="font-semibold cursor-pointer hover:text-primary transition-colors leading-tight"
                        onClick={() => booking.vehicle_id && handleVehicleClick(booking.vehicle_id)}
                      >
                        {getVehicleDisplay(booking)}
                      </span>
                    </div>
                    {/* Compact status icon on mobile */}
                    <div className="sm:hidden flex-shrink-0">
                      {booking.status === 'confirmed' ? (
                        <CheckCircle className="h-5 w-5 text-success" />
                      ) : booking.status === 'pending' ? (
                        <Clock className="h-5 w-5 text-warning" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <AskRariQuickAction
                      variant="icon"
                      className="hidden sm:inline-flex"
                      prompt={`Tell me about this booking: ${getVehicleDisplay(booking)} for ${booking.customer_name}. Start: ${formatDate(booking.start_date)}, Status: ${booking.status}, Value: $${Number(booking.total_value).toLocaleString()}`}
                    />
                  </div>
                  
                  {/* Line 2: Customer Name */}
                  <div className="text-sm text-muted-foreground mt-0.5 cursor-pointer hover:text-primary transition-colors"
                    onClick={() => { setSelectedBooking(booking); setShowBookingDetails(true); }}
                  >
                    {booking.customer_name}
                  </div>
                  
                  {/* Line 3: Date/Time + Location (mobile) */}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1 sm:hidden">
                    <span>{formatDate(booking.start_date)}, {formatTime(booking.start_date)}</span>
                    <span>·</span>
                    <LocationBadge locationId={booking.pickup_location_id} showIcon={false} size="sm" />
                  </div>
                  
                  {/* Location only on desktop (date/time shown in separate column) */}
                  <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                    <LocationBadge locationId={booking.pickup_location_id} showIcon={false} />
                  </div>
                </div>

                {/* Time + Price (hidden on mobile, shown on desktop) */}
                <div className="hidden sm:flex flex-col items-end text-sm gap-0.5">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{formatTime(booking.start_date)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-semibold">
                    <DollarSign className="h-3 w-3 text-muted-foreground" />
                    <span>${Number(booking.total_value).toLocaleString()}</span>
                  </div>
                </div>

                {/* Status Badge (desktop only) */}
                <Badge className={`hidden sm:flex flex-shrink-0 ${
                  booking.status === 'confirmed' ? 'bg-success/20 text-success border-success/30' :
                  booking.status === 'pending' ? 'bg-warning/20 text-warning border-warning/30' :
                  'bg-muted/20 text-muted-foreground'
                }`}>
                  {booking.status}
                </Badge>
              </div>
            ))
            )}
          </div>
        </Card>
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
    </>
  );
};
