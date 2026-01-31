import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useFleet } from '@/contexts/FleetContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Search, Car, Check, DollarSign } from 'lucide-react';

interface LinkVehicleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  currentVehicleName?: string;
  startDate: string;
  endDate: string;
  onVehicleLinked: () => void;
}

export function LinkVehicleDialog({
  open,
  onOpenChange,
  bookingId,
  currentVehicleName,
  startDate,
  endDate,
  onVehicleLinked
}: LinkVehicleDialogProps) {
  const { vehicles, bookings, refreshData } = useFleet();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [isLinking, setIsLinking] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);

  // Filter available vehicles (not booked during this period)
  const availableVehicles = useMemo(() => {
    const bookingStart = new Date(startDate);
    const bookingEnd = new Date(endDate);
    
    // Get vehicle IDs that are already booked during this period
    const bookedVehicleIds = new Set(
      bookings
        .filter(b => {
          if (b.id === bookingId) return false; // Exclude current booking
          if (b.status === 'cancelled') return false;
          
          const bStart = new Date(b.start_date);
          const bEnd = new Date(b.end_date);
          
          // Check for overlap
          return bStart < bookingEnd && bEnd > bookingStart;
        })
        .map(b => b.vehicle_id)
        .filter(Boolean)
    );
    
    // Filter vehicles
    return vehicles.filter(v => {
      // Exclude already booked vehicles
      if (bookedVehicleIds.has(v.id)) return false;
      
      // Apply search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          v.name?.toLowerCase().includes(query) ||
          v.make?.toLowerCase().includes(query) ||
          v.model?.toLowerCase().includes(query) ||
          v.license_plate?.toLowerCase().includes(query)
        );
      }
      
      return true;
    });
  }, [vehicles, bookings, bookingId, startDate, endDate, searchQuery]);

  const handleLinkVehicle = async (vehicleId: string) => {
    setIsLinking(true);
    setSelectedVehicleId(vehicleId);
    
    try {
      const vehicle = vehicles.find(v => v.id === vehicleId);
      
      const { error } = await supabase
        .from('bookings')
        .update({ 
          vehicle_id: vehicleId,
          vehicle_name: null // Clear stored name once linked to actual vehicle
        })
        .eq('id', bookingId);
      
      if (error) throw error;
      
      toast({
        title: 'Vehicle linked',
        description: `Successfully linked ${vehicle?.name || 'vehicle'} to this booking.`
      });
      
      await refreshData();
      onVehicleLinked();
      onOpenChange(false);
    } catch (error) {
      console.error('Error linking vehicle:', error);
      toast({
        title: 'Failed to link vehicle',
        description: 'Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsLinking(false);
      setSelectedVehicleId(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-500/10 text-green-500 border-green-500/30';
      case 'rented': return 'bg-blue-500/10 text-blue-500 border-blue-500/30';
      case 'maintenance': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30';
      default: return 'bg-muted/10 text-muted-foreground';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Car className="h-5 w-5 text-primary" />
            Link Vehicle
          </DialogTitle>
          <DialogDescription>
            Select an available vehicle to link to this booking.
            {currentVehicleName && (
              <span className="block mt-1 text-muted-foreground">
                Imported as: <strong>{currentVehicleName}</strong>
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, make, model, or plate..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Availability Note */}
          <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
            Showing vehicles available from {new Date(startDate).toLocaleDateString()} to {new Date(endDate).toLocaleDateString()}
          </div>

          {/* Vehicle List */}
          <ScrollArea className="h-[300px] rounded-md border">
            {availableVehicles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Car className="h-10 w-10 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No available vehicles found</p>
                {searchQuery && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Try a different search term
                  </p>
                )}
              </div>
            ) : (
              <div className="divide-y">
                {availableVehicles.map((vehicle) => (
                  <div
                    key={vehicle.id}
                    className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{vehicle.name}</p>
                        <Badge variant="outline" className={getStatusColor(vehicle.status || 'available')}>
                          {vehicle.status || 'available'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span>{vehicle.year} {vehicle.make} {vehicle.model}</span>
                        {vehicle.license_plate && (
                          <span className="font-mono">{vehicle.license_plate}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-primary mt-1">
                        <DollarSign className="h-3 w-3" />
                        {Number(vehicle.current_rate || 0).toLocaleString()}/day
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleLinkVehicle(vehicle.id)}
                      disabled={isLinking}
                    >
                      {isLinking && selectedVehicleId === vehicle.id ? (
                        <span className="animate-spin">...</span>
                      ) : (
                        <>
                          <Check className="h-3 w-3 mr-1" />
                          Link
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
