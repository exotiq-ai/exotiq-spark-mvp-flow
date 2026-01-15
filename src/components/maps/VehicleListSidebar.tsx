import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Car, Clock, User, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { VehicleMapData } from "./VehicleMarker";

interface VehicleListSidebarProps {
  vehicles: VehicleMapData[];
  selectedVehicleId: string | null;
  onSelectVehicle: (id: string) => void;
}

const getStatusBadge = (status: VehicleMapData['status']) => {
  switch (status) {
    case 'available':
      return <Badge variant="outline" className="bg-success/10 text-success border-success/30 text-[10px]">Available</Badge>;
    case 'rented':
      return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px]">Rented</Badge>;
    case 'attention':
      return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-[10px]">Attention</Badge>;
    case 'transit':
      return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-[10px]">In Transit</Badge>;
    default:
      return null;
  }
};

export const VehicleListSidebar = ({ vehicles, selectedVehicleId, onSelectVehicle }: VehicleListSidebarProps) => {
  // Group vehicles by status
  const rentedVehicles = vehicles.filter(v => v.status === 'rented');
  const attentionVehicles = vehicles.filter(v => v.status === 'attention');
  const transitVehicles = vehicles.filter(v => v.status === 'transit');
  const availableVehicles = vehicles.filter(v => v.status === 'available');

  const sortedVehicles = [...attentionVehicles, ...rentedVehicles, ...transitVehicles, ...availableVehicles];

  return (
    <div className="w-64 bg-card border-r border-border flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Fleet Vehicles</h3>
          <Badge variant="secondary" className="text-xs">
            {vehicles.length}
          </Badge>
        </div>
        <div className="flex gap-2 mt-2 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-primary" />
            {rentedVehicles.length} out
          </span>
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-success" />
            {availableVehicles.length} lot
          </span>
          {attentionVehicles.length > 0 && (
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-destructive" />
              {attentionVehicles.length} alert
            </span>
          )}
        </div>
      </div>

      {/* Vehicle list */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {sortedVehicles.map((vehicle) => (
            <button
              key={vehicle.id}
              onClick={() => onSelectVehicle(vehicle.id)}
              className={cn(
                "w-full text-left p-2 rounded-lg transition-colors",
                selectedVehicleId === vehicle.id
                  ? "bg-primary/10 border border-primary/30"
                  : "hover:bg-muted/50"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Car className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm font-medium truncate">{vehicle.name}</span>
                </div>
                {getStatusBadge(vehicle.status)}
              </div>
              
              {vehicle.customerName && (
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground ml-5">
                  <User className="h-3 w-3" />
                  <span className="truncate">{vehicle.customerName}</span>
                </div>
              )}
              
              {vehicle.returnTime && (
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground ml-5">
                  <Clock className="h-3 w-3" />
                  <span>Return: {vehicle.returnTime}</span>
                </div>
              )}
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
