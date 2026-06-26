import { useState } from "react";
import { useModuleNavigation } from "@/hooks/useModuleNavigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { useGrowthCalculation } from "@/hooks/useGrowthCalculation";
import { VehicleImageDialog } from "@/components/dialogs/VehicleImageDialog";
import { 
  DollarSign, 
  Clock, 
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Loader2,
  Shield,
  ShieldCheck,
  ShieldX,
  Undo2
} from "lucide-react";
import { RecordPaymentDialog } from "@/components/dialogs/RecordPaymentDialog";
import { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Booking = Database['public']['Tables']['bookings']['Row'];

export const PaymentTracker = () => {
  const { bookings, payments, vehicles, createPayment } = useLocationFilteredFleet();
  const { goToCustomerProfile } = useModuleNavigation();
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const [showVehicleImage, setShowVehicleImage] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<{
    name: string; make: string; model: string; year: number; status: string; dailyRate: number;
  } | null>(null);

  // Hold action state
  const [holdActionLoading, setHoldActionLoading] = useState<string | null>(null);
  const [captureDialog, setCaptureDialog] = useState<{ paymentIntentId: string; maxAmount: number } | null>(null);
  const [captureAmount, setCaptureAmount] = useState(0);
  const [refundDialog, setRefundDialog] = useState<{ paymentIntentId: string; maxAmount: number } | null>(null);
  const [refundAmount, setRefundAmount] = useState(0);
  const [refundReason, setRefundReason] = useState("requested_by_customer");

  const handleVehicleClick = (vehicleId: string) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (vehicle) {
      setSelectedVehicle({
        name: vehicle.name, make: vehicle.make, model: vehicle.model,
        year: vehicle.year, status: vehicle.status, dailyRate: Number(vehicle.current_rate),
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
    const activeHold = bookingPayments.find(p => 
      (p as any).hold_status === 'authorized' && p.stripe_payment_intent_id
    );
    
    return {
      ...booking,
      vehicle,
      totalPaid,
      amountDue: Number(booking.balance_due || 0),
      depositPaid: bookingPayments.some(p => p.payment_type === 'deposit' && p.payment_status === 'completed'),
      balancePaid: totalPaid >= Number(booking.total_value || 0),
      activeHold,
    };
  });

  const pendingPayments = bookingsWithPaymentStatus.filter(
    b => (b.status === 'pending' || b.status === 'confirmed') && !b.balancePaid
  );

  const overduePayments = pendingPayments.filter(b => {
    const startDate = new Date(b.start_date);
    return startDate < new Date() && !b.depositPaid;
  });

  const totalPending = pendingPayments.reduce((sum, b) => sum + (Number(b.total_value) - b.totalPaid), 0);
  const totalOverdue = overduePayments.reduce((sum, b) => sum + (Number(b.total_value) - b.totalPaid), 0);
  
  const completedPaymentsWithDates = payments
    .filter(p => p.payment_status === 'completed')
    .map(p => ({ created_at: p.created_at, amount: Number(p.amount) }));
  const paymentGrowth = useGrowthCalculation(completedPaymentsWithDates);

  const handleRecordPayment = (booking: Booking) => {
    setSelectedBooking(booking);
    setShowRecordPayment(true);
  };

  const handleCaptureHold = async (paymentIntentId: string, amount?: number) => {
    setHoldActionLoading(paymentIntentId);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-capture-hold', {
        body: { payment_intent_id: paymentIntentId, capture_amount: amount },
      });
      if (error) throw error;
      toast.success(`Hold captured: $${data.amount_captured.toFixed(2)}`);
      setCaptureDialog(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to capture hold");
    } finally {
      setHoldActionLoading(null);
    }
  };

  const handleReleaseHold = async (paymentIntentId: string) => {
    setHoldActionLoading(paymentIntentId);
    try {
      const { error } = await supabase.functions.invoke('stripe-release-hold', {
        body: { payment_intent_id: paymentIntentId },
      });
      if (error) throw error;
      toast.success("Security deposit hold released");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to release hold");
    } finally {
      setHoldActionLoading(null);
    }
  };

  const handleRefund = async (paymentIntentId: string, amount?: number, reason?: string) => {
    setHoldActionLoading(paymentIntentId);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-create-refund', {
        body: { payment_intent_id: paymentIntentId, amount, reason },
      });
      if (error) throw error;
      toast.success(`Refund processed: $${data.amount_refunded.toFixed(2)}`);
      setRefundDialog(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to process refund");
    } finally {
      setHoldActionLoading(null);
    }
  };

  const getPaymentStatusBadge = (booking: typeof bookingsWithPaymentStatus[0]) => {
    if (booking.activeHold) {
      return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/30"><Shield className="w-3 h-3 mr-1" />Hold Active</Badge>;
    }
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

      {/* Capture Dialog */}
      <Dialog open={!!captureDialog} onOpenChange={() => setCaptureDialog(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-success" />
              Capture Hold
            </DialogTitle>
            <DialogDescription>
              Charge the customer's card for all or part of the held amount.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="space-y-1">
              <Label>Capture Amount (max ${captureDialog?.maxAmount.toFixed(2)})</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  min="0.01"
                  max={captureDialog?.maxAmount}
                  step="0.01"
                  value={captureAmount || ""}
                  onChange={(e) => setCaptureAmount(parseFloat(e.target.value) || 0)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCaptureDialog(null)}>Cancel</Button>
            <Button
              onClick={() => captureDialog && handleCaptureHold(captureDialog.paymentIntentId, captureAmount || undefined)}
              disabled={!!holdActionLoading}
            >
              {holdActionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Capture ${captureAmount > 0 ? captureAmount.toFixed(2) : captureDialog?.maxAmount.toFixed(2)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refund Dialog */}
      <Dialog open={!!refundDialog} onOpenChange={() => setRefundDialog(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Undo2 className="h-5 w-5 text-warning" />
              Issue Refund
            </DialogTitle>
            <DialogDescription>
              Refund all or part of a completed payment back to the customer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="space-y-1">
              <Label>Refund Amount (max ${refundDialog?.maxAmount.toFixed(2)})</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  min="0.01"
                  max={refundDialog?.maxAmount}
                  step="0.01"
                  value={refundAmount || ""}
                  onChange={(e) => setRefundAmount(parseFloat(e.target.value) || 0)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Reason</Label>
              <Select value={refundReason} onValueChange={setRefundReason}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="requested_by_customer">Customer Request</SelectItem>
                  <SelectItem value="duplicate">Duplicate Charge</SelectItem>
                  <SelectItem value="damage_deduction">Damage Deduction Adjustment</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundDialog(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => refundDialog && handleRefund(refundDialog.paymentIntentId, refundAmount || undefined, refundReason)}
              disabled={!!holdActionLoading}
            >
              {holdActionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Refund ${refundAmount > 0 ? refundAmount.toFixed(2) : refundDialog?.maxAmount.toFixed(2)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-6">
        {/* Payment Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="card-premium p-6">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="h-5 w-5 text-success" />
              <TrendingUp className="h-4 w-4 text-success" />
            </div>
            <div className="text-2xl font-bold">{formatCurrency(totalPending)}</div>
            <div className="text-sm text-muted-foreground">Pending Payments</div>
            <div className="text-xs text-muted-foreground mt-1">{pendingPayments.length} bookings</div>
          </Card>

          <Card className="card-premium p-6">
            <div className="flex items-center justify-between mb-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <Badge className="bg-destructive/10 text-destructive">{overduePayments.length}</Badge>
            </div>
            <div className="text-2xl font-bold text-destructive">{formatCurrency(totalOverdue)}</div>
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
                      <p className={`text-sm text-muted-foreground ${booking.customer_id ? 'cursor-pointer hover:text-primary transition-colors' : ''}`}
                        onClick={() => booking.customer_id && goToCustomerProfile(booking.customer_id)}
                      >{booking.customer_name}</p>
                    </div>
                    {getPaymentStatusBadge(booking)}
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
                    <div>
                      <div className="text-muted-foreground">Total Amount</div>
                      <div className="font-medium">{formatCurrency(Number(booking.total_value))}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Paid</div>
                      <div className="font-medium text-success">{formatCurrency(booking.totalPaid)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Balance Due</div>
                      <div className="font-medium text-destructive">
                        {formatCurrency(Number(booking.total_value) - booking.totalPaid)}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Pickup Date</div>
                      <div className="font-medium">{new Date(booking.start_date).toLocaleDateString()}</div>
                    </div>
                  </div>

                  {/* Hold info */}
                  {booking.activeHold && (
                    <div className="p-3 mb-3 rounded-lg bg-blue-500/5 border border-blue-500/20 text-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <Shield className="w-4 h-4 text-blue-600" />
                        <span className="font-medium text-blue-600">Authorization Hold Active</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(Number(booking.activeHold.amount))} held on customer's card
                        {(booking.activeHold as any).hold_expires_at && (
                          <> • Expires {new Date((booking.activeHold as any).hold_expires_at).toLocaleDateString()}</>
                        )}
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2 flex-wrap">
                    {/* Hold actions */}
                    {booking.activeHold && booking.activeHold.stripe_payment_intent_id && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => {
                            setCaptureAmount(Number(booking.activeHold!.amount));
                            setCaptureDialog({
                              paymentIntentId: booking.activeHold!.stripe_payment_intent_id!,
                              maxAmount: Number(booking.activeHold!.amount),
                            });
                          }}
                          disabled={holdActionLoading === booking.activeHold.stripe_payment_intent_id}
                          className="flex-1"
                        >
                          {holdActionLoading === booking.activeHold.stripe_payment_intent_id ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <ShieldCheck className="w-4 h-4 mr-2" />
                          )}
                          Capture Hold
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReleaseHold(booking.activeHold!.stripe_payment_intent_id!)}
                          disabled={holdActionLoading === booking.activeHold.stripe_payment_intent_id}
                          className="flex-1"
                        >
                          <ShieldX className="w-4 h-4 mr-2" />
                          Release Hold
                        </Button>
                      </>
                    )}

                    {/* Standard payment actions */}
                    {!booking.activeHold && !booking.depositPaid && (
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
                    {!booking.activeHold && booking.depositPaid && !booking.balancePaid && (
                      <Button
                        size="sm"
                        onClick={() => handleRecordPayment(booking)}
                        className="flex-1 btn-premium"
                      >
                        <DollarSign className="w-4 h-4 mr-2" />
                        Collect Balance
                      </Button>
                    )}

                    {/* Refund action for completed Stripe payments */}
                    {booking.balancePaid && payments.find(p => 
                      p.booking_id === booking.id && 
                      p.payment_status === 'completed' && 
                      p.stripe_payment_intent_id
                    ) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const stripePayment = payments.find(p => 
                            p.booking_id === booking.id && 
                            p.payment_status === 'completed' && 
                            p.stripe_payment_intent_id
                          );
                          if (stripePayment) {
                            setRefundAmount(Number(stripePayment.amount));
                            setRefundDialog({
                              paymentIntentId: stripePayment.stripe_payment_intent_id!,
                              maxAmount: Number(stripePayment.amount),
                            });
                          }
                        }}
                        className="flex-1"
                      >
                        <Undo2 className="w-4 h-4 mr-2" />
                        Issue Refund
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
