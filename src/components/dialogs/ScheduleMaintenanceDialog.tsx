import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TimeInput } from "@/components/ui/time-input";
import { Database } from "@/integrations/supabase/types";
import { useTeam } from "@/contexts/TeamContext";
import { MapPin, Loader2, RotateCcw, Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

type MaintenanceInsert = Omit<Database['public']['Tables']['maintenance_schedules']['Insert'], 'user_id'>;
type Vehicle = Database['public']['Tables']['vehicles']['Row'];

interface ScheduleMaintenanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicles: Vehicle[];
  onSubmit: (maintenance: MaintenanceInsert) => Promise<void>;
}

const TEMPLATES = [
  { name: 'Oil Change', type: 'Oil Change', intervalDays: null, intervalMiles: 5000 },
  { name: 'Brake Inspection', type: 'Brake Inspection', intervalDays: null, intervalMiles: 10000 },
  { name: 'Tire Rotation', type: 'Tire Rotation', intervalDays: null, intervalMiles: 7500 },
  { name: 'Annual Service', type: 'Routine Service', intervalDays: 365, intervalMiles: null },
  { name: 'Safety Inspection', type: 'Safety Inspection', intervalDays: 180, intervalMiles: null },
];

const MAINTENANCE_TYPES = [
  "Routine Service", "Oil Change", "Tire Rotation", "Brake Inspection",
  "Engine Repair", "Transmission Service", "Body Work", "Detail & Cleaning",
  "Safety Inspection", "Other"
];

export const ScheduleMaintenanceDialog = ({ open, onOpenChange, vehicles, onSubmit }: ScheduleMaintenanceDialogProps) => {
  const { selectedLocationId, locations } = useTeam();
  
  const [vehicleId, setVehicleId] = useState("");
  const [maintenanceType, setMaintenanceType] = useState("");
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>();
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [serviceProvider, setServiceProvider] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("");
  const [notes, setNotes] = useState("");
  const [locationId, setLocationId] = useState("");
  const [loading, setLoading] = useState(false);

  // Recurrence state
  const [recurrenceType, setRecurrenceType] = useState<'once' | 'interval' | 'mileage'>('once');
  const [intervalDays, setIntervalDays] = useState("");
  const [mileageInterval, setMileageInterval] = useState("");
  const [templateName, setTemplateName] = useState("");

  const selectedVehicle = vehicles.find(v => v.id === vehicleId);
  const effectiveLocationId = locationId || selectedVehicle?.location_id || (selectedLocationId !== 'all' ? selectedLocationId : locations[0]?.id || '');

  const applyTemplate = (template: typeof TEMPLATES[0]) => {
    setMaintenanceType(template.type);
    setTemplateName(template.name);
    if (template.intervalDays) {
      setRecurrenceType('interval');
      setIntervalDays(String(template.intervalDays));
    } else if (template.intervalMiles) {
      setRecurrenceType('mileage');
      setMileageInterval(String(template.intervalMiles));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleId || !maintenanceType || !scheduledDate) return;

    setLoading(true);
    try {
      const [h, m] = scheduledTime.split(':').map(Number);
      const combined = new Date(scheduledDate);
      combined.setHours(h, m, 0, 0);

      const data: any = {
        vehicle_id: vehicleId,
        maintenance_type: maintenanceType,
        scheduled_date: combined.toISOString(),
        service_provider: serviceProvider || null,
        estimated_cost: estimatedCost ? parseFloat(estimatedCost) : null,
        notes: notes || null,
        status: 'scheduled',
        location_id: effectiveLocationId || null,
        recurrence_type: recurrenceType,
        recurrence_interval_days: recurrenceType === 'interval' && intervalDays ? parseInt(intervalDays) : null,
        recurrence_mileage_interval: recurrenceType === 'mileage' && mileageInterval ? parseInt(mileageInterval) : null,
        template_name: templateName || null,
      };

      await onSubmit(data);

      // Reset
      setVehicleId(""); setMaintenanceType(""); setScheduledDate(undefined); setScheduledTime("09:00"); setServiceProvider("");
      setEstimatedCost(""); setNotes(""); setLocationId(""); setRecurrenceType('once');
      setIntervalDays(""); setMileageInterval(""); setTemplateName("");
      onOpenChange(false);
    } catch (error) {
      console.error("Error scheduling maintenance:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schedule Maintenance</DialogTitle>
        </DialogHeader>

        {/* Quick Templates */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Quick Templates</Label>
          <div className="flex flex-wrap gap-2">
            {TEMPLATES.map(t => (
              <Badge
                key={t.name}
                variant="outline"
                className={cn(
                  'cursor-pointer hover:bg-primary/10 transition-colors',
                  templateName === t.name && 'bg-primary/10 border-primary/50'
                )}
                onClick={() => applyTemplate(t)}
              >
                {t.name}
              </Badge>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Vehicle *</Label>
            <Select value={vehicleId} onValueChange={setVehicleId}>
              <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
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
            <Label>Maintenance Type *</Label>
            <Select value={maintenanceType} onValueChange={setMaintenanceType}>
              <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                {MAINTENANCE_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Scheduled Date & Time *</Label>
            <div className="grid grid-cols-2 gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !scheduledDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {scheduledDate ? format(scheduledDate, "MMM d, yyyy") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={scheduledDate}
                    onSelect={setScheduledDate}
                    className={cn("p-3 pointer-events-auto")}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <TimeSelect value={scheduledTime} onValueChange={setScheduledTime} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Estimated Cost ($)</Label>
            <Input type="number" placeholder="500" value={estimatedCost} onChange={(e) => setEstimatedCost(e.target.value)} min="0" step="0.01" />
          </div>

          {/* Recurrence Section */}
          <div className="space-y-3 p-3 rounded-lg border bg-muted/10">
            <div className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Recurrence</Label>
            </div>
            <div className="flex gap-1">
              {([
                { key: 'once' as const, label: 'One-time' },
                { key: 'interval' as const, label: 'Every X days' },
                { key: 'mileage' as const, label: 'Every X miles' },
              ]).map(opt => (
                <Button
                  key={opt.key}
                  type="button"
                  variant={recurrenceType === opt.key ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => setRecurrenceType(opt.key)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
            {recurrenceType === 'interval' && (
              <div className="space-y-1">
                <Label className="text-xs">Repeat every (days)</Label>
                <Input type="number" placeholder="90" value={intervalDays} onChange={(e) => setIntervalDays(e.target.value)} min="1" />
              </div>
            )}
            {recurrenceType === 'mileage' && (
              <div className="space-y-1">
                <Label className="text-xs">Repeat every (miles)</Label>
                <Input type="number" placeholder="5000" value={mileageInterval} onChange={(e) => setMileageInterval(e.target.value)} min="100" />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Service Provider</Label>
            <Input placeholder="e.g., Premium Auto Care" value={serviceProvider} onChange={(e) => setServiceProvider(e.target.value)} />
          </div>

          {locations.length > 1 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><MapPin className="h-4 w-4" />Location</Label>
              <Select value={effectiveLocationId} onValueChange={setLocationId}>
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
          )}

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea placeholder="Additional details about the maintenance..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Scheduling...</> : "Schedule Maintenance"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};