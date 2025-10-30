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
  User,
  Plus,
  ArrowRight,
  CheckCircle
} from "lucide-react";

export const BookEnhanced = () => {
  const { bookings, createBooking, updateBookingStatus } = useFleet();
  const [showNewBooking, setShowNewBooking] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [showBookingDetails, setShowBookingDetails] = useState(false);

  const nextBooking = bookings.find(b => b.status === 'confirmed') || {
    vehicle: "McLaren 720S",
    customer: "John Smith",
    time: "2:00 PM Today",
    location: "Downtown Pickup",
    value: "$450",
    status: "confirmed"
  };

  const todayBookings = bookings.slice(0, 5);

  const todayStats = [
    { label: "Today's Bookings", value: bookings.filter(b => b.date === 'Today').length.toString(), icon: Calendar },
    { label: "This Week", value: "35", icon: Clock },
    { label: "Next 7 Days", value: "$12,400", icon: CheckCircle }
  ];

  const handleViewDetails = (booking: any) => {
    setSelectedBooking(booking);
    setShowBookingDetails(true);
  };

  return (
    <>
      <NewBookingDialog
        open={showNewBooking}
        onOpenChange={setShowNewBooking}
        onSubmit={createBooking}
      />
      <BookingDetailsDialog
        open={showBookingDetails}
        onOpenChange={setShowBookingDetails}
        booking={selectedBooking}
        onUpdateStatus={updateBookingStatus}
      />
    <div className="space-y-6">
      {/* Hero - Next Booking */}
      <Card className="card-premium bg-gradient-to-br from-accent/10 to-primary/10 border-accent/20 p-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <Badge className="bg-success/20 text-success border-success/30 mb-3">
              <CheckCircle className="w-3 h-3 mr-1" />
              {nextBooking.status}
            </Badge>
            <h2 className="text-4xl font-bold mb-2">Next Pickup</h2>
            <p className="text-xl text-muted-foreground">{nextBooking.time}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-accent mb-1">{nextBooking.value}</div>
            <p className="text-sm text-muted-foreground">Booking Value</p>
          </div>
        </div>

        <div className="bg-card/50 backdrop-blur-sm rounded-xl p-6 mb-4">
          <h3 className="text-2xl font-semibold mb-4">{nextBooking.vehicle}</h3>
          <div className="space-y-3">
            <div className="flex items-center text-lg">
              <User className="w-5 h-5 mr-3 text-muted-foreground" />
              {nextBooking.customer}
            </div>
            <div className="flex items-center text-lg">
              <MapPin className="w-5 h-5 mr-3 text-muted-foreground" />
              {nextBooking.location}
            </div>
          </div>
        </div>

        <Button 
          className="btn-premium w-full hover-scale"
          onClick={() => handleViewDetails(nextBooking)}
        >
          <Calendar className="w-5 h-5 mr-2" />
          View Full Schedule
        </Button>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-6">
        {todayStats.map((stat, index) => (
          <Card key={index} className="card-premium p-6 hover-scale">
            <div className="flex items-center justify-center mb-3">
              <div className="p-3 bg-primary/10 rounded-xl">
                <stat.icon className="h-6 w-6 text-primary" />
              </div>
            </div>
            <div className="text-3xl font-bold text-center mb-2">{stat.value}</div>
            <div className="text-sm text-muted-foreground text-center">{stat.label}</div>
          </Card>
        ))}
      </div>

      {/* Today's Schedule */}
      <Card className="card-premium p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold">Today's Schedule</h3>
          <Button 
            className="btn-premium hover-scale"
            onClick={() => setShowNewBooking(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Booking
          </Button>
        </div>
        
        <div className="space-y-4">
          {todayBookings.map((booking) => (
            <div 
              key={booking.id} 
              className="p-4 rounded-xl bg-muted/30 border border-primary/10 hover-scale cursor-pointer"
              onClick={() => handleViewDetails(booking)}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-semibold text-lg">{booking.vehicle}</h4>
                  <p className="text-sm text-muted-foreground">{booking.id}</p>
                </div>
                <Badge className={booking.status === 'confirmed' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}>
                  {booking.status}
                </Badge>
              </div>
              
              <div className="space-y-2 mb-4">
                <div className="flex items-center text-sm">
                  <User className="w-4 h-4 mr-2 text-muted-foreground" />
                  {booking.customer}
                </div>
                <div className="flex items-center text-sm">
                  <Clock className="w-4 h-4 mr-2 text-muted-foreground" />
                  {booking.time}
                </div>
                <div className="flex items-center text-sm">
                  <MapPin className="w-4 h-4 mr-2 text-muted-foreground" />
                  {booking.location}
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="font-semibold text-primary text-lg">{booking.value}</span>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleViewDetails(booking);
                  }}
                >
                  View Details
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
    </>
  );
};
