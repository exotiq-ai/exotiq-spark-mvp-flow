import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useFleet } from "@/contexts/FleetContext";
import { NewBookingDialog } from "@/components/dialogs/NewBookingDialog";
import { BookingDetailsDialog } from "@/components/dialogs/BookingDetailsDialog";
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Car,
  TrendingUp,
  DollarSign,
  Users,
  Plus
} from "lucide-react";
import { Tables } from "@/integrations/supabase/types";

type Booking = Tables<"bookings">;

export const BookEnhanced = () => {
  const { bookings, createBooking, updateBookingStatus } = useFleet();
  const [showNewBooking, setShowNewBooking] = useState(false);
  const [showBookingDetails, setShowBookingDetails] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  const nextBooking = bookings.find(b => b.status === 'confirmed') || {
    id: '1',
    customer_name: 'Sarah Johnson',
    start_date: new Date().toISOString(),
    pickup_location: 'Downtown',
    status: 'confirmed',
    total_value: 1350,
    vehicle_id: '1',
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
    setSelectedBooking(booking);
    setShowBookingDetails(true);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      <NewBookingDialog
        open={showNewBooking}
        onOpenChange={setShowNewBooking}
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

      <div className="space-y-6">
        {/* Next Pickup Card */}
        <Card className="card-premium bg-gradient-to-br from-primary/10 to-accent/5 border-primary/20 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Next Pickup</h3>
            <Badge className="bg-success/20 text-success border-success/30">
              {nextBooking.status?.toUpperCase()}
            </Badge>
          </div>

          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-primary/20 rounded-xl">
                <Car className="h-6 w-6 text-primary" />
              </div>
              <div>
                <div className="font-semibold text-lg">Vehicle #{nextBooking.vehicle_id}</div>
                <div className="text-sm text-muted-foreground">{nextBooking.customer_name}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center space-x-2 p-3 rounded-lg bg-card/50">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-xs text-muted-foreground">Time</div>
                  <div className="font-medium">{formatTime(nextBooking.start_date)}</div>
                </div>
              </div>
              <div className="flex items-center space-x-2 p-3 rounded-lg bg-card/50">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-xs text-muted-foreground">Location</div>
                  <div className="font-medium">{nextBooking.pickup_location}</div>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <div className="text-2xl font-bold text-primary">${nextBooking.total_value}</div>
              <div className="text-sm text-muted-foreground">Booking Value</div>
            </div>
          </div>
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4">
          {todayStats.map((stat, idx) => (
            <Card key={idx} className="card-module p-4">
              <div className="flex items-center space-x-3 mb-2">
                <stat.icon className="h-5 w-5 text-primary" />
                <span className="text-sm text-muted-foreground">{stat.label}</span>
              </div>
              <div className="text-2xl font-bold">{stat.value}</div>
            </Card>
          ))}
        </div>

        {/* Today's Schedule */}
        <Card className="card-module p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center">
              <Calendar className="h-5 w-5 mr-2 text-primary" />
              Today's Schedule
            </h3>
            <Button onClick={() => setShowNewBooking(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              New Booking
            </Button>
          </div>

          <div className="space-y-3">
            {todayBookings.map((booking) => (
              <div
                key={booking.id}
                className="p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => handleViewDetails(booking)}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold">Vehicle #{booking.vehicle_id}</span>
                  <Badge className={
                    booking.status === 'confirmed' ? 'bg-success/20 text-success border-success/30' :
                    booking.status === 'pending' ? 'bg-warning/20 text-warning border-warning/30' :
                    'bg-muted/20 text-muted-foreground'
                  }>
                    {booking.status}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center space-x-2">
                    <Users className="h-3 w-3 text-muted-foreground" />
                    <span>{booking.customer_name}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span>{formatTime(booking.start_date)}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-3 w-3 text-muted-foreground" />
                    <span>{booking.pickup_location}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <DollarSign className="h-3 w-3 text-muted-foreground" />
                    <span className="font-semibold">${booking.total_value}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
};
