import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

import { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTeam } from "@/contexts/TeamContext";
import { DollarSign, CreditCard, Loader2, ExternalLink, ChevronDown, Plus, Trash2, Gauge, Receipt, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { calculateBookingTotal, getGasFeeForTeam } from "@/lib/pricingUtils";
import { useTeamGasFeeSettings } from '@/hooks/useTeamGasFeeSettings';

type Booking = Database['public']['Tables']['bookings']['Row'];
type Payment = Database['public']['Tables']['payments']['Row'];

interface Adjustment {
  id: string;
  type: string;
  description: string;
  amount: number;
}

interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: Booking;
  onSubmit: (payment: Omit<Database['public']['Tables']['payments']['Insert'], 'user_id'>) => Promise<void>;
}

const ADJUSTMENT_TYPES = [
  { value: "toll_fee", label: "Toll Fee" },
  { value: "fuel_charge", label: "Fuel Charge" },
  { value: "late_return", label: "Late Return Fee" },
  { value: "mileage_overage", label: "Mileage Overage" },
  { value: "cleaning_fee", label: "Cleaning Fee" },
  { value: "custom", label: "Custom / Other" },
];

const DISCOUNT_REASONS = [
  { value: "promotional", label: "Promotional" },
  { value: "military", label: "Military Discount" },
  { value: "employee", label: "Employee" },
  { value: "friends_family", label: "Friends and Family" },
  { value: "loyalty", label: "Loyalty / Repeat Customer" },
  { value: "manager_override", label: "Manager Override" },
  { value: "custom", label: "Custom" },
];

