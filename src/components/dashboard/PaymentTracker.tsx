import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { useGrowthCalculation } from "@/hooks/useGrowthCalculation";
import { VehicleImageDialog } from "@/components/dialogs/VehicleImageDialog";
import { 
  DollarSign, 
  Clock, 
  CheckCircle,
  AlertCircle,
  TrendingUp,
  TrendingDown
} from "lucide-react";
import { RecordPaymentDialog } from "@/components/dialogs/RecordPaymentDialog";
import { Database } from "@/integrations/supabase/types";

type Booking = Database['public']['Tables']['bookings']['Row'];

export const PaymentTracker = () => {
  const { bookings, payments, vehicles, createPayment } = useLocationFilteredFleet();
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const [showVehicleImage, setShowVehicleImage] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<{
    name: string;
    make: string;
    model: string;
    year: number;
    status: string;
    dailyRate: number;
  } | null>(null);

  const handleVehicleClick = (vehicleId: string) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (vehicle) {
      setSelectedVehicle({
        name: vehicle.name,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        status: vehicle.status,
        dailyRate: Number(vehicle.current_rate),
      });
      setShowVehicleImage(true);
    }
  };

  const bookingsWithPaymentStatus = bookings.map(booking => {
    const bookingPayments = payments.filter(p => p.booking_id === booking.id);
    const totalPaid = bookingPayments
      .filter(p => p.payment_status === 'completed')
      .reduce((sum, p) => sum + Number(p.amount), 0);
    
    const vehicle = vehicles.find(v => v.id === booking.vehicle_id);
    
    return {
      ...booking,
      vehicle,
      totalPaid,
      amountDue: Number(booking.balance_due || 0),
      depositPaid: bookingPayments.some(p => p.payment_type === 'deposit' && p.payment_status === 'completed'),
      balancePaid: totalPaid >= Number(booking.total_value || 0)
    };
  });

  const pendingPayments = bookingsWithPaymentStatus.filter(
    b => (b.status === 'pending' || b.status === 'confirmed') && !b.balancePaid
  );

  const overduePayments = pendingPayments.filter(b => {
    const startDate = new Date(b.start_date);
    const now = new Date();
    return startDate < now && !b.depositPaid;
  });

  const totalPending = pendingPayments.reduce((sum, b) => sum + (Number(b.total_value) - b.totalPaid), 0);
  const totalOverdue = overduePayments.reduce((sum, b) => sum + (Number(b.total_value) - b.totalPaid), 0);
  
  // Calculate real payment growth
  const completedPaymentsWithDates = payments
    .filter(p => p.payment_status === 'completed')
    .map(p => ({ created_at: p.created_at, amount: Number(p.amount) }));
  const paymentGrowth = useGrowthCalculation(completedPaymentsWithDates);

  const handleRecordPayment = (booking: Booking) => {
    setSelectedBooking(booking);
    setShowRecordPayment(true);
  };

  const getPaymentStatusBadge = (booking: typeof bookingsWithPaymentStatus[0]) => {
    if (booking.balancePaid) {
      return <Badge className="bg-success/10 text-success border-success/30"><CheckCircle className="w-3 h-3 mr-1" />Paid</Badge>;
    }
    if (booking.depositPaid) {
      return <Badge className="bg-warning/10 text-warning border-warning/30"><Clock className="w-3 h-3 mr-1" />Deposit Paid</Badge>;
    }
    const isOverdue = new Date(booking.start_date) < new Date();
    if (isOverdue) {
      return <Badge className="bg-destructive/10 text-destructive border-destructive/30"><AlertCircle className="w-3 h-3 mr-1" />Overdue</Badge>;
    }
    return <Badge className="bg-muted/10 text-muted-foreground border-muted/30"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
  };

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

      <div className="space-y-6">
      {/* Payment Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="card-premium p-6">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="h-5 w-5 text-success" />
            <TrendingUp className="h-4 w-4 text-success" />
          </div>
          <div className="text-2xl font-bold">${totalPending.toLocaleString()}</div>
          <div className="text-sm text-muted-foreground">Pending Payments</div>
          <div className="text-xs text-muted-foreground mt-1">{pendingPayments.length} bookings</div>
        </Card>

        <Card className="card-premium p-6">
          <div className="flex items-center justify-between mb-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <Badge className="bg-destructive/10 text-destructive">{overduePayments.length}</Badge>
          </div>
          <div className="text-2xl font-bold text-destructive">${totalOverdue.toLocaleString()}</div>
          <div className="text-sm text-muted-foreground">Overdue Payments</div>
        </Card>

        <Card className="card-premium p-6">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle className="h-5 w-5 text-primary" />
            {paymentGrowth !== null && (
              <span className={`text-xs ${paymentGrowth >= 0 ? 'text-success' : 'text-destructive'}`}>
                {paymentGrowth >= 0 ? '+' : ''}{paymentGrowth}%
              </span>
            )}
          </div>
          <div className="text-2xl font-bold">
            {bookingsWithPaymentStatus.filter(b => b.balancePaid).length}
          </div>
          <div className="text-sm text-muted-foreground">Completed Payments</div>
        </Card>
      </div>

      {/* Payment List */}
      <Card className="card-premium p-6">
        <h3 className="text-xl font-semibold mb-6">Payment Status</h3>

        {pendingPayments.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-50 text-success" />
            <p>All payments are up to date!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingPayments.map((booking) => (
              <div
                key={booking.id}
                className="p-4 rounded-lg border border-primary/10 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 
                      className="font-semibold cursor-pointer hover:text-primary transition-colors"
                      onClick={() => handleVehicleClick(booking.vehicle_id)}
                    >
                      {booking.vehicle?.name}
                    </h4>
                    <p className="text-sm text-muted-foreground">{booking.customer_name}</p>
                  </div>
                  {getPaymentStatusBadge(booking)}
                </div>

                <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
                  <div>
                    <div className="text-muted-foreground">Total Amount</div>
                    <div className="font-medium">${Number(booking.total_value).toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Paid</div>
                    <div className="font-medium text-success">${booking.totalPaid.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Balance Due</div>
                    <div className="font-medium text-destructive">
                      ${(Number(booking.total_value) - booking.totalPaid).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Pickup Date</div>
                    <div className="font-medium">{new Date(booking.start_date).toLocaleDateString()}</div>
                  </div>
                </div>

                <div className="flex gap-2">
                  {!booking.depositPaid && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRecordPayment(booking)}
                      className="flex-1"
                    >
                      <DollarSign className="w-4 h-4 mr-2" />
                      Collect Deposit
                    </Button>
                  )}
                  {booking.depositPaid && !booking.balancePaid && (
                    <Button
                      size="sm"
                      onClick={() => handleRecordPayment(booking)}
                      className="flex-1 btn-premium"
                    >
                      <DollarSign className="w-4 h-4 mr-2" />
                      Collect Balance
                    </Button>
                  )}
                  {booking.security_deposit_status === 'held' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRecordPayment(booking)}
                      className="flex-1"
                    >
                      Release Security Deposit
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {selectedBooking && (
        <RecordPaymentDialog
          open={showRecordPayment}
          onOpenChange={setShowRecordPayment}
          booking={selectedBooking}
          onSubmit={createPayment}
        />
      )}
    </div>
    </>
  );
};
