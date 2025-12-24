import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DollarSign, CreditCard, Loader2, ExternalLink } from "lucide-react";

type Booking = Database['public']['Tables']['bookings']['Row'];

interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: Booking;
  onSubmit: (payment: Omit<Database['public']['Tables']['payments']['Insert'], 'user_id'>) => Promise<void>;
}

export const RecordPaymentDialog = ({
  open,
  onOpenChange,
  booking,
}: RecordPaymentDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    payment_type: "deposit",
    amount: booking.deposit_amount || 0,
    payment_method: "card",
    notes: "",
  });

  const handlePaymentTypeChange = (type: string) => {
    let amount = 0;
    if (type === "deposit") {
      amount = Number(booking.deposit_amount) || 0;
    } else if (type === "balance") {
      amount = Number(booking.balance_due) || 0;
    } else if (type === "security_deposit") {
      amount = Number(booking.security_deposit_amount) || 0;
    }

    setFormData({ ...formData, payment_type: type, amount });
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
        toast({
          title: "Redirecting to Stripe",
          description: "Opening Stripe Checkout in a new tab...",
        });
        window.open(data.url, '_blank');
        onOpenChange(false);
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (error) {
      console.error("Stripe checkout error:", error);
      toast({
        title: "Payment Error",
        description: error instanceof Error ? error.message : "Failed to create checkout session",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const isStripePayment = formData.payment_method === "stripe";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Collect Payment</DialogTitle>
          <DialogDescription>
            {isStripePayment 
              ? "Process payment via Stripe Checkout" 
              : `Record a payment for booking ${booking.id.substring(0, 8)}...`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Booking Summary */}
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground">Customer</div>
                <div className="font-medium">{booking.customer_name}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Total Value</div>
                <div className="font-medium">${Number(booking.total_value).toLocaleString()}</div>
              </div>
              {booking.customer_email && (
                <div className="col-span-2">
                  <div className="text-muted-foreground">Email</div>
                  <div className="font-medium">{booking.customer_email}</div>
                </div>
              )}
            </div>
          </div>

          {/* Payment Method - First so user chooses flow */}
          <div className="space-y-2">
            <Label htmlFor="payment_method">Payment Method *</Label>
            <Select
              value={formData.payment_method}
              onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stripe">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-primary" />
                    Stripe Checkout
                  </div>
                </SelectItem>
                <SelectItem value="card">Credit/Debit Card (Manual)</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="wire">Wire Transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Stripe Info Banner */}
          {isStripePayment && (
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-sm">
              <div className="flex items-start gap-2">
                <CreditCard className="w-4 h-4 text-primary mt-0.5" />
                <div>
                  <p className="font-medium text-primary">Stripe Checkout</p>
                  <p className="text-muted-foreground text-xs mt-1">
                    Customer will be redirected to Stripe's secure checkout page to complete payment.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Payment Type */}
          <div className="space-y-2">
            <Label htmlFor="payment_type">Payment Type *</Label>
            <Select
              value={formData.payment_type}
              onValueChange={handlePaymentTypeChange}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="deposit">Deposit</SelectItem>
                <SelectItem value="balance">Balance</SelectItem>
                <SelectItem value="security_deposit">Security Deposit</SelectItem>
                <SelectItem value="overage_fee">Overage Fee</SelectItem>
                <SelectItem value="damage_fee">Damage Fee</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">Amount *</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="amount"
                type="number"
                min="0"
                step="0.01"
                required
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                className="pl-10"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes / Description</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Add any additional notes about this payment..."
              className="h-20"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {isStripePayment ? (
            <Button 
              onClick={handleStripeCheckout} 
              disabled={loading || formData.amount <= 0} 
              className="btn-premium"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Pay ${formData.amount.toFixed(2)} with Stripe
                </>
              )}
            </Button>
          ) : (
            <Button 
              type="button" 
              disabled={loading || formData.amount <= 0} 
              className="btn-premium"
              onClick={() => {
                toast({
                  title: "Manual Payment",
                  description: "Manual payment recording coming soon. Use Stripe for live payments.",
                });
              }}
            >
              Record Payment
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
