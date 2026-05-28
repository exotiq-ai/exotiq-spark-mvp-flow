import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2, MapPin, Users } from "lucide-react";
import { useTeam } from "@/contexts/TeamContext";
import { useUserRole } from "@/hooks/useUserRole";
import { usePartners } from "@/hooks/usePartners";
import { MILEAGE_RATE_TIERS } from "@/lib/pricingUtils";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

interface Vehicle {
  id: string;
  name: string;
  make: string;
  model: string;
  year: number;
  status: string;
  current_rate: number;
  license_plate?: string | null;
  vin?: string | null;
  color?: string | null;
  default_mileage_limit?: number | null;
  mileage_overage_rate?: number | null;
  location_id?: string | null;
  ownership_type?: string | null;
  partner_id?: string | null;
  split_type?: string | null;
  split_value?: number | null;
}

interface EditVehicleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle: Vehicle | null;
  onSave: (vehicleId: string, updates: Partial<Vehicle>, options?: { source?: string }) => Promise<boolean>;
}

export const EditVehicleDialog = ({ open, onOpenChange, vehicle, onSave }: EditVehicleDialogProps) => {
  const { locations } = useTeam();
  const { role, hasRoleOrHigher } = useUserRole();

  const { partners } = usePartners();
  const activePartners = partners.filter((p) => p.is_active || p.id === vehicle?.partner_id);

  const [name, setName] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [licensePlate, setLicensePlate] = useState("");
  const [vin, setVin] = useState("");
  const [currentRate, setCurrentRate] = useState("");
  const [status, setStatus] = useState<string>("available");
  const [locationId, setLocationId] = useState<string>("");
  const [color, setColor] = useState("");
  const [defaultMileageLimit, setDefaultMileageLimit] = useState("");
  const [mileageOverageRate, setMileageOverageRate] = useState("");
  const [ownershipType, setOwnershipType] = useState<string>("owned");
  const [partnerId, setPartnerId] = useState<string>("none");
  const [splitType, setSplitType] = useState<string>("percent");
  const [splitValue, setSplitValue] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastEditInfo, setLastEditInfo] = useState<string | null>(null);

  // Populate form when vehicle changes
  useEffect(() => {
    if (vehicle && open) {
      setName(vehicle.name || "");
      setMake(vehicle.make || "");
      setModel(vehicle.model || "");
      setYear(String(vehicle.year || ""));
      setLicensePlate(vehicle.license_plate || "");
      setVin(vehicle.vin || "");
      setCurrentRate(String(vehicle.current_rate || ""));
      setStatus(vehicle.status || "available");
      setLocationId(vehicle.location_id || "");
      setColor(vehicle.color || "");
      setDefaultMileageLimit(vehicle.default_mileage_limit != null ? String(vehicle.default_mileage_limit) : "");
      setMileageOverageRate(vehicle.mileage_overage_rate != null ? String(vehicle.mileage_overage_rate) : "");
      setOwnershipType(vehicle.ownership_type || "owned");
      setPartnerId(vehicle.partner_id || "none");
      setSplitType(vehicle.split_type || "percent");
      setSplitValue(vehicle.split_value != null ? String(vehicle.split_value) : "");
      setError(null);

      // Fetch last edit info
      fetchLastEdit(vehicle.id);
    }
  }, [vehicle, open]);

  const fetchLastEdit = async (vehicleId: string) => {
    const { data } = await supabase
      .from('vehicle_change_log' as any)
      .select('created_at, user_id, field_name')
      .eq('vehicle_id', vehicleId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      const entry = data[0] as any;
      const timeAgo = formatDistanceToNow(new Date(entry.created_at), { addSuffix: true });
      setLastEditInfo(`Last edited ${timeAgo}`);
    } else {
      setLastEditInfo(null);
    }
  };

  // Role check
  const canEdit = hasRoleOrHigher('manager');
  if (!canEdit) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicle) return;
    setError(null);

    if (!name.trim() || !make.trim() || !model.trim() || !year || !currentRate) {
      setError("Please fill in all required fields.");
      return;
    }

    setLoading(true);
    try {
      const updates: Record<string, any> = {};
      
      if (name !== vehicle.name) updates.name = name;
      if (make !== vehicle.make) updates.make = make;
      if (model !== vehicle.model) updates.model = model;
      if (parseInt(year) !== vehicle.year) updates.year = parseInt(year);
      if ((licensePlate || null) !== (vehicle.license_plate || null)) updates.license_plate = licensePlate || null;
      if ((vin || null) !== (vehicle.vin || null)) updates.vin = vin || null;
      if (parseFloat(currentRate) !== vehicle.current_rate) updates.current_rate = parseFloat(currentRate);
      if (status !== vehicle.status) updates.status = status;
      if ((locationId || null) !== (vehicle.location_id || null)) updates.location_id = locationId || null;
      if ((color || null) !== (vehicle.color || null)) updates.color = color || null;
      
      const newMileageLimit = defaultMileageLimit ? parseInt(defaultMileageLimit) : null;
      if (newMileageLimit !== (vehicle.default_mileage_limit ?? null)) updates.default_mileage_limit = newMileageLimit;
      
      const newOverageRate = mileageOverageRate ? parseFloat(mileageOverageRate) : null;
      if (newOverageRate !== (vehicle.mileage_overage_rate ?? null)) updates.mileage_overage_rate = newOverageRate;

      // Ownership
      const newPartnerId = partnerId === "none" ? null : partnerId;
      const newOwnership = newPartnerId ? "partner" : "owned";
      const newSplitValue = newPartnerId && splitValue ? parseFloat(splitValue) : null;
      const newSplitType = newPartnerId ? splitType : null;
      if (newOwnership !== (vehicle.ownership_type || "owned")) updates.ownership_type = newOwnership;
      if (newPartnerId !== (vehicle.partner_id ?? null)) updates.partner_id = newPartnerId;
      if (newSplitType !== (vehicle.split_type ?? null)) updates.split_type = newSplitType;
      if (newSplitValue !== (vehicle.split_value ?? null)) updates.split_value = newSplitValue;

      if (Object.keys(updates).length === 0) {
        onOpenChange(false);
        return;
      }

      const success = await onSave(vehicle.id, updates);
      if (success) {
        onOpenChange(false);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to update vehicle.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
          <DialogTitle>Edit Vehicle</DialogTitle>
          {lastEditInfo && (
            <p className="text-xs text-muted-foreground mt-1">{lastEditInfo}</p>
          )}
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto">
          <form onSubmit={handleSubmit} id="edit-vehicle-form" className="px-6 py-4 space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Vehicle Name *</Label>
                <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-make">Make *</Label>
                <Input id="edit-make" value={make} onChange={(e) => setMake(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-model">Model *</Label>
                <Input id="edit-model" value={model} onChange={(e) => setModel(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-year">Year *</Label>
                <Input id="edit-year" type="number" value={year} onChange={(e) => setYear(e.target.value)} required min="1900" max={new Date().getFullYear() + 1} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-plate">License Plate</Label>
                <Input id="edit-plate" value={licensePlate} onChange={(e) => setLicensePlate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-vin">VIN</Label>
                <Input id="edit-vin" value={vin} onChange={(e) => setVin(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-rate">Daily Rate ($) *</Label>
                <Input id="edit-rate" type="number" value={currentRate} onChange={(e) => setCurrentRate(e.target.value)} required min="0" step="0.01" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-status">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="booked">Booked</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="retired">Retired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-color">Color</Label>
                <Input id="edit-color" placeholder="e.g., Midnight Blue" value={color} onChange={(e) => setColor(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-mileage">Included Miles/Day</Label>
                <Input id="edit-mileage" type="number" value={defaultMileageLimit} onChange={(e) => setDefaultMileageLimit(e.target.value)} min="0" />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="edit-overage">Overage Rate ($/mi)</Label>
                <Select value={mileageOverageRate} onValueChange={setMileageOverageRate}>
                  <SelectTrigger><SelectValue placeholder="Select rate" /></SelectTrigger>
                  <SelectContent>
                    {MILEAGE_RATE_TIERS.map(tier => (
                      <SelectItem key={tier.value} value={tier.value}>{tier.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Location */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Location
              </Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                <SelectContent>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}{loc.is_default && " (Default)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Ownership */}
            <div className="space-y-3 pt-2 border-t">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Ownership
              </Label>
              <div className="space-y-2">
                <Label htmlFor="edit-partner" className="text-xs text-muted-foreground">Partner</Label>
                <Select value={partnerId} onValueChange={setPartnerId}>
                  <SelectTrigger><SelectValue placeholder="Owned by tenant" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Owned by tenant</SelectItem>
                    {activePartners.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}{!p.is_active && " (inactive)"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Ownership changes apply to future completed bookings. Existing payouts are unchanged.
                </p>
              </div>
              {partnerId !== "none" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Split Type</Label>
                    <Select value={splitType} onValueChange={setSplitType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percent">Percent of net</SelectItem>
                        <SelectItem value="flat">Flat amount per booking</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      {splitType === "percent" ? "Partner Share (%)" : "Flat Amount ($)"}
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      max={splitType === "percent" ? "100" : undefined}
                      step="0.01"
                      value={splitValue}
                      onChange={(e) => setSplitValue(e.target.value)}
                      placeholder={splitType === "percent" ? "e.g., 70" : "e.g., 250"}
                    />
                  </div>
                </div>
              )}
            </div>
          </form>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t flex-shrink-0 bg-background">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" form="edit-vehicle-form" disabled={loading} className="min-h-[44px]">
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
