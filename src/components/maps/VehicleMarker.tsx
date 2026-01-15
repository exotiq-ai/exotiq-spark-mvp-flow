import { OverlayView } from '@react-google-maps/api';
import { Car } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface VehicleMapData {
  id: string;
  name: string;
  status: 'available' | 'rented' | 'attention' | 'transit';
  lat: number;
  lng: number;
  customerName?: string;
  returnTime?: string;
}

interface VehicleMarkerProps {
  vehicle: VehicleMapData;
  isSelected: boolean;
  onClick: () => void;
}

const getStatusColor = (status: VehicleMapData['status']) => {
  switch (status) {
    case 'available':
      return 'bg-success text-success-foreground border-success';
    case 'rented':
      return 'bg-primary text-primary-foreground border-primary';
    case 'attention':
      return 'bg-destructive text-destructive-foreground border-destructive';
    case 'transit':
      return 'bg-warning text-warning-foreground border-warning';
    default:
      return 'bg-muted text-muted-foreground border-muted';
  }
};

export const VehicleMarker = ({ vehicle, isSelected, onClick }: VehicleMarkerProps) => {
  return (
    <OverlayView
      position={{ lat: vehicle.lat, lng: vehicle.lng }}
      mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
    >
      <div
        className={cn(
          'cursor-pointer transition-all duration-200 transform -translate-x-1/2 -translate-y-1/2',
          isSelected && 'scale-125 z-50'
        )}
        onClick={onClick}
      >
        <div
          className={cn(
            'p-1.5 rounded-full shadow-lg border-2',
            getStatusColor(vehicle.status),
            isSelected && 'ring-2 ring-offset-2 ring-primary'
          )}
        >
          <Car className="h-4 w-4" />
        </div>
        {isSelected && (
          <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-card border border-border shadow-lg rounded-lg p-2 min-w-[120px] z-50">
            <p className="text-xs font-medium truncate">{vehicle.name}</p>
            {vehicle.customerName && (
              <p className="text-[10px] text-muted-foreground truncate">{vehicle.customerName}</p>
            )}
            {vehicle.returnTime && (
              <p className="text-[10px] text-muted-foreground">Return: {vehicle.returnTime}</p>
            )}
          </div>
        )}
      </div>
    </OverlayView>
  );
};
