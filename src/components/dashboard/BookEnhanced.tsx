import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { useModuleNavigation } from "@/hooks/useModuleNavigation";
import { NewBookingDialog } from "@/components/dialogs/NewBookingDialog";
import { BookingDetailsDialog } from "@/components/dialogs/BookingDetailsDialog";
import { BookingCalendar } from "@/components/dashboard/BookingCalendar";
import { PaymentTracker } from "@/components/dashboard/PaymentTracker";
import { InspectionForm } from "@/components/dashboard/InspectionForm";
import { CRMSection } from "@/components/dashboard/CRMSection";
import { VehicleImageDialog } from "@/components/dialogs/VehicleImageDialog";
import { AskRariQuickAction } from "@/components/common/AskRariQuickAction";
import { SkeletonCard, SkeletonMetric } from "@/components/ui/skeleton-card";
import { EmptyState, NoBookingsState } from "@/components/common/EmptyState";
import { getVehicleImage } from "@/lib/vehicleImageMapping";
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
  ZoomIn
} from "lucide-react";
import { Tables } from "@/integrations/supabase/types";

type Booking = Tables<"bookings">;

export const BookEnhanced = () => {
  const { bookings, vehicles, createBooking, updateBookingStatus, loading } = useLocationFilteredFleet();
  const { goToBookingDetails } = useModuleNavigation();
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

  const getVehicleDisplay = (vehicleId: string) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (!vehicle) {
      // Fallback for mock data
      return vehicleId === 'f067336b-a039-429b-9d64-a17b6cce06c7' ? 'Audi S8 Plus' : 'Unknown Vehicle';
    }
    return `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  };

  const nextBooking = bookings.find(b => b.status === 'confirmed') || {
    id: '1',
    customer_name: 'Sarah Johnson',
    start_date: new Date().toISOString(),
    pickup_location: 'Downtown',
    status: 'confirmed',
    total_value: 1350,
    vehicle_id: 'f067336b-a039-429b-9d64-a17b6cce06c7',
    end_date: new Date(Date.now() + 86400000).toISOString(),
    daily_rate: 450,
    user_id: ''
  } as Booking;

  const todayBookings = bookings.slice(0, 5);

  const todayStats = [
    { label: 'Today\'s Revenue', value: '$3,240', icon: DollarSign },
    { label: 'Active Rentals', value: '12', icon: Car },
    { label: 'New Customers', value: '8', icon: Users },
    { label: 'Utilization', value: '85%', icon: TrendingUp },
  ];

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
      <Tabs defaultValue="overview" className="space-y-4 sm:space-y-6">
        <TabsList className="w-full overflow-x-auto flex flex-nowrap gap-1 sm:grid sm:grid-cols-4 bg-muted/50 p-1 rounded-lg">
          <TabsTrigger value="overview" className="flex-shrink-0 px-3 py-2 text-xs sm:text-sm">Overview</TabsTrigger>
          <TabsTrigger value="calendar" className="flex-shrink-0 px-3 py-2 text-xs sm:text-sm">Calendar</TabsTrigger>
          <TabsTrigger value="payments" className="flex-shrink-0 px-3 py-2 text-xs sm:text-sm">Payments</TabsTrigger>
          <TabsTrigger value="inspections" className="flex-shrink-0 px-3 py-2 text-xs sm:text-sm">Inspect</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-4 sm:space-y-6">
          <SkeletonCard />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
            <SkeletonMetric />
            <SkeletonMetric />
            <SkeletonMetric />
            <SkeletonMetric />
          </div>
        </TabsContent>
      </Tabs>
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
      
      {selectedBooking && (
        <BookingDetailsDialog
          open={showBookingDetails}
          onOpenChange={setShowBookingDetails}
          booking={{
            id: selectedBooking.id,
            vehicle: `Vehicle #${selectedBooking.vehicle_id}`,
            customer: selectedBooking.customer_name,
            time: `${formatTime(selectedBooking.start_date)} - ${formatTime(selectedBooking.end_date)}`,
            location: selectedBooking.pickup_location,
            status: selectedBooking.status as 'confirmed' | 'pending' | 'completed' | 'cancelled',
            value: `$${selectedBooking.total_value}`,
            date: formatDate(selectedBooking.start_date)
          }}
          onUpdateStatus={updateBookingStatus}
        />
      )}

      <Tabs defaultValue="overview" className="space-y-4 sm:space-y-6 w-full overflow-x-hidden">
        {/* ENHANCED MOBILE-FRIENDLY HEADER */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border/50">
          <TabsList className="grid w-full grid-cols-5 gap-0 p-0 bg-transparent">
            <TabsTrigger 
              value="overview"
              className="min-h-[44px] sm:min-h-[48px] data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-none border-b-2 border-transparent data-[state=active]:border-primary transition-all"
            >
              <Car className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">Overview</span>
            </TabsTrigger>
            
            <TabsTrigger 
              value="calendar"
              className="min-h-[44px] sm:min-h-[48px] data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-none border-b-2 border-transparent data-[state=active]:border-primary transition-all"
            >
              <CalendarIcon className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">Calendar</span>
            </TabsTrigger>
            
            <TabsTrigger 
              value="customers"
              className="min-h-[44px] sm:min-h-[48px] data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-none border-b-2 border-transparent data-[state=active]:border-primary transition-all"
            >
              <Users className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">CRM</span>
            </TabsTrigger>
            
            <TabsTrigger 
              value="payments"
              className="min-h-[44px] sm:min-h-[48px] data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-none border-b-2 border-transparent data-[state=active]:border-primary transition-all"
            >
              <Receipt className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">Payments</span>
            </TabsTrigger>
            
            <TabsTrigger 
              value="inspections"
              className="min-h-[44px] sm:min-h-[48px] data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-none border-b-2 border-transparent data-[state=active]:border-primary transition-all"
            >
              <ClipboardCheck className="w-4 h-4 md:mr-2" />
              <span className="hidden sm:inline md:hidden">Inspect</span>
              <span className="hidden md:inline">Inspections</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-4 sm:space-y-6">
        {/* Next Pickup Card */}
        <Card className="card-premium bg-gradient-to-br from-primary/10 to-accent/5 border-primary/20 p-3 sm:p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold">Next Pickup</h3>
            <Badge className="bg-success/20 text-success border-success/30">
              {nextBooking.status?.toUpperCase()}
            </Badge>
          </div>

          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              {(() => {
                const vehicle = vehicles.find(v => v.id === nextBooking.vehicle_id);
                const vehicleName = vehicle ? vehicle.name : 'Unknown Vehicle';
                const vehicleImageUrl = getVehicleImage(vehicleName);
                
                return vehicleImageUrl ? (
                  <div 
                    className="relative group cursor-pointer"
                    onClick={() => handleVehicleClick(nextBooking.vehicle_id, nextBooking.end_date)}
                  >
                    <img 
                      src={vehicleImageUrl} 
                      alt={vehicleName}
                      className="h-24 w-24 rounded-xl object-cover transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-xl transition-all duration-300 flex items-center justify-center">
                      <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-primary/20 rounded-xl">
                    <Car className="h-8 w-8 text-primary" />
                  </div>
                );
              })()}
              <div className="min-w-0 flex-1">
                <div 
                  className="font-semibold text-base truncate cursor-pointer hover:text-primary transition-colors"
                  onClick={() => handleVehicleClick(nextBooking.vehicle_id, nextBooking.end_date)}
                >
                  {getVehicleDisplay(nextBooking.vehicle_id)}
                </div>
                <div className="text-sm text-muted-foreground truncate">{nextBooking.customer_name}</div>
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
              <div className="text-xl font-bold text-primary">${nextBooking.total_value}</div>
              <div className="text-sm text-muted-foreground">Booking Value</div>
            </div>
          </div>
        </Card>

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
                className="p-3 sm:p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span 
                      className="font-semibold truncate cursor-pointer hover:text-primary transition-colors"
                      onClick={() => handleVehicleClick(booking.vehicle_id)}
                    >
                      {getVehicleDisplay(booking.vehicle_id)}
                    </span>
                    <AskRariQuickAction
                      variant="icon"
                      prompt={`Tell me about this booking: ${getVehicleDisplay(booking.vehicle_id)} for ${booking.customer_name}. Start: ${formatDate(booking.start_date)}, Status: ${booking.status}, Value: $${booking.total_value}`}
                    />
                  </div>
                  <Badge className={`flex-shrink-0 ${
                    booking.status === 'confirmed' ? 'bg-success/20 text-success border-success/30' :
                    booking.status === 'pending' ? 'bg-warning/20 text-warning border-warning/30' :
                    'bg-muted/20 text-muted-foreground'
                  }`}>
                    {booking.status}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center space-x-2 min-w-0">
                    <Users className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <span className="truncate">{booking.customer_name}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <span>{formatTime(booking.start_date)}</span>
                  </div>
                  <div className="flex items-center space-x-2 min-w-0">
                    <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <span className="truncate">{booking.pickup_location}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <DollarSign className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <span className="font-semibold">${booking.total_value}</span>
                  </div>
                </div>
              </div>
            ))
            )}
          </div>
        </Card>
        </TabsContent>

        <TabsContent value="calendar">
          <BookingCalendar />
        </TabsContent>

        <TabsContent value="customers">
          <CRMSection />
        </TabsContent>

        <TabsContent value="payments">
          <PaymentTracker />
        </TabsContent>

        <TabsContent value="inspections">
          <div className="space-y-6">
            <Card className="card-premium p-6">
              <h3 className="text-lg font-semibold mb-4">Vehicle Inspections</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Select a vehicle to perform an inspection
              </p>
              {vehicles.length > 0 ? (
                <InspectionForm
                  vehicleId={vehicles[0].id}
                  inspectionType="pre_rental"
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <ClipboardCheck className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No vehicles available for inspection</p>
                </div>
              )}
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
};
