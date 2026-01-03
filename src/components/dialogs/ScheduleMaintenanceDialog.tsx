import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Database } from "@/integrations/supabase/types";
import { useTeam } from "@/contexts/TeamContext";
import { MapPin, Loader2 } from "lucide-react";

type MaintenanceInsert = Omit<Database['public']['Tables']['maintenance_schedules']['Insert'], 'user_id'>;
type Vehicle = Database['public']['Tables']['vehicles']['Row'];

interface ScheduleMaintenanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicles: Vehicle[];
  onSubmit: (maintenance: MaintenanceInsert) => Promise<void>;
}

export const ScheduleMaintenanceDialog = ({ 
  open, 
  onOpenChange, 
  vehicles,
  onSubmit 
}: ScheduleMaintenanceDialogProps) => {
  const { selectedLocationId, locations } = useTeam();
  
  const [vehicleId, setVehicleId] = useState("");
  const [maintenanceType, setMaintenanceType] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [serviceProvider, setServiceProvider] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("");
  const [notes, setNotes] = useState("");
  const [locationId, setLocationId] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Auto-set location based on selected vehicle or current selection
  const selectedVehicle = vehicles.find(v => v.id === vehicleId);
  const effectiveLocationId = locationId || selectedVehicle?.location_id || (selectedLocationId !== 'all' ? selectedLocationId : locations[0]?.id || '');

  const maintenanceTypes = [
    "Routine Service",
    "Oil Change",
    "Tire Rotation",
    "Brake Inspection",
    "Engine Repair",
    "Transmission Service",
    "Body Work",
    "Detail & Cleaning",
    "Safety Inspection",
    "Other"
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!vehicleId || !maintenanceType || !scheduledDate) {
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        vehicle_id: vehicleId,
        maintenance_type: maintenanceType,
        scheduled_date: new Date(scheduledDate).toISOString(),
        service_provider: serviceProvider || null,
        estimated_cost: estimatedCost ? parseFloat(estimatedCost) : null,
        notes: notes || null,
        status: 'scheduled',
        location_id: effectiveLocationId || null
      });

      // Reset form
      setVehicleId("");
      setMaintenanceType("");
      setScheduledDate("");
      setServiceProvider("");
      setEstimatedCost("");
      setNotes("");
      setLocationId("");
      onOpenChange(false);
    } catch (error) {
      console.error("Error scheduling maintenance:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Schedule Maintenance</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="vehicle">Vehicle *</Label>
            <Select value={vehicleId} onValueChange={setVehicleId}>
              <SelectTrigger>
                <SelectValue placeholder="Select vehicle" />
              </SelectTrigger>
              <SelectContent>
                {vehicles.map((vehicle) => (
                  <SelectItem key={vehicle.id} value={vehicle.id}>
                    {vehicle.name} ({vehicle.make} {vehicle.model})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="maintenanceType">Maintenance Type *</Label>
            <Select value={maintenanceType} onValueChange={setMaintenanceType}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {maintenanceTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="scheduledDate">Scheduled Date & Time *</Label>
              <Input
                id="scheduledDate"
                type="datetime-local"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="estimatedCost">Estimated Cost ($)</Label>
              <Input
                id="estimatedCost"
                type="number"
                placeholder="500"
                value={estimatedCost}
                onChange={(e) => setEstimatedCost(e.target.value)}
                min="0"
                step="0.01"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="serviceProvider">Service Provider</Label>
            <Input
              id="serviceProvider"
              placeholder="e.g., Premium Auto Care"
              value={serviceProvider}
              onChange={(e) => setServiceProvider(e.target.value)}
            />
          </div>

          {/* Location Selection */}
          {locations.length > 1 && (
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
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Additional details about the maintenance..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Scheduling...
                </>
              ) : (
                "Schedule Maintenance"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};