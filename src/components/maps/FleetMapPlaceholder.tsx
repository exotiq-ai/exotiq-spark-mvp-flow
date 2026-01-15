import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { VehicleListSidebar } from './VehicleListSidebar';
import { VehicleMapData } from './VehicleMarker';
import { 
  MapPin, 
  Satellite, 
  ZoomIn, 
  ZoomOut,
  Maximize2,
  Radio
} from 'lucide-react';

interface FleetMapPlaceholderProps {
  vehicles: VehicleMapData[];
}

// Fixed Scottsdale area positions for demo vehicles
const DEMO_POSITIONS = [
  { x: 45, y: 35 },  // Top-center area
  { x: 72, y: 28 },  // Top-right
  { x: 25, y: 45 },  // Left-center
  { x: 58, y: 52 },  // Center-right
  { x: 35, y: 68 },  // Bottom-left
  { x: 68, y: 65 },  // Bottom-right
  { x: 50, y: 48 },  // Center (HQ)
  { x: 82, y: 42 },  // Far right
  { x: 18, y: 32 },  // Far left-top
  { x: 40, y: 78 },  // Bottom-center
];

export const FleetMapPlaceholder = ({ vehicles }: FleetMapPlaceholderProps) => {
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);

  // Assign positions to vehicles
  const vehiclesWithPositions = vehicles.map((v, i) => ({
    ...v,
    position: DEMO_POSITIONS[i % DEMO_POSITIONS.length]
  }));

  const getStatusColor = (status: VehicleMapData['status']) => {
    switch (status) {
      case 'available': return 'bg-success';
      case 'rented': return 'bg-primary';
      case 'attention': return 'bg-destructive';
      case 'transit': return 'bg-warning';
      default: return 'bg-muted';
    }
  };

  const statusCounts = {
    available: vehicles.filter(v => v.status === 'available').length,
    rented: vehicles.filter(v => v.status === 'rented').length,
    attention: vehicles.filter(v => v.status === 'attention').length,
    transit: vehicles.filter(v => v.status === 'transit').length,
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col lg:flex-row h-[500px]">
        {/* Vehicle List Sidebar */}
        <VehicleListSidebar 
          vehicles={vehicles}
          selectedVehicleId={selectedVehicle}
          onSelectVehicle={setSelectedVehicle}
        />

        {/* Map Area */}
        <div className="flex-1 relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
          {/* Fake map grid overlay */}
          <div 
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `
                linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
              `,
              backgroundSize: '40px 40px'
            }}
          />

          {/* Fake roads */}
          <svg className="absolute inset-0 w-full h-full opacity-20">
            {/* Major roads */}
            <line x1="0" y1="50%" x2="100%" y2="50%" stroke="white" strokeWidth="3" />
            <line x1="50%" y1="0" x2="50%" y2="100%" stroke="white" strokeWidth="3" />
            <line x1="20%" y1="0" x2="80%" y2="100%" stroke="white" strokeWidth="2" />
            <line x1="0" y1="30%" x2="100%" y2="70%" stroke="white" strokeWidth="2" />
          </svg>

          {/* HQ Marker */}
          <div 
            className="absolute flex flex-col items-center"
            style={{ left: '50%', top: '48%', transform: 'translate(-50%, -50%)' }}
          >
            <div className="w-4 h-4 bg-white rounded-sm border-2 border-primary shadow-lg" />
            <span className="text-[10px] text-white/80 mt-1 font-medium">HQ</span>
          </div>

          {/* Vehicle dots */}
          {vehiclesWithPositions.map((vehicle) => (
            <button
              key={vehicle.id}
              className={`absolute transition-all duration-300 ${
                selectedVehicle === vehicle.id ? 'scale-150 z-20' : 'z-10 hover:scale-125'
              }`}
              style={{ 
                left: `${vehicle.position.x}%`, 
                top: `${vehicle.position.y}%`,
                transform: 'translate(-50%, -50%)'
              }}
              onClick={() => setSelectedVehicle(
                selectedVehicle === vehicle.id ? null : vehicle.id
              )}
            >
              <div className={`w-3 h-3 rounded-full ${getStatusColor(vehicle.status)} shadow-lg`}>
                {/* Pulse animation for rented vehicles */}
                {vehicle.status === 'rented' && (
                  <div className={`absolute inset-0 rounded-full ${getStatusColor(vehicle.status)} animate-ping opacity-50`} />
                )}
              </div>
              {/* Info popup on selection */}
              {selectedVehicle === vehicle.id && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-card border rounded-lg p-2 shadow-xl whitespace-nowrap z-30">
                  <p className="text-xs font-medium">{vehicle.name}</p>
                  {vehicle.customerName && (
                    <p className="text-[10px] text-muted-foreground">{vehicle.customerName}</p>
                  )}
                  {vehicle.returnTime && (
                    <p className="text-[10px] text-primary">{vehicle.returnTime}</p>
                  )}
                </div>
              )}
            </button>
          ))}

          {/* Map Controls */}
          <div className="absolute top-3 right-3 flex flex-col gap-1">
            <Button variant="secondary" size="icon" className="h-8 w-8 bg-card/90 backdrop-blur">
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="icon" className="h-8 w-8 bg-card/90 backdrop-blur">
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="icon" className="h-8 w-8 bg-card/90 backdrop-blur">
              <Maximize2 className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="icon" className="h-8 w-8 bg-card/90 backdrop-blur">
              <Satellite className="h-4 w-4" />
            </Button>
          </div>

          {/* Legend */}
          <div className="absolute bottom-3 left-3 bg-card/90 backdrop-blur rounded-lg p-2 text-xs">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-success" />
                <span className="text-muted-foreground">Available ({statusCounts.available})</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span className="text-muted-foreground">Rented ({statusCounts.rented})</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-warning" />
                <span className="text-muted-foreground">Transit ({statusCounts.transit})</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-destructive" />
                <span className="text-muted-foreground">Attention ({statusCounts.attention})</span>
              </div>
            </div>
          </div>

          {/* Integration CTA Overlay */}
          <div className="absolute top-3 left-3">
            <Badge variant="outline" className="bg-card/90 backdrop-blur border-primary/30">
              <Radio className="h-3 w-3 mr-1.5 text-primary animate-pulse" />
              Demo Mode
            </Badge>
          </div>

          {/* Scottsdale label */}
          <div className="absolute bottom-3 right-3 text-[10px] text-white/40">
            Scottsdale, AZ
          </div>
        </div>
      </div>
    </Card>
  );
};
