import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Database } from "@/integrations/supabase/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2, MapPin } from "lucide-react";
import { validators, validateForm } from "@/lib/validation";
import { toast } from "@/hooks/use-toast";
import { useTeam } from "@/contexts/TeamContext";

type VehicleInsert = Omit<Database['public']['Tables']['vehicles']['Insert'], 'user_id'>;

interface AddVehicleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (vehicle: VehicleInsert) => Promise<void>;
}

export const AddVehicleDialog = ({ open, onOpenChange, onSubmit }: AddVehicleDialogProps) => {
  const { selectedLocationId, currentLocation, locations } = useTeam();
  
  const [name, setName] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [licensePlate, setLicensePlate] = useState("");
  const [vin, setVin] = useState("");
  const [currentRate, setCurrentRate] = useState("");
  const [status, setStatus] = useState<string>("available");
  const [locationId, setLocationId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Auto-set location when dialog opens or selectedLocationId changes
  const effectiveLocationId = locationId || (selectedLocationId !== 'all' ? selectedLocationId : locations[0]?.id || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Validate form
    const validation = validateForm([
      () => validators.required(name, 'Vehicle name'),
      () => validators.required(make, 'Make'),
      () => validators.required(model, 'Model'),
      () => validators.required(year, 'Year'),
      () => validators.year(year),
      () => validators.required(currentRate, 'Daily rate'),
      () => validators.positiveNumber(currentRate, 'Daily rate'),
    ]);

    if (!validation.isValid) {
      setError(validation.errors[0]);
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        name,
        make,
        model,
        year: parseInt(year),
        license_plate: licensePlate || null,
        vin: vin || null,
        current_rate: parseFloat(currentRate),
        status,
        image_url: null,
        utilization: 0,
        revenue: 0,
        suggested_rate: null,
        location_id: effectiveLocationId || null
      });

      // Reset form
      setName("");
      setMake("");
      setModel("");
      setYear("");
      setLicensePlate("");
      setVin("");
      setCurrentRate("");
      setStatus("available");
      setLocationId("");
      setError(null);
      onOpenChange(false);
      
      toast({
        title: "Success",
        description: "Vehicle added successfully",
      });
    } catch (err: any) {
      // Surface the real error message (e.g., Zod validation or DB error)
      const message = err?.message || "Failed to add vehicle. Please try again.";
      setError(message);
      console.error("Error adding vehicle:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
          <DialogTitle>Add New Vehicle</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto">
          <form onSubmit={handleSubmit} id="add-vehicle-form" className="px-6 py-4 space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Vehicle Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., McLaren 720S"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="make">Make *</Label>
                <Input
                  id="make"
                  placeholder="e.g., McLaren"
                  value={make}
                  onChange={(e) => setMake(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="model">Model *</Label>
                <Input
                  id="model"
                  placeholder="e.g., 720S"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="year">Year *</Label>
                <Input
                  id="year"
                  type="number"
                  placeholder="2024"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  required
                  min="1900"
                  max={new Date().getFullYear() + 1}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="licensePlate">License Plate</Label>
                <Input
                  id="licensePlate"
                  placeholder="ABC-1234"
                  value={licensePlate}
                  onChange={(e) => setLicensePlate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vin">VIN</Label>
                <Input
                  id="vin"
                  placeholder="1HGBH41JXMN109186"
                  value={vin}
                  onChange={(e) => setVin(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="currentRate">Daily Rate ($) *</Label>
                <Input
                  id="currentRate"
                  type="number"
                  placeholder="500"
                  value={currentRate}
                  onChange={(e) => setCurrentRate(e.target.value)}
                  required
                  min="0"
                  step="0.01"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="booked">Booked</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Location Selection */}
            <div className="space-y-2">
              <Label htmlFor="location" className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Location
              </Label>
              <Select value={effectiveLocationId} onValueChange={setLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                      {loc.is_default && " (Default)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {currentLocation && selectedLocationId !== 'all' && (
                <p className="text-xs text-muted-foreground">
                  Auto-assigned to current location: {currentLocation.name}
                </p>
              )}
            </div>
          </form>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t flex-shrink-0 bg-background">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" form="add-vehicle-form" disabled={loading} className="min-h-[44px]">
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              "Add Vehicle"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
