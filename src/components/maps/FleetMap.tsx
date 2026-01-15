import { useState, useCallback, useMemo } from 'react';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import { VehicleMarker, VehicleMapData } from './VehicleMarker';
import { VehicleListSidebar } from './VehicleListSidebar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Maximize2, 
  Filter, 
  MapPin,
  Car,
  AlertTriangle
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Scottsdale, AZ center coordinates
const SCOTTSDALE_CENTER = { lat: 33.4942, lng: -111.9261 };

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

// Dark mode map styles
const mapStyles = [
  { elementType: 'geometry', stylers: [{ color: '#1d1d1d' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1d1d1d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8b8b8b' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2c2c2c' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1d1d1d' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e0e0e' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#1d1d1d' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1a2e1a' }] },
];

interface FleetMapProps {
  vehicles: VehicleMapData[];
}

export const FleetMap = ({ vehicles }: FleetMapProps) => {
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [statusFilter, setStatusFilter] = useState<Set<VehicleMapData['status']>>(
    new Set(['available', 'rented', 'attention', 'transit'])
  );

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_PLACES_API_KEY || '',
  });

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  const handleVehicleSelect = (vehicleId: string) => {
    setSelectedVehicleId(vehicleId === selectedVehicleId ? null : vehicleId);
    
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (vehicle && map) {
      map.panTo({ lat: vehicle.lat, lng: vehicle.lng });
      map.setZoom(15);
    }
  };

  const filteredVehicles = useMemo(() => 
    vehicles.filter(v => statusFilter.has(v.status)),
    [vehicles, statusFilter]
  );

  const toggleFilter = (status: VehicleMapData['status']) => {
    const newFilter = new Set(statusFilter);
    if (newFilter.has(status)) {
      newFilter.delete(status);
    } else {
      newFilter.add(status);
    }
    setStatusFilter(newFilter);
  };

  const fitAllVehicles = () => {
    if (!map || filteredVehicles.length === 0) return;
    
    const bounds = new google.maps.LatLngBounds();
    filteredVehicles.forEach(v => {
      bounds.extend({ lat: v.lat, lng: v.lng });
    });
    map.fitBounds(bounds);
  };

  if (loadError) {
    return (
      <Card className="h-[500px] flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Failed to load map</p>
        </div>
      </Card>
    );
  }

  if (!isLoaded) {
    return (
      <Card className="h-[500px] flex">
        <div className="w-64 border-r border-border p-3 space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
        <div className="flex-1 bg-muted/30 flex items-center justify-center">
          <div className="text-center">
            <MapPin className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2 animate-pulse" />
            <p className="text-sm text-muted-foreground">Loading map...</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="h-[500px] lg:h-[600px] overflow-hidden flex">
      {/* Sidebar */}
      <VehicleListSidebar
        vehicles={filteredVehicles}
        selectedVehicleId={selectedVehicleId}
        onSelectVehicle={handleVehicleSelect}
      />

      {/* Map container */}
      <div className="flex-1 relative">
        {/* Map controls overlay */}
        <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
          <div className="flex gap-2 pointer-events-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm" className="shadow-lg">
                  <Filter className="h-4 w-4 mr-1" />
                  Filter
                  {statusFilter.size < 4 && (
                    <Badge variant="outline" className="ml-1 text-[10px]">
                      {statusFilter.size}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuCheckboxItem
                  checked={statusFilter.has('rented')}
                  onCheckedChange={() => toggleFilter('rented')}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    Rented ({vehicles.filter(v => v.status === 'rented').length})
                  </div>
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={statusFilter.has('available')}
                  onCheckedChange={() => toggleFilter('available')}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-success" />
                    Available ({vehicles.filter(v => v.status === 'available').length})
                  </div>
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={statusFilter.has('transit')}
                  onCheckedChange={() => toggleFilter('transit')}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-warning" />
                    In Transit ({vehicles.filter(v => v.status === 'transit').length})
                  </div>
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={statusFilter.has('attention')}
                  onCheckedChange={() => toggleFilter('attention')}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-destructive" />
                    Attention ({vehicles.filter(v => v.status === 'attention').length})
                  </div>
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <Button
            variant="secondary"
            size="sm"
            className="shadow-lg pointer-events-auto"
            onClick={fitAllVehicles}
          >
            <Maximize2 className="h-4 w-4 mr-1" />
            Fit All
          </Button>
        </div>

        {/* Google Map */}
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={SCOTTSDALE_CENTER}
          zoom={12}
          onLoad={onLoad}
          onUnmount={onUnmount}
          options={{
            styles: mapStyles,
            disableDefaultUI: true,
            zoomControl: true,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
          }}
        >
          {filteredVehicles.map((vehicle) => (
            <VehicleMarker
              key={vehicle.id}
              vehicle={vehicle}
              isSelected={selectedVehicleId === vehicle.id}
              onClick={() => handleVehicleSelect(vehicle.id)}
            />
          ))}
        </GoogleMap>

        {/* Legend */}
        <div className="absolute bottom-3 right-3 bg-card/90 backdrop-blur-sm border border-border rounded-lg p-2 shadow-lg">
          <div className="flex gap-3 text-[10px]">
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-primary" />
              Rented
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-success" />
              Available
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-warning" />
              Transit
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-destructive" />
              Alert
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
};
