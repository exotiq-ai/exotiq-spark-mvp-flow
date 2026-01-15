import { useMemo } from 'react';
import { FleetMapPlaceholder } from '@/components/maps/FleetMapPlaceholder';
import { VehicleMapData } from '@/components/maps/VehicleMarker';
import { useLocationFilteredFleet } from '@/hooks/useLocationFilteredFleet';
import { differenceInHours } from 'date-fns';

export const FleetMapTab = () => {
  const { vehicles, bookings } = useLocationFilteredFleet();

  const vehicleMapData: VehicleMapData[] = useMemo(() => {
    const now = new Date();
    
    return vehicles.map((vehicle) => {
      // Find active booking for this vehicle
      const activeBooking = bookings.find(
        b => b.vehicle_id === vehicle.id &&
        (b.status === 'confirmed' || b.status === 'active') &&
        new Date(b.start_date) <= now &&
        new Date(b.end_date) >= now
      );

      // Determine status based on ops_status and booking
      let status: VehicleMapData['status'] = 'available';
      let customerName: string | undefined;
      let returnTime: string | undefined;

      if (vehicle.ops_status === 'renter_has' || activeBooking) {
        status = 'rented';
        customerName = activeBooking?.customer_name;
        
        if (activeBooking) {
          const endDate = new Date(activeBooking.end_date);
          const hoursUntilReturn = differenceInHours(endDate, now);
          
          if (hoursUntilReturn < 0) {
            status = 'attention'; // Overdue
            returnTime = `${Math.abs(hoursUntilReturn)}h overdue`;
          } else if (hoursUntilReturn <= 24) {
            returnTime = `${hoursUntilReturn}h left`;
          } else {
            returnTime = `${Math.floor(hoursUntilReturn / 24)}d left`;
          }
        }
      } else if (vehicle.ops_status === 'check_in_required' || vehicle.ops_status === 'check_out_ready') {
        status = 'transit';
      } else if (vehicle.ops_status === 'needs_wash' || vehicle.ops_status === 'needs_fuel' || vehicle.ops_status === 'pending_inspection') {
        status = 'attention';
      }

      return {
        id: vehicle.id,
        name: `${vehicle.make} ${vehicle.model}`,
        status,
        lat: 33.4942 + (Math.random() - 0.5) * 0.1, // Placeholder coords
        lng: -111.9261 + (Math.random() - 0.5) * 0.1,
        customerName,
        returnTime,
      };
    });
  }, [vehicles, bookings]);

  // Use the placeholder map component for demo purposes
  return <FleetMapPlaceholder vehicles={vehicleMapData} />;
};
