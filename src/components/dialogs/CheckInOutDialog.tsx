import { useState, useMemo, useCallback } from "react";
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
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useFleet } from "@/contexts/FleetContext";
import {
  Gauge,
  Fuel,
  Calendar,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Car,
  User,
  Clock,
  Camera,
  ChevronRight,
  ChevronLeft,
  Zap,
  Check,
  AlertCircle,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TimeInput } from "@/components/ui/time-input";
import { GuidedCaptureWizard } from "@/components/inspections/GuidedCaptureWizard";
import { InspectionChecklistForm } from "@/components/inspections/InspectionChecklistForm";
import {
  GuidedPhoto,
  DamageItem,
  InspectionChecklist,
  GUIDED_PHOTO_CONFIG,
} from "@/components/inspections/types";
import type { Database } from "@/integrations/supabase/types";

type Booking = Database["public"]["Tables"]["bookings"]["Row"];

type WizardStep = "basics" | "photos" | "checklist" | "done";

interface CheckInOutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: Booking;
  mode: "check-out" | "check-in";
  vehicleId?: string;
  vehicleName?: string;
  onComplete?: () => void;
  onCollectPayment?: () => void;
}

export const CheckInOutDialog = ({
  open,
  onOpenChange,
  booking,
  mode,
  vehicleId,
  vehicleName,
  onComplete,
  onCollectPayment,
}: CheckInOutDialogProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { vehicles, refreshData } = useFleet();
  const vehicle = vehicles.find((v) => v.id === booking.vehicle_id);
  const resolvedVehicleId = vehicleId || booking.vehicle_id || "";
  const resolvedVehicleName = vehicleName || vehicle?.name || booking.vehicle_name || "Vehicle";

  const isCheckIn = mode === "check-in";
  const title = isCheckIn ? "Check In Vehicle" : "Check Out Vehicle";

  // Wizard step state
  const [step, setStep] = useState<WizardStep>("basics");

  // Step 1: Basics
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
  const [manualDate, setManualDate] = useState(false);
  const [dateOverride, setDateOverride] = useState<Date | undefined>();
  const [timeOverride, setTimeOverride] = useState('09:00');
  // Step 2: Photos (from inspection widget)
  const initialPhotos: GuidedPhoto[] = useMemo(
    () =>
      GUIDED_PHOTO_CONFIG.map((config, index) => ({
        ...config,
        id: `photo-${index}`,
        skipped: false,
        qualityWarning: false,
      })),
    []
  );
  const [photos, setPhotos] = useState<GuidedPhoto[]>(initialPhotos);
  const [damageItems, setDamageItems] = useState<DamageItem[]>([]);

  // Step 3: Checklist
  const [checklist, setChecklist] = useState<InspectionChecklist>({
    odometerReading: null,
    fuelLevel: 100,
    keysCount: 1,
    cleanlinessRating: 5,
    exteriorCondition: "excellent",
    interiorCondition: "excellent",
    tireCondition: "good",
  });
  const [inspectorName, setInspectorName] = useState("");
  const [conditionNotes, setConditionNotes] = useState("");
  const [hasDamage, setHasDamage] = useState(false);

  const [loading, setLoading] = useState(false);

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

  // Photo handlers
  const handlePhotoCapture = useCallback((photoId: string, imageData: string) => {
    setPhotos((prev) =>
      prev.map((p) =>
        p.id === photoId
          ? { ...p, url: imageData, skipped: false, capturedAt: new Date() }
          : p
      )
    );
  }, []);

  const handlePhotoSkip = useCallback((photoId: string) => {
    setPhotos((prev) =>
      prev.map((p) => (p.id === photoId ? { ...p, skipped: true } : p))
    );
  }, []);

  const handleDamageAdd = useCallback((damage: Omit<DamageItem, "id">) => {
    setDamageItems((prev) => [...prev, { ...damage, id: `damage-${Date.now()}` }]);
  }, []);

  const handleDamageRemove = useCallback((damageId: string) => {
    setDamageItems((prev) => prev.filter((d) => d.id !== damageId));
  }, []);

  // Upload photo helper via unified photoUpload
  const uploadPhoto = async (
    imageData: string,
    folder: string,
    filename: string
  ): Promise<string | null> => {
    try {
      const response = await fetch(imageData);
      const blob = await response.blob();
      const file = new File([blob], filename, { type: 'image/jpeg' });

      const { uploadVehiclePhoto } = await import('@/lib/photoUpload');
      const result = await uploadVehiclePhoto(file, folder, user?.id || '', {
        preset: 'operational',
      });

      if (result.error) {
        console.error('Upload error:', result.error);
        return null;
      }

      return result.url;
    } catch (error) {
      console.error("Error uploading photo:", error);
      return null;
    }
  };

  const validateBasics = (): boolean => {
    const odoValue = Number(odometer);
    if (!odoValue || odoValue <= 0) {
      toast({ title: "Odometer reading is required", variant: "destructive" });
      return false;
    }
    if (isCheckIn && booking.pickup_odometer && odoValue < booking.pickup_odometer) {
      toast({
        title: "Invalid odometer",
        description: "Return odometer must be greater than pickup odometer",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  // Quick complete (skip photos/checklist)
  const handleQuickComplete = async () => {
    if (!validateBasics()) return;
    await submitAll(false);
  };

  // Full submit with inspection record
  const submitAll = async (withInspection: boolean) => {
    const odoValue = Number(odometer);
    setLoading(true);
    try {
      let timestamp: string;
      if (manualDate && dateOverride) {
        const [h, m] = timeOverride.split(':').map(Number);
        const combined = new Date(dateOverride);
        combined.setHours(h, m, 0, 0);
        timestamp = combined.toISOString();
      } else {
        timestamp = new Date().toISOString();
      }

      // --- Update booking ---
      if (isCheckIn) {
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

        if (booking.vehicle_id) {
          await supabase
            .from("vehicles")
            .update({ mileage: odoValue })
            .eq("id", booking.vehicle_id);
        }
      } else {
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

        if (booking.vehicle_id) {
          await supabase
            .from("vehicles")
            .update({ mileage: odoValue, status: "booked" })
            .eq("id", booking.vehicle_id);
        }
      }

      // --- Create inspection record if photos/checklist were done ---
      if (withInspection && user?.id && resolvedVehicleId) {
        const inspectionId = crypto.randomUUID();
        const ts = Date.now();
        const photoFolder = `${user.id}/${inspectionId}`;

        // Upload captured photos
        const uploadedPhotos = await Promise.all(
          photos
            .filter((p) => p.url && !p.skipped)
            .map(async (photo) => {
              const url = await uploadPhoto(
                photo.url!,
                photoFolder,
                `${photo.role}-${ts}.jpg`
              );
              return { ...photo, uploadedUrl: url };
            })
        );

        // Upload damage photos
        const uploadedDamage = await Promise.all(
          damageItems.map(async (damage, index) => {
            const url = await uploadPhoto(
              damage.photoUrl,
              photoFolder,
              `damage-${index}-${ts}.jpg`
            );
            return { ...damage, uploadedUrl: url };
          })
        );

        const direction = isCheckIn ? "check_in" : "check_out";

        const { error: inspectionError } = await supabase
          .from("vehicle_inspections")
          .insert({
            id: inspectionId,
            user_id: user.id,
            vehicle_id: resolvedVehicleId,
            booking_id: booking.id,
            inspection_type: isCheckIn ? "post_rental" : "pre_rental",
            inspector_name: inspectorName || null,
            odometer_reading: odoValue,
            fuel_level: fuelLevel[0],
            exterior_condition: checklist.exteriorCondition,
            interior_condition: checklist.interiorCondition,
            tire_condition: checklist.tireCondition,
            notes: conditionNotes || null,
            inspection_direction: direction,
            status: "completed",
            keys_count: checklist.keysCount,
            cleanliness_rating: checklist.cleanlinessRating,
            started_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
          });

        if (inspectionError) console.error("Inspection error:", inspectionError);

        // Insert photo records
        const photoRecords = uploadedPhotos
          .filter((p) => p.uploadedUrl)
          .map((p) => ({
            inspection_id: inspectionId,
            photo_url: p.uploadedUrl!,
            photo_type: p.label,
            photo_role: p.role,
            skipped: false,
            captured_at: p.capturedAt?.toISOString() || new Date().toISOString(),
          }));

        if (photoRecords.length > 0) {
          await supabase.from("inspection_photos").insert(photoRecords);
        }

        // Insert damage records
        const damageRecords = uploadedDamage
          .filter((d) => d.uploadedUrl)
          .map((d) => ({
            inspection_id: inspectionId,
            photo_url: d.uploadedUrl!,
            damage_type: d.damageType,
            vehicle_location: d.vehicleLocation,
            severity: d.severity,
            notes: d.notes || null,
            quality_warning: d.qualityWarning,
          }));

        if (damageRecords.length > 0) {
          await supabase.from("inspection_damage_items").insert(damageRecords);
        }
      }

      toast({
        title: isCheckIn ? "Vehicle Checked In" : "Vehicle Checked Out",
        description: `${resolvedVehicleName} ${isCheckIn ? "returned" : "dispatched"} successfully`,
      });

      // Prompt for payment if balance due on check-in
      if (isCheckIn) {
        const balanceDue = Number(booking.balance_due) || 0;
        if (balanceDue > 0 || (mileageInfo && mileageInfo.charge > 0)) {
          onCollectPayment?.();
        }
      }

      await refreshData(true);
      if (withInspection) {
        setStep("done");
      } else {
        onComplete?.();
        onOpenChange(false);
      }
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

  // Step navigation
  const handleNextToPhotos = () => {
    if (!validateBasics()) return;
    // Sync odometer/fuel into checklist for the checklist step
    setChecklist((prev) => ({
      ...prev,
      odometerReading: Number(odometer),
      fuelLevel: fuelLevel[0],
    }));
    setStep("photos");
  };

  const handlePhotosComplete = () => {
    setStep("checklist");
  };

  const handleChecklistComplete = async () => {
    await submitAll(true);
  };

  // Reset on close
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setStep("basics");
      setPhotos(initialPhotos);
      setDamageItems([]);
      setConditionNotes("");
      setHasDamage(false);
      setInspectorName("");
    }
    onOpenChange(open);
  };

  const capturedCount = photos.filter((p) => p.url).length;

  // Step progress
  const steps: { key: WizardStep; label: string }[] = [
    { key: "basics", label: "Basics" },
    { key: "photos", label: "Photos" },
    { key: "checklist", label: "Checklist" },
    { key: "done", label: "Done" },
  ];
  const stepIndex = steps.findIndex((s) => s.key === step);
  const progressPercent = step === "done" ? 100 : (stepIndex / (steps.length - 1)) * 100;

  // Dialog size changes based on step
  const dialogSizeClass =
    step === "photos"
      ? "max-w-full h-[100dvh] max-h-[100dvh] p-0 gap-0 rounded-none sm:rounded-lg sm:max-w-lg sm:h-auto sm:max-h-[85vh]"
      : step === "checklist"
      ? "sm:max-w-[550px] max-h-[90vh] p-0 gap-0"
      : "sm:max-w-[500px] max-h-[90vh]";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={cn("flex flex-col", dialogSizeClass)}>
        {/* Step indicator - not shown in photo/checklist steps (they have their own nav) */}
        {(step === "basics" || step === "done") && (
          <>
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

            {/* Step progress bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                {steps.map((s, i) => (
                  <span
                    key={s.key}
                    className={cn(
                      "transition-colors",
                      i <= stepIndex ? "text-primary font-medium" : ""
                    )}
                  >
                    {s.label}
                  </span>
                ))}
              </div>
              <Progress value={progressPercent} className="h-1" />
            </div>
          </>
        )}

        {/* STEP 1: BASICS */}
        {step === "basics" && (
          <>
            <div className="flex-1 overflow-y-auto space-y-4 py-2">
              {/* Booking Info Banner */}
              <div className="p-3 rounded-lg bg-muted/30 border border-border">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Car className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-muted-foreground text-xs">Vehicle</div>
                      <div className="font-medium">{resolvedVehicleName}</div>
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
                        {format(new Date(booking.start_date), "MMM d")} —{" "}
                        {format(new Date(booking.end_date), "MMM d, yyyy")}
                      </div>
                    </div>
                  </div>
                  {isCheckIn && booking.pickup_odometer && (
                    <div className="flex items-center gap-2">
                      <Gauge className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-muted-foreground text-xs">Pickup Odometer</div>
                        <div className="font-medium">
                          {Number(booking.pickup_odometer).toLocaleString()} mi
                        </div>
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
                <div
                  className={cn(
                    "p-3 rounded-lg border text-sm space-y-1",
                    mileageInfo.overage > 0
                      ? "bg-warning/10 border-warning/30"
                      : "bg-success/10 border-success/30"
                  )}
                >
                  <div className="flex justify-between">
                    <span>Miles Driven</span>
                    <span className="font-medium">
                      {mileageInfo.milesDriven.toLocaleString()} mi
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Included</span>
                    <span>{mileageInfo.included.toLocaleString()} mi</span>
                  </div>
                  {mileageInfo.overage > 0 && (
                    <>
                      <Separator />
                      <div className="flex justify-between font-semibold text-warning">
                        <span>
                          Overage ({mileageInfo.overage} mi × ${mileageInfo.rate}/mi)
                        </span>
                        <span>${mileageInfo.charge.toFixed(2)}</span>
                      </div>
                    </>
                  )}
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
                <div className="grid grid-cols-2 gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dateOverride && "text-muted-foreground"
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {dateOverride ? format(dateOverride, "MMM d, yyyy") : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarPicker
                        mode="single"
                        selected={dateOverride}
                        onSelect={setDateOverride}
                        className={cn("p-3 pointer-events-auto")}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <TimeSelect value={timeOverride} onValueChange={setTimeOverride} />
                </div>
              )}
            </div>

            <DialogFooter className="flex-shrink-0 gap-2 sm:gap-2">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={handleQuickComplete}
                disabled={loading || !odometer}
                className="gap-1"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
                Quick Complete
              </Button>
              <Button
                onClick={handleNextToPhotos}
                disabled={!odometer}
                className={
                  isCheckIn
                    ? "bg-success hover:bg-success/90 text-success-foreground"
                    : ""
                }
              >
                <Camera className="w-4 h-4 mr-2" />
                Next: Photos
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </DialogFooter>
          </>
        )}

        {/* STEP 2: PHOTO CAPTURE */}
        {step === "photos" && (
          <GuidedCaptureWizard
            photos={photos}
            damageItems={damageItems}
            onPhotoCapture={handlePhotoCapture}
            onPhotoSkip={handlePhotoSkip}
            onDamageAdd={handleDamageAdd}
            onDamageRemove={handleDamageRemove}
            onComplete={handlePhotosComplete}
            onBack={() => setStep("basics")}
            vehicleName={resolvedVehicleName}
            direction={isCheckIn ? "check_in" : "check_out"}
          />
        )}

        {/* STEP 3: CHECKLIST */}
        {step === "checklist" && (
          <InspectionChecklistForm
            checklist={checklist}
            inspectorName={inspectorName}
            notes={conditionNotes}
            onChecklistChange={setChecklist}
            onInspectorNameChange={setInspectorName}
            onNotesChange={setConditionNotes}
            onComplete={handleChecklistComplete}
            onBack={() => setStep("photos")}
            isSubmitting={loading}
          />
        )}

        {/* STEP 4: DONE */}
        {step === "done" && (
          <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
            <div className="p-4 rounded-full bg-success/10">
              <Check className="h-12 w-12 text-success" />
            </div>
            <h2 className="text-xl font-semibold">
              {isCheckIn ? "Check-In" : "Check-Out"} Complete!
            </h2>
            <p className="text-muted-foreground max-w-xs">
              {resolvedVehicleName} has been{" "}
              {isCheckIn ? "returned" : "dispatched"} successfully
              {capturedCount > 0 ? ` with ${capturedCount} photos documented` : ""}.
            </p>
            <div className="flex gap-2 flex-wrap justify-center">
              {capturedCount > 0 && (
                <Badge variant="outline">
                  <Camera className="h-3 w-3 mr-1" />
                  {capturedCount} photos
                </Badge>
              )}
              {damageItems.length > 0 && (
                <Badge
                  variant="outline"
                  className="border-destructive/50 text-destructive"
                >
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {damageItems.length} damage items
                </Badge>
              )}
              {mileageInfo && mileageInfo.overage > 0 && (
                <Badge
                  variant="outline"
                  className="border-warning/50 text-warning"
                >
                  ${mileageInfo.charge.toFixed(2)} overage
                </Badge>
              )}
            </div>
            {(damageItems.length > 0 || checklist.exteriorCondition === 'poor' || checklist.interiorCondition === 'poor' || checklist.tireCondition === 'poor') && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
                <p className="text-sm text-amber-700 dark:text-amber-400 mb-2">Issues found during inspection</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onComplete?.();
                    handleOpenChange(false);
                    window.dispatchEvent(new CustomEvent('create-work-order', {
                      detail: {
                        vehicle_id: resolvedVehicleId,
                        title: `${isCheckIn ? 'Check-in' : 'Check-out'} issue: ${resolvedVehicleName}`,
                        source: 'check_in_out',
                        notes: [
                          damageItems.length > 0 ? `${damageItems.length} damage item(s) found` : '',
                          checklist.exteriorCondition === 'poor' ? 'Poor exterior condition' : '',
                          checklist.interiorCondition === 'poor' ? 'Poor interior condition' : '',
                          checklist.tireCondition === 'poor' ? 'Poor tire condition' : '',
                          conditionNotes || '',
                        ].filter(Boolean).join('\n'),
                        issue_type: damageItems.length > 0 ? 'body' : 'general',
                        priority: damageItems.some(d => d.severity === 'major') ? 'urgent' : 'normal',
                      }
                    }));
                  }}
                  className="border-amber-500/30 text-amber-700 dark:text-amber-400"
                >
                  <Wrench className="h-4 w-4 mr-2" />
                  Create Work Order
                </Button>
              </div>
            )}
            <Button
              onClick={() => {
                onComplete?.();
                handleOpenChange(false);
              }}
              className="mt-2"
            >
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
