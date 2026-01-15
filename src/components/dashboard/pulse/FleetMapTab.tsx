import { useMemo } from 'react';
import { FleetMap } from '@/components/maps/FleetMap';
import { VehicleMapData } from '@/components/maps/VehicleMarker';
import { useLocationFilteredFleet } from '@/hooks/useLocationFilteredFleet';
import { format, differenceInHours } from 'date-fns';

// Scottsdale area coordinates for demo data
const SCOTTSDALE_CENTER = { lat: 33.4942, lng: -111.9261 };

// Generate random position within ~10 mile radius of center
const generateDemoPosition = (index: number): { lat: number; lng: number } => {
  // Use seed based on index for consistent positions
  const seed = index * 7919; // Prime number for better distribution
  const angle = (seed % 360) * (Math.PI / 180);
  const radius = 0.05 + (seed % 100) / 1000; // 0.05 to 0.15 degrees (~3-10 miles)
  
  return {
    lat: SCOTTSDALE_CENTER.lat + Math.sin(angle) * radius,
    lng: SCOTTSDALE_CENTER.lng + Math.cos(angle) * radius,
  };
};

// Lot/headquarters position
const LOT_POSITION = { lat: 33.5088, lng: -111.8906 }; // Scottsdale Airpark area

export const FleetMapTab = () => {
  const { vehicles, bookings } = useLocationFilteredFleet();

  const vehicleMapData: VehicleMapData[] = useMemo(() => {
    const now = new Date();
    
    return vehicles.map((vehicle, index) => {
      // Find active booking for this vehicle
      const activeBooking = bookings.find(
        b => b.vehicle_id === vehicle.id &&
        (b.status === 'confirmed' || b.status === 'active') &&
        new Date(b.start_date) <= now &&
        new Date(b.end_date) >= now
      );

      // Determine status based on ops_status and booking
      let status: VehicleMapData['status'] = 'available';
      let position = LOT_POSITION;
      let customerName: string | undefined;
      let returnTime: string | undefined;

      if (vehicle.ops_status === 'renter_has' || activeBooking) {
        status = 'rented';
        position = generateDemoPosition(index);
        customerName = activeBooking?.customer_name;
        
        if (activeBooking) {
          const endDate = new Date(activeBooking.end_date);
          const hoursUntilReturn = differenceInHours(endDate, now);
          
          if (hoursUntilReturn < 0) {
            status = 'attention'; // Overdue
            returnTime = `${Math.abs(hoursUntilReturn)}h overdue`;
          } else if (hoursUntilReturn <= 24) {
            returnTime = format(endDate, 'h:mm a');
          } else {
            returnTime = format(endDate, 'MMM d');
          }
        }
      } else if (vehicle.ops_status === 'check_in_required' || vehicle.ops_status === 'check_out_ready') {
        status = 'transit';
        // Position near lot for transit vehicles
        position = {
          lat: LOT_POSITION.lat + (Math.random() - 0.5) * 0.01,
          lng: LOT_POSITION.lng + (Math.random() - 0.5) * 0.01,
        };
      } else if (vehicle.ops_status === 'needs_wash' || vehicle.ops_status === 'needs_fuel' || vehicle.ops_status === 'pending_inspection') {
        status = 'attention';
        // At lot but needs attention
        position = {
          lat: LOT_POSITION.lat + (Math.random() - 0.5) * 0.005,
          lng: LOT_POSITION.lng + (Math.random() - 0.5) * 0.005,
        };
      } else {
        // Available vehicles at lot
        position = {
          lat: LOT_POSITION.lat + (Math.random() - 0.5) * 0.003,
          lng: LOT_POSITION.lng + (Math.random() - 0.5) * 0.003,
        };
      }

      return {
        id: vehicle.id,
        name: `${vehicle.make} ${vehicle.model}`,
        status,
        lat: position.lat,
        lng: position.lng,
        customerName,
        returnTime,
      };
    });
  }, [vehicles, bookings]);

  return <FleetMap vehicles={vehicleMapData} />;
};
