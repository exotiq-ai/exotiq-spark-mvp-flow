import { useState, useMemo } from "react";
import { isBlockingBooking } from "@/lib/conflictDetection";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { useFleet } from "@/contexts/FleetContext";
import { getVehicleImage } from "@/lib/vehicleImageMapping";
import { isWithinInterval } from "date-fns";
import { Car, Check, Search, AlertCircle } from "lucide-react";
import { useMoney } from "@/hooks/useMoney";

interface ChangeVehicleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  currentVehicleId: string;
  startDate: string;
  endDate: string;
  onVehicleChanged: () => void;
}

export const ChangeVehicleDialog = ({
  open,
  onOpenChange,
  bookingId,
  currentVehicleId,
  startDate,
  endDate,
  onVehicleChanged,
}: ChangeVehicleDialogProps) => {
  const { vehicles, bookings, updateBookingVehicle } = useFleet();
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isChanging, setIsChanging] = useState(false);

  // Check vehicle availability for the booking dates
  const getVehicleAvailability = (vehicleId: string) => {
    if (vehicleId === currentVehicleId) return { available: true, reason: "Current vehicle" };
    
    const bookingStart = new Date(startDate);
    const bookingEnd = new Date(endDate);
    
    const conflictingBooking = bookings.find(b => {
      if (b.vehicle_id !== vehicleId) return false;
      if (b.id === bookingId) return false;
      if (!isBlockingBooking(b.status)) return false;
      
      const bStart = new Date(b.start_date);
      const bEnd = new Date(b.end_date);
      
      return (
        isWithinInterval(bookingStart, { start: bStart, end: bEnd }) ||
        isWithinInterval(bookingEnd, { start: bStart, end: bEnd }) ||
        isWithinInterval(bStart, { start: bookingStart, end: bookingEnd })
      );
    });

    if (conflictingBooking) {
      return { available: false, reason: `Booked: ${conflictingBooking.customer_name}` };
    }

    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (vehicle?.status === "maintenance") {
      return { available: false, reason: "In maintenance" };
    }

    return { available: true, reason: "Available" };
  };

  const filteredVehicles = useMemo(() => {
    return vehicles.filter(v => 
      v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.make.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.model.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [vehicles, searchQuery]);

  const handleChangeVehicle = async () => {
    if (!selectedVehicleId) return;
    setIsChanging(true);
    try {
      await updateBookingVehicle(bookingId, selectedVehicleId);
      onVehicleChanged();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to change vehicle:", error);
    } finally {
      setIsChanging(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Car className="h-5 w-5" />
            Change Vehicle
          </DialogTitle>
          <DialogDescription>
            Select a different vehicle for this booking. Only available vehicles are shown.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search vehicles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-2">
            {filteredVehicles.map((vehicle) => {
              const availability = getVehicleAvailability(vehicle.id);
              const isSelected = selectedVehicleId === vehicle.id;
              const isCurrent = vehicle.id === currentVehicleId;
              const vehicleImage = getVehicleImage(vehicle.name);

              return (
                <div
                  key={vehicle.id}
                  onClick={() => {
                    if (availability.available && !isCurrent) {
                      setSelectedVehicleId(vehicle.id);
                    }
                  }}
                  className={`relative p-3 rounded-lg border-2 transition-all cursor-pointer ${
                    isSelected
                      ? "border-primary bg-primary/10"
                      : isCurrent
                      ? "border-accent bg-accent/10 cursor-default"
                      : availability.available
                      ? "border-border hover:border-primary/50 hover:bg-muted/30"
                      : "border-border bg-muted/30 opacity-60 cursor-not-allowed"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-12 rounded-md overflow-hidden bg-muted flex-shrink-0">
                      {vehicleImage ? (
                        <img
                          src={vehicleImage}
                          alt={vehicle.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Car className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{vehicle.name}</div>
                      <div className="text-sm text-muted-foreground">
                        ${Number(vehicle.current_rate).toLocaleString()}/day
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isCurrent ? (
                        <Badge variant="secondary">Current</Badge>
                      ) : availability.available ? (
                        <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                          Available
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-xs">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          {availability.reason}
                        </Badge>
                      )}
                      {isSelected && (
                        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                          <Check className="h-4 w-4 text-primary-foreground" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleChangeVehicle}
            disabled={!selectedVehicleId || isChanging}
          >
            {isChanging ? "Changing..." : "Confirm Change"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
