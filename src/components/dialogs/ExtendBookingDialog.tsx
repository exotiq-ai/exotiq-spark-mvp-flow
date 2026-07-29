import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CalendarIcon, Loader2, CreditCard, ClipboardList, AlertTriangle } from "lucide-react";
import { format, addDays, differenceInCalendarDays, startOfDay } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useMoney } from "@/hooks/useMoney";
import { cn } from "@/lib/utils";

interface ExtendBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: {
    id: string;
    booking_ref?: string | null;
    end_date: string;
    total_value?: number | null;
    operator_payment_intent_id?: string | null;
    platform_fee_cents?: number | null;
    protection_tier?: string | null;
    protection_total_cents?: number | null;
  } | null;
  vehicleName?: string;
  defaultRatePerDay: number; // dollars/day
  onExtended?: () => void;
}

const STATE_FEE_CENTS_PER_DAY = 589;

// Mirrors public_vehicle_quote / rent-extend-booking.
function protectionDailyCentsForTier(tier: string | null | undefined): number {
  switch ((tier ?? "premium").toLowerCase()) {
    case "premium":
      return 28900;
    case "standard":
      return 8900;
    default:
      return 0;
  }
}


export function ExtendBookingDialog({
  open,
  onOpenChange,
  booking,
  vehicleName,
  defaultRatePerDay,
  onExtended,
}: ExtendBookingDialogProps) {
  const { toast } = useToast();
  const { money: fmt } = useMoney();

  const currentEnd = booking ? new Date(booking.end_date) : new Date();
  const [newEndDate, setNewEndDate] = useState<Date | undefined>(() => addDays(currentEnd, 1));
  const [ratePerDay, setRatePerDay] = useState<string>(String(defaultRatePerDay || 0));
  const hasSavedCard = Boolean(booking?.operator_payment_intent_id);
  const [chargeMethod, setChargeMethod] = useState<"card_on_file" | "manual">(
    hasSavedCard ? "card_on_file" : "manual",
  );
  const [submitting, setSubmitting] = useState(false);

  const addedDays = useMemo(() => {
    if (!newEndDate) return 0;
    return Math.max(0, differenceInCalendarDays(startOfDay(newEndDate), startOfDay(currentEnd)));
  }, [newEndDate, currentEnd]);

  const rateNum = Math.max(0, Number(ratePerDay) || 0);
  const addedSubtotal = rateNum * addedDays;
  const addedStateFee = (STATE_FEE_CENTS_PER_DAY * addedDays) / 100;
  const addedProcessingFee = estimateProcessingFeeCents(Math.round(addedSubtotal * 100)) / 100;
  const addedTotal = addedSubtotal + addedStateFee + addedProcessingFee;

  const canSubmit = addedDays > 0 && rateNum > 0 && !submitting;

  const handleSubmit = async () => {
    if (!booking || !newEndDate) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("rent-extend-booking", {
        body: {
          booking_id: booking.id,
          new_end_date: newEndDate.toISOString(),
          rate_cents_per_day: Math.round(rateNum * 100),
          charge_method: chargeMethod,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      toast({
        title: chargeMethod === "card_on_file" ? "Card charged, booking extended" : "Booking extended",
        description:
          chargeMethod === "card_on_file"
            ? `+${addedDays} day${addedDays === 1 ? "" : "s"} · ${fmt(addedTotal)} charged to the card on file.`
            : `+${addedDays} day${addedDays === 1 ? "" : "s"} · record ${fmt(addedTotal)} in payments to reconcile.`,
      });
      onExtended?.();
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Could not extend booking", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Extend booking{booking?.booking_ref ? ` · ${booking.booking_ref}` : ""}</DialogTitle>
          <DialogDescription>
            {vehicleName ? `${vehicleName} · ` : ""}Current return: {format(currentEnd, "MMM d, yyyy")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>New return date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !newEndDate && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {newEndDate ? format(newEndDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 z-[60]" align="start">
                <Calendar
                  mode="single"
                  selected={newEndDate}
                  onSelect={setNewEndDate}
                  disabled={(d) => d <= currentEnd}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ext-rate">Rate for extended days ($/day)</Label>
            <Input
              id="ext-rate"
              type="number"
              min={0}
              step="0.01"
              value={ratePerDay}
              onChange={(e) => setRatePerDay(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Pre-filled from the original booking. Edit to match what you agreed with the customer.
            </p>
          </div>

          {addedDays > 0 && rateNum > 0 && (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Added days</span>
                <span className="font-medium">{addedDays}</span>
              </div>
              <div className="space-y-1 pt-1 border-t">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">To operator</div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Rental ({addedDays} × {fmt(rateNum)})</span>
                  <span>{fmt(addedSubtotal)}</span>
                </div>
              </div>
              <div className="space-y-1 pt-1 border-t">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Fees</div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">State rental fee</span>
                  <span>{fmt(addedStateFee)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Processing fee (est.)</span>
                  <span>{fmt(addedProcessingFee)}</span>
                </div>
              </div>
              <div className="flex justify-between pt-1.5 border-t font-semibold">

                <span>Balance due</span>
                <span>{fmt(addedTotal)}</span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Charge method</Label>
            <RadioGroup value={chargeMethod} onValueChange={(v) => setChargeMethod(v as any)}>
              <div className="flex items-start gap-2 rounded-md border p-3">
                <RadioGroupItem value="card_on_file" id="card_on_file" disabled={!hasSavedCard} className="mt-1" />
                <Label htmlFor="card_on_file" className={cn("flex-1 cursor-pointer", !hasSavedCard && "opacity-50")}>
                  <div className="flex items-center gap-2 font-medium">
                    <CreditCard className="h-4 w-4" />
                    Charge card on file now
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {hasSavedCard
                      ? "Off-session charge to the renter's saved card. Dates only move if the charge settles."
                      : "Not available — this booking has no card on file (direct booking)."}
                  </p>
                </Label>
              </div>
              <div className="flex items-start gap-2 rounded-md border p-3">
                <RadioGroupItem value="manual" id="manual" className="mt-1" />
                <Label htmlFor="manual" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2 font-medium">
                    <ClipboardList className="h-4 w-4" />
                    Mark as balance owed
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Extends the booking now. Record the payment in the Payments tab once collected.
                  </p>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {chargeMethod === "card_on_file" && hasSavedCard && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Card will be charged immediately. If the charge fails (declined, 3DS required), the booking is
                not extended and you can fall back to "balance owed".
              </AlertDescription>
            </Alert>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {chargeMethod === "card_on_file" ? `Charge ${fmt(addedTotal)} & extend` : "Extend booking"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
