import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getVehicleImage } from "@/lib/vehicleImageMapping";

interface VehicleImageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicleName: string;
  vehicleDetails?: {
    make: string;
    model: string;
    year: number;
    status: string;
    dailyRate: number;
  };
}

export function VehicleImageDialog({
  open,
  onOpenChange,
  vehicleName,
  vehicleDetails,
}: VehicleImageDialogProps) {
  const imageUrl = getVehicleImage(vehicleName);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{vehicleName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {imageUrl ? (
            <div className="relative aspect-video w-full overflow-hidden rounded-lg border">
              <img
                src={imageUrl}
                alt={vehicleName}
                className="object-cover w-full h-full"
              />
            </div>
          ) : (
            <div className="aspect-video w-full bg-muted rounded-lg flex items-center justify-center">
              <p className="text-muted-foreground">No image available</p>
            </div>
          )}
          
          {vehicleDetails && (
            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <p className="text-sm text-muted-foreground">Make & Model</p>
                <p className="font-medium">{vehicleDetails.make} {vehicleDetails.model}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Year</p>
                <p className="font-medium">{vehicleDetails.year}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <p className="font-medium capitalize">{vehicleDetails.status}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Daily Rate</p>
                <p className="font-medium">${vehicleDetails.dailyRate.toLocaleString()}</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
