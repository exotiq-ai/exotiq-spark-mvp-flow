import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useFleet } from "@/contexts/FleetContext";
import {
  Gauge,
  Fuel,
  Camera,
  Calendar,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Car,
  User,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type { Database } from "@/integrations/supabase/types";

type Booking = Database["public"]["Tables"]["bookings"]["Row"];

interface CheckInOutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: Booking;
  mode: "check-out" | "check-in";
  onComplete?: () => void;
  onCollectPayment?: () => void;
}

export const CheckInOutDialog = ({
  open,
  onOpenChange,
  booking,
  mode,
  onComplete,
  onCollectPayment,
}: CheckInOutDialogProps) => {
  const { toast } = useToast();
  const { vehicles, refreshData } = useFleet();
  const vehicle = vehicles.find((v) => v.id === booking.vehicle_id);

  const [odometer, setOdometer] = useState<string>(
    mode === "check-in" && booking.return_odometer
      ? String(booking.return_odometer)
      : mode === "check-out" && booking.pickup_odometer
      ? String(booking.pickup_odometer)
      : ""
  );
  const [fuelLevel, setFuelLevel] = useState<number[]>([
    mode === "check-in"
      ? booking.return_fuel_level ?? 100
      : booking.pickup_fuel_level ?? 100,
  ]);
  const [conditionNotes, setConditionNotes] = useState("");
  const [hasDamage, setHasDamage] = useState(false);
  const [manualDate, setManualDate] = useState(false);
  const [dateOverride, setDateOverride] = useState("");
  const [loading, setLoading] = useState(false);

  const isCheckIn = mode === "check-in";
  const title = isCheckIn ? "Check In Vehicle" : "Check Out Vehicle";

  // Mileage calculations for check-in
  const mileageInfo = useMemo(() => {
    if (!isCheckIn || !booking.pickup_odometer) return null;
    const returnOdo = Number(odometer) || 0;
    const pickupOdo = Number(booking.pickup_odometer) || 0;
    if (returnOdo <= 0) return null;

    const milesDriven = returnOdo - pickupOdo;
    const included = Number(booking.mileage_limit) || 0;
    const overage = Math.max(0, milesDriven - included);
    const rate = Number(booking.mileage_overage_fee) || 0.5;
    const charge = overage * rate;

    return { milesDriven, included, overage, rate, charge };
  }, [isCheckIn, odometer, booking]);

  const handleSubmit = async () => {
    const odoValue = Number(odometer);
    if (!odoValue || odoValue <= 0) {
      toast({ title: "Odometer reading is required", variant: "destructive" });
      return;
    }

    // Validate check-in odometer > pickup odometer
    if (isCheckIn && booking.pickup_odometer && odoValue < booking.pickup_odometer) {
      toast({
        title: "Invalid odometer",
        description: "Return odometer must be greater than pickup odometer",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const timestamp = manualDate && dateOverride
        ? new Date(dateOverride).toISOString()
        : new Date().toISOString();

      if (isCheckIn) {
        // Update booking: return_odometer, return_fuel_level, status -> completed
        const { error: bookingError } = await supabase
          .from("bookings")
          .update({
            return_odometer: odoValue,
            return_fuel_level: fuelLevel[0],
            status: "completed",
            notes: conditionNotes
              ? `${booking.notes || ""}\n[Check-in ${format(new Date(timestamp), "MMM d, yyyy h:mm a")}]: ${conditionNotes}`.trim()
              : booking.notes,
            updated_at: timestamp,
          })
          .eq("id", booking.id);

        if (bookingError) throw bookingError;

        // Update vehicle mileage
        if (booking.vehicle_id) {
          await supabase
            .from("vehicles")
            .update({ mileage: odoValue })
            .eq("id", booking.vehicle_id);
        }

        toast({ title: "Vehicle Checked In", description: `${vehicle?.name || "Vehicle"} returned successfully` });

        // Prompt for payment if balance due
        const balanceDue = Number(booking.balance_due) || 0;
        if (balanceDue > 0 || (mileageInfo && mileageInfo.charge > 0)) {
          onCollectPayment?.();
        }
      } else {
        // Check-out: update booking with pickup data, status -> active
        const { error: bookingError } = await supabase
          .from("bookings")
          .update({
            pickup_odometer: odoValue,
            pickup_fuel_level: fuelLevel[0],
            status: "active",
            notes: conditionNotes
              ? `${booking.notes || ""}\n[Check-out ${format(new Date(timestamp), "MMM d, yyyy h:mm a")}]: ${conditionNotes}`.trim()
              : booking.notes,
            updated_at: timestamp,
          })
          .eq("id", booking.id);

        if (bookingError) throw bookingError;

        // Update vehicle mileage
        if (booking.vehicle_id) {
          await supabase
            .from("vehicles")
            .update({ mileage: odoValue, status: "booked" })
            .eq("id", booking.vehicle_id);
        }

        toast({ title: "Vehicle Checked Out", description: `${vehicle?.name || "Vehicle"} is now with the renter` });
      }

      await refreshData(true);
      onComplete?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Check-in/out error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isCheckIn ? (
              <CheckCircle2 className="h-5 w-5 text-success" />
            ) : (
              <Car className="h-5 w-5 text-primary" />
            )}
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {/* Booking Info Banner */}
          <div className="p-3 rounded-lg bg-muted/30 border border-border">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Car className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-muted-foreground text-xs">Vehicle</div>
                  <div className="font-medium">{vehicle?.name || booking.vehicle_name || "N/A"}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-muted-foreground text-xs">Customer</div>
                  <div className="font-medium">{booking.customer_name}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-muted-foreground text-xs">Period</div>
                  <div className="font-medium text-xs">
                    {format(new Date(booking.start_date), "MMM d")} — {format(new Date(booking.end_date), "MMM d, yyyy")}
                  </div>
                </div>
              </div>
              {isCheckIn && booking.pickup_odometer && (
                <div className="flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-muted-foreground text-xs">Pickup Odometer</div>
                    <div className="font-medium">{Number(booking.pickup_odometer).toLocaleString()} mi</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Odometer Reading */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Gauge className="h-4 w-4" />
              Odometer Reading (miles) *
            </Label>
            <Input
              type="number"
              placeholder="e.g., 45230"
              value={odometer}
              onChange={(e) => setOdometer(e.target.value)}
              className="text-lg font-mono"
              min="0"
            />
          </div>

          {/* Fuel Level */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Fuel className="h-4 w-4" />
              Fuel Level: {fuelLevel[0]}%
            </Label>
            <Slider
              value={fuelLevel}
              onValueChange={setFuelLevel}
              max={100}
              min={0}
              step={5}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Empty</span>
              <span>¼</span>
              <span>½</span>
              <span>¾</span>
              <span>Full</span>
            </div>
          </div>

          {/* Mileage overage summary (check-in only) */}
          {isCheckIn && mileageInfo && mileageInfo.milesDriven > 0 && (
            <div className={cn(
              "p-3 rounded-lg border text-sm space-y-1",
              mileageInfo.overage > 0
                ? "bg-warning/10 border-warning/30"
                : "bg-success/10 border-success/30"
            )}>
              <div className="flex justify-between">
                <span>Miles Driven</span>
                <span className="font-medium">{mileageInfo.milesDriven.toLocaleString()} mi</span>
              </div>
              <div className="flex justify-between">
                <span>Included</span>
                <span>{mileageInfo.included.toLocaleString()} mi</span>
              </div>
              {mileageInfo.overage > 0 && (
                <>
                  <Separator />
                  <div className="flex justify-between font-semibold text-warning">
                    <span>Overage ({mileageInfo.overage} mi × ${mileageInfo.rate}/mi)</span>
                    <span>${mileageInfo.charge.toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Condition Notes */}
          <div className="space-y-2">
            <Label>Condition Notes (optional)</Label>
            <Textarea
              value={conditionNotes}
              onChange={(e) => setConditionNotes(e.target.value)}
              placeholder="Any observations about the vehicle condition..."
              className="h-16"
            />
          </div>

          {/* Damage flag (check-in) */}
          {isCheckIn && (
            <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/10">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <span className="text-sm font-medium">Any new damage?</span>
              </div>
              <Switch checked={hasDamage} onCheckedChange={setHasDamage} />
            </div>
          )}

          {hasDamage && (
            <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 text-sm text-warning">
              A damage claim will need to be filed after check-in. You'll be prompted after completing this step.
            </div>
          )}

          {/* Historical date override */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/10">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Set date manually (historical)</span>
            </div>
            <Switch checked={manualDate} onCheckedChange={setManualDate} />
          </div>

          {manualDate && (
            <Input
              type="datetime-local"
              value={dateOverride}
              onChange={(e) => setDateOverride(e.target.value)}
            />
          )}
        </div>

        <DialogFooter className="flex-shrink-0 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !odometer}
            className={isCheckIn ? "bg-success hover:bg-success/90 text-success-foreground" : ""}
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</>
            ) : isCheckIn ? (
              <><CheckCircle2 className="w-4 h-4 mr-2" />Complete Check-In</>
            ) : (
              <><Car className="w-4 h-4 mr-2" />Complete Check-Out</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