export const RecordPaymentDialog = ({
  open,
  onOpenChange,
  booking,
  onSubmit,
}: RecordPaymentDialogProps) => {
  const { toast } = useToast();
  const { currentTeam } = useTeam();
  const gasFeeSettings = useTeamGasFeeSettings();
  const teamGasFee = getGasFeeForTeam(gasFeeSettings.gasFeeAmount);
  const [loading, setLoading] = useState(false);
  const [existingPayments, setExistingPayments] = useState<Payment[]>([]);
  const [adjustmentsOpen, setAdjustmentsOpen] = useState(false);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountReason, setDiscountReason] = useState("");
  const [gasFeeWaived, setGasFeeWaived] = useState<boolean>((booking as any).gas_fee_waived ?? false);
  const [manualOverride, setManualOverride] = useState(false);
  const [formData, setFormData] = useState({
    payment_type: "deposit",
    amount: booking.deposit_amount || 0,
    payment_method: "card",
    notes: "",
  });

  // Reset gas fee waived state when booking changes
  useEffect(() => {
    setGasFeeWaived((booking as any).gas_fee_waived ?? false);
  }, [booking]);

  // Fetch existing payments for this booking
  useEffect(() => {
    if (!open || !booking.id) return;
    const fetchPayments = async () => {
      const { data } = await supabase
        .from("payments")
        .select("*")
        .eq("booking_id", booking.id)
        .eq("payment_status", "completed");
      setExistingPayments(data || []);
    };
    fetchPayments();
  }, [open, booking.id]);

  // Financial calculations using centralized pricing — uses local gasFeeWaived state
  const financials = useMemo(() => {
    const pricing = calculateBookingTotal({
      startDate: booking.start_date,
      endDate: booking.end_date,
      dailyRate: Number(booking.daily_rate),
      discountAmount: Number(booking.discount_amount) || 0,
      gasFee: Number((booking as any).gas_fee) || teamGasFee,
      gasFeeWaived: gasFeeWaived,
      deliveryFee: Number(booking.delivery_fee) || 0,
      durationType: (booking as any).rental_duration_type || 'daily',
    });
    
    const depositsPaid = existingPayments
      .filter(p => p.payment_type === "deposit")
      .reduce((sum, p) => sum + Number(p.amount), 0);
    const balancePayments = existingPayments
      .filter(p => p.payment_type === "balance")
      .reduce((sum, p) => sum + Number(p.amount), 0);
    const totalPaid = existingPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    
    const securityDeposit = Number(booking.security_deposit_amount) || 0;
    const securityStatus = booking.security_deposit_status || "none";
    
    // Mileage calculation
    const pickupOdo = Number(booking.pickup_odometer) || 0;
    const returnOdo = Number(booking.return_odometer) || 0;
    const mileageLimit = Number(booking.mileage_limit) || 0;
    const mileageRate = Number(booking.mileage_overage_fee) || 0.50;
    const milesDriven = returnOdo > 0 && pickupOdo > 0 ? returnOdo - pickupOdo : 0;
    const mileageOverage = Math.max(0, milesDriven - mileageLimit);
    const mileageCharge = mileageOverage * mileageRate;
    
    const balanceRemaining = pricing.grandTotal - totalPaid;

    return {
      ...pricing,
      depositsPaid,
      balancePayments,
      totalPaid,
      securityDeposit,
      securityStatus,
      pickupOdo,
      returnOdo,
      mileageLimit,
      mileageRate,
      milesDriven,
      mileageOverage,
      mileageCharge,
      balanceRemaining,
    };
  }, [booking, existingPayments, gasFeeWaived]);

  // Total adjustments
  const adjustmentsTotal = useMemo(() => {
    return adjustments.reduce((sum, a) => sum + a.amount, 0);
  }, [adjustments]);

  // Compute the auto-calculated amount based on payment type, adjustments, and discount
  const computedAmount = useMemo(() => {
    let base = 0;
    if (formData.payment_type === "deposit") {
      base = Number(booking.deposit_amount) || 0;
    } else if (formData.payment_type === "balance") {
      base = Math.max(0, financials.balanceRemaining + adjustmentsTotal);
    } else if (formData.payment_type === "security_deposit") {
      base = Number(booking.security_deposit_amount) || 0;
    } else if (formData.payment_type === "overage_fee" || formData.payment_type === "damage_fee") {
      base = adjustmentsTotal;
    }
    return Math.max(0, base - discountAmount);
  }, [formData.payment_type, booking, financials.balanceRemaining, adjustmentsTotal, discountAmount]);

  // Auto-sync amount field when computed amount changes (unless manually overridden)
  useEffect(() => {
    if (!manualOverride) {
      setFormData(prev => ({ ...prev, amount: computedAmount }));
    }
  }, [computedAmount, manualOverride]);

  const handlePaymentTypeChange = (type: string) => {
    setManualOverride(false);
    setFormData(prev => ({ ...prev, payment_type: type }));
  };

  const handleAmountManualChange = (value: number) => {
    setManualOverride(true);
    setFormData(prev => ({ ...prev, amount: value }));
  };

  const addAdjustment = () => {
    setManualOverride(false);
    setAdjustments(prev => [...prev, {
      id: crypto.randomUUID(),
      type: "custom",
      description: "",
      amount: 0,
    }]);
  };

  const updateAdjustment = (id: string, field: keyof Adjustment, value: any) => {
    setManualOverride(false);
    setAdjustments(prev => prev.map(a => {
      if (a.id !== id) return a;
      const updated = { ...a, [field]: value };
      if (field === "type" && value === "mileage_overage" && financials.mileageCharge > 0) {
        updated.amount = financials.mileageCharge;
        updated.description = `${financials.mileageOverage} miles over limit @ $${financials.mileageRate}/mi`;
      }
      return updated;
    }));
  };

  const removeAdjustment = (id: string) => {
    setManualOverride(false);
    setAdjustments(prev => prev.filter(a => a.id !== id));
  };

  const handleDiscountChange = (value: number) => {
    setManualOverride(false);
    setDiscountAmount(value);
  };

  const handleStripeCheckout = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-payment-checkout', {
        body: {
          booking_id: booking.id,
          customer_id: booking.customer_id,
          customer_email: booking.customer_email,
          customer_name: booking.customer_name,
          amount: formData.amount,
          payment_type: formData.payment_type,
          description: formData.notes || `${formData.payment_type} payment for ${booking.customer_name}`,
        },
      });
      if (error) throw error;
      if (data?.url) {
        toast({ title: "Redirecting to Stripe", description: "Opening Stripe Checkout in a new tab..." });
        window.open(data.url, '_blank');
        onOpenChange(false);
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (error) {
      console.error("Stripe checkout error:", error);
      toast({ title: "Payment Error", description: error instanceof Error ? error.message : "Failed to create checkout session", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleManualPayment = async () => {
    if (formData.amount <= 0) return;
    setLoading(true);
    try {
      // Persist gas fee waiver change to booking if it changed
      const bookingGasFeeWaived = (booking as any).gas_fee_waived ?? false;
      if (gasFeeWaived !== bookingGasFeeWaived) {
        await supabase
          .from("bookings")
          .update({
            gas_fee_waived: gasFeeWaived,
            total_value: financials.grandTotal,
          })
          .eq("id", booking.id);
      }

      // Build structured notes with adjustments and discount
      const notesObj: Record<string, any> = {};
      if (formData.notes) notesObj.note = formData.notes;
      if (adjustments.length > 0) {
        notesObj.adjustments = adjustments.map(a => ({ type: a.type, description: a.description, amount: a.amount }));
      }
      if (discountAmount > 0) {
        notesObj.discount = { amount: discountAmount, reason: discountReason || "No reason provided" };
      }
      const notesData = Object.keys(notesObj).length > 0 ? JSON.stringify(notesObj) : formData.notes || null;

      await onSubmit({
        booking_id: booking.id,
        customer_id: booking.customer_id || null,
        amount: formData.amount,
        payment_type: formData.payment_type,
        payment_method: formData.payment_method,
        payment_status: "completed",
        notes: notesData,
        transaction_date: new Date().toISOString(),
      });
      onOpenChange(false);
    } catch (error) {
      console.error("Manual payment error:", error);
      toast({ title: "Payment Error", description: error instanceof Error ? error.message : "Failed to record payment", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const isStripePayment = formData.payment_method === "stripe";

  const PAYMENT_METHOD_LABELS: Record<string, string> = {
    stripe: "Stripe Checkout",
    cash: "Cash",
    bank_transfer: "Bank Transfer",
    credit_card: "Credit/Debit Card (Manual)",
    zelle: "Zelle",
    venmo: "Venmo",
    paypal: "PayPal",
    wire: "Wire Transfer",
    card: "Credit/Debit Card (Manual)",
    other: "Other",
  };

  const acceptedMethods = (() => {
    const settings = (currentTeam as any)?.settings as Record<string, any> | null;
    const saved = settings?.accepted_payment_methods;
    if (Array.isArray(saved) && saved.length > 0) {
      return ["stripe", ...saved];
    }
    return ["stripe", "card", "cash", "wire"];
  })();

  const rawGasFee = Number((booking as any).gas_fee) || DEFAULT_GAS_FEE;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Collect Payment
          </DialogTitle>
          <DialogDescription>
            {isStripePayment
              ? "Process payment via Stripe Checkout"
              : `Record a payment for ${booking.customer_name}`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto max-h-[calc(90vh-12rem)]">
          <div className="space-y-4 py-4 pr-1">
            {/* Financial Summary */}
            <div className="rounded-lg border border-border bg-muted/20 overflow-hidden">
              <div className="px-4 py-3 bg-muted/40 border-b border-border">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-primary" />
                  Booking Financial Summary
                </h4>
              </div>
              <div className="px-4 py-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Rental ({financials.rentalDays} days × ${Number(booking.daily_rate).toLocaleString()})</span>
                  <span className="font-medium">${financials.rentalSubtotal.toLocaleString()}</span>
                </div>
                {financials.discountAmount > 0 && (
                  <div className="flex justify-between text-success">
                    <span>Discount {booking.discount_reason && `(${booking.discount_reason})`}</span>
                    <span>-${financials.discountAmount.toLocaleString()}</span>
                  </div>
                )}
                {/* Gas Fee with toggle */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Gas/Re-fueling Fee</span>
                    <Switch
                      checked={!gasFeeWaived}
                      onCheckedChange={(checked) => {
                        setGasFeeWaived(!checked);
                        setManualOverride(false);
                      }}
                      className="h-4 w-8 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input [&>span]:h-3 [&>span]:w-3 [&>span]:data-[state=checked]:translate-x-4"
                    />
                  </div>
                  <span className={cn("font-medium", gasFeeWaived && "line-through text-muted-foreground")}>
                    ${rawGasFee.toFixed(2)}
                    {gasFeeWaived && <span className="ml-1 text-xs no-underline">(waived)</span>}
                  </span>
                </div>
                {financials.deliveryFee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Delivery Fee</span>
                    <span className="font-medium">${financials.deliveryFee.toLocaleString()}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-semibold">
                  <span>Booking Total</span>
                  <span>${financials.grandTotal.toLocaleString()}</span>
                </div>

                {/* Payments received */}
                {financials.totalPaid > 0 && (
                  <>
                    <Separator />
                    {financials.depositsPaid > 0 && (
                      <div className="flex justify-between text-success">
                        <span>Deposits Received</span>
                        <span>-${financials.depositsPaid.toLocaleString()}</span>
                      </div>
                    )}
                    {financials.balancePayments > 0 && (
                      <div className="flex justify-between text-success">
                        <span>Balance Payments</span>
                        <span>-${financials.balancePayments.toLocaleString()}</span>
                      </div>
                    )}
                  </>
                )}

                {/* Security deposit */}
                {financials.securityDeposit > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground flex items-center gap-1">
                      Security Deposit
                      <Badge variant="outline" className="text-[10px] capitalize">{financials.securityStatus}</Badge>
                    </span>
                    <span className="font-medium">${financials.securityDeposit.toLocaleString()}</span>
                  </div>
                )}

                {/* Mileage info */}
                {financials.milesDriven > 0 && (
                  <>
                    <Separator />
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Gauge className="h-3 w-3" />
                        Miles Driven
                      </span>
                      <span>{financials.milesDriven.toLocaleString()} mi</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Included Miles</span>
                      <span>{financials.mileageLimit.toLocaleString()} mi</span>
                    </div>
                    {financials.mileageOverage > 0 && (
                      <div className="flex justify-between items-center text-warning font-medium">
                        <span>Overage ({financials.mileageOverage} mi × ${financials.mileageRate}/mi)</span>
                        <span>${financials.mileageCharge.toFixed(2)}</span>
                      </div>
                    )}
                  </>
                )}

                <Separator />
                <div className={cn(
                  "flex justify-between font-bold text-base",
                  financials.balanceRemaining > 0 ? "text-warning" : "text-success"
                )}>
                  <span>Balance Remaining</span>
                  <span>${Math.max(0, financials.balanceRemaining).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <Label>Payment Method *</Label>
              <Select value={formData.payment_method} onValueChange={(value) => setFormData({ ...formData, payment_method: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {acceptedMethods.map(method => (
                    <SelectItem key={method} value={method}>
                      {method === "stripe" ? (
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-primary" />
                          Stripe Checkout
                        </div>
                      ) : (
                        PAYMENT_METHOD_LABELS[method] || method
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isStripePayment && (
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-sm">
                <div className="flex items-start gap-2">
                  <CreditCard className="w-4 h-4 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium text-primary">Stripe Checkout</p>
                    <p className="text-muted-foreground text-xs mt-1">Customer will be redirected to Stripe's secure checkout page.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Payment Type */}
            <div className="space-y-2">
              <Label>Payment Type *</Label>
              <Select value={formData.payment_type} onValueChange={handlePaymentTypeChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deposit">Deposit</SelectItem>
                  <SelectItem value="balance">Balance</SelectItem>
                  <SelectItem value="security_deposit">Security Deposit</SelectItem>
                  <SelectItem value="security_deposit_hold">Place Authorization Hold</SelectItem>
                  <SelectItem value="overage_fee">Overage Fee</SelectItem>
                  <SelectItem value="damage_fee">Damage Fee</SelectItem>
                </SelectContent>
              </Select>
              {formData.payment_type === "security_deposit_hold" && (
                <p className="text-xs text-muted-foreground">
                  Places a temporary hold on the customer's card without charging. Hold expires after 7 days. 
                  You can capture (charge) or release it later.
                </p>
              )}
            </div>

            {/* Adjustments Section */}
            <Collapsible open={adjustmentsOpen} onOpenChange={setAdjustmentsOpen}>
              <CollapsibleTrigger asChild>
                <button className="w-full p-3 rounded-lg border border-border bg-muted/10 flex items-center justify-between hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Add Charges / Adjustments</span>
                    {adjustmentsTotal > 0 && (
                      <Badge variant="secondary" className="text-xs">+${adjustmentsTotal.toFixed(2)}</Badge>
                    )}
                  </div>
                  <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", adjustmentsOpen && "rotate-180")} />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="pt-3 space-y-3">
                  {adjustments.map((adj) => (
                    <div key={adj.id} className="flex gap-2 items-start p-3 rounded-lg bg-muted/20 border border-border">
                      <div className="flex-1 space-y-2">
                        <Select value={adj.type} onValueChange={(v) => updateAdjustment(adj.id, "type", v)}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ADJUSTMENT_TYPES.map(t => (
                              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          placeholder="Description..."
                          value={adj.description}
                          onChange={(e) => updateAdjustment(adj.id, "description", e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">$</span>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={adj.amount || ""}
                          onChange={(e) => updateAdjustment(adj.id, "amount", parseFloat(e.target.value) || 0)}
                          onWheel={(e) => e.currentTarget.blur()}
                          className="h-8 w-20 text-xs"
                        />
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeAdjustment(adj.id)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="w-full" onClick={addAdjustment}>
                    <Plus className="h-3 w-3 mr-1" /> Add Line Item
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Payment Discount */}
            <div className="rounded-lg border border-border bg-muted/10 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Payment Discount</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Discount Amount ($)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={discountAmount || ""}
                      onChange={(e) => handleDiscountChange(parseFloat(e.target.value) || 0)}
                      onWheel={(e) => e.currentTarget.blur()}
                      className="h-8 pl-7 text-xs"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Reason</Label>
                  <Select value={discountReason} onValueChange={setDiscountReason}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select reason..." />
                    </SelectTrigger>
                    <SelectContent>
                      {DISCOUNT_REASONS.map(r => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {discountAmount > 0 && (
                <p className="text-xs text-success">
                  -${discountAmount.toFixed(2)} discount applied
                </p>
              )}
            </div>

            <Separator />

            {/* Amount */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Amount *</Label>
                {manualOverride && (
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => setManualOverride(false)}
                  >
                    Reset to auto
                  </button>
                )}
              </div>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={formData.amount || ""}
                  onChange={(e) => handleAmountManualChange(parseFloat(e.target.value) || 0)}
                  onWheel={(e) => e.currentTarget.blur()}
                  className="pl-10"
                />
              </div>
              {!manualOverride && (
                <p className="text-xs text-muted-foreground">
                  Auto-calculated from {formData.payment_type.replace(/_/g, ' ')}
                  {adjustmentsTotal > 0 && ` + $${adjustmentsTotal.toFixed(2)} adjustments`}
                  {discountAmount > 0 && ` - $${discountAmount.toFixed(2)} discount`}
                </p>
              )}
              {manualOverride && (
                <p className="text-xs text-warning">Manual override — amount won't auto-update</p>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes / Description</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Add any additional notes..."
                className="h-16"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {isStripePayment ? (
            <Button onClick={handleStripeCheckout} disabled={loading || formData.amount <= 0} className="btn-premium">
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</>
              ) : (
                <><ExternalLink className="w-4 h-4 mr-2" />Pay ${formData.amount.toFixed(2)} with Stripe</>
              )}
            </Button>
          ) : (
            <Button type="button" disabled={loading || formData.amount <= 0} className="btn-premium" onClick={handleManualPayment}>
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
              ) : (
                `Record $${formData.amount.toFixed(2)} Payment`
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
