import { useMemo } from 'react';
import { useFleet } from '@/contexts/FleetContext';
import { useTeam } from '@/contexts/TeamContext';
import { useTourData } from '@/contexts/TourDataContext';

/**
 * Hook that provides fleet data filtered by the currently selected location.
 * When tour is active, returns demo snapshot data instead.
 * When "All Locations" is selected, returns all data.
 * When a specific location is selected, filters vehicles by location_id
 * and bookings by pickup_location_id.
 */
export const useLocationFilteredFleet = () => {
  const fleet = useFleet();
  const { selectedLocationId, currentLocation, locations } = useTeam();
  const { tourActive, demoSnapshot } = useTourData();

  // Filter vehicles by selected location (or use demo data when tour active)
  const filteredVehicles = useMemo(() => {
    if (tourActive && demoSnapshot) return demoSnapshot.vehicles;
    if (selectedLocationId === 'all') {
      return fleet.vehicles;
    }
    return fleet.vehicles.filter(v => v.location_id === selectedLocationId);
  }, [fleet.vehicles, selectedLocationId, tourActive, demoSnapshot]);

  // Filter bookings by pickup location (or use demo data)
  const filteredBookings = useMemo(() => {
    if (tourActive && demoSnapshot) return demoSnapshot.bookings;
    if (selectedLocationId === 'all') {
      return fleet.bookings;
    }
    // Filter by pickup_location_id or by vehicle's location
    return fleet.bookings.filter(b => {
      if (b.pickup_location_id) {
        return b.pickup_location_id === selectedLocationId;
      }
      const vehicle = fleet.vehicles.find(v => v.id === b.vehicle_id);
      if (!vehicle && !b.vehicle_id) {
        return true;
      }
      return vehicle?.location_id === selectedLocationId;
    });
  }, [fleet.bookings, fleet.vehicles, selectedLocationId, tourActive, demoSnapshot]);

  // Filter maintenance by location_id or vehicle's location
  const filteredMaintenance = useMemo(() => {
    if (selectedLocationId === 'all') {
      return fleet.maintenance;
    }
    return fleet.maintenance.filter(m => {
      // First check if maintenance has its own location_id
      if (m.location_id) {
        return m.location_id === selectedLocationId;
      }
      // Fall back to vehicle's location
      const vehicle = fleet.vehicles.find(v => v.id === m.vehicle_id);
      return vehicle?.location_id === selectedLocationId;
    });
  }, [fleet.maintenance, fleet.vehicles, selectedLocationId]);

  // Filter damage claims by vehicle's location
  const filteredDamageClaims = useMemo(() => {
    if (selectedLocationId === 'all') {
      return fleet.damageClaims;
    }
    return fleet.damageClaims.filter(c => {
      const vehicle = fleet.vehicles.find(v => v.id === c.vehicle_id);
      return vehicle?.location_id === selectedLocationId;
    });
  }, [fleet.damageClaims, fleet.vehicles, selectedLocationId]);

  // Filter inspections by vehicle's location
  const filteredInspections = useMemo(() => {
    if (selectedLocationId === 'all') {
      return fleet.inspections;
    }
    return fleet.inspections.filter(i => {
      const vehicle = fleet.vehicles.find(v => v.id === i.vehicle_id);
      return vehicle?.location_id === selectedLocationId;
    });
  }, [fleet.inspections, fleet.vehicles, selectedLocationId]);

  // Filter payments by booking's location
  const filteredPayments = useMemo(() => {
    if (selectedLocationId === 'all') {
      return fleet.payments;
    }
    return fleet.payments.filter(p => {
      const booking = fleet.bookings.find(b => b.id === p.booking_id);
      if (booking?.pickup_location_id) {
        return booking.pickup_location_id === selectedLocationId;
      }
      const vehicle = fleet.vehicles.find(v => v.id === booking?.vehicle_id);
      return vehicle?.location_id === selectedLocationId;
    });
  }, [fleet.payments, fleet.bookings, fleet.vehicles, selectedLocationId]);

  // Calculate location-filtered revenue
  const filteredRevenue = useMemo(() => {
    const confirmedBookings = filteredBookings.filter(
      b => b.status === 'confirmed' || b.status === 'completed'
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayRevenue = confirmedBookings
      .filter(b => new Date(b.start_date) >= today)
      .reduce((sum, b) => sum + parseFloat(b.total_value?.toString() || '0'), 0);

    const monthRevenue = confirmedBookings.reduce(
      (sum, b) => sum + parseFloat(b.total_value?.toString() || '0'),
      0
    );

    return {
      today: todayRevenue,
      month: monthRevenue,
      change: fleet.revenue.change, // Keep the same change percentage
    };
  }, [filteredBookings, fleet.revenue.change]);

  // Get location-specific metrics
  const locationMetrics = useMemo(() => {
    const vehicleCount = filteredVehicles.length;
    const activeBookings = filteredBookings.filter(
      b => b.status === 'active' || b.status === 'confirmed'
    ).length;
    const utilizationRate = vehicleCount > 0 
      ? Math.round((activeBookings / vehicleCount) * 100)
      : 0;

    return {
      vehicleCount,
      activeBookings,
      utilizationRate,
      pendingMaintenance: filteredMaintenance.filter(m => m.status === 'scheduled').length,
      openDamageClaims: filteredDamageClaims.filter(c => c.claim_status === 'open').length,
    };
  }, [filteredVehicles, filteredBookings, filteredMaintenance, filteredDamageClaims]);

  // When tour is active, override with demo data
  const effectiveRevenue = tourActive && demoSnapshot ? demoSnapshot.revenue : filteredRevenue;
  const effectiveCustomers = tourActive && demoSnapshot ? demoSnapshot.customers : fleet.customers;
  const effectivePayments = tourActive && demoSnapshot ? demoSnapshot.payments : filteredPayments;

  return {
    // Filtered data
    vehicles: filteredVehicles,
    bookings: filteredBookings,
    maintenance: filteredMaintenance,
    damageClaims: filteredDamageClaims,
    inspections: filteredInspections,
    payments: effectivePayments,
    revenue: effectiveRevenue,

    // Unfiltered data (for operations that need all data)
    allVehicles: tourActive && demoSnapshot ? demoSnapshot.vehicles : fleet.vehicles,
    allBookings: tourActive && demoSnapshot ? demoSnapshot.bookings : fleet.bookings,

    // Location context
    selectedLocationId,
    currentLocation,
    locations,
    isAllLocations: selectedLocationId === 'all',

    // Location-specific metrics
    locationMetrics,

    // Pass through other fleet context values unchanged
    documents: fleet.documents,
    messages: fleet.messages,
    customers: effectiveCustomers,
    customerNotes: fleet.customerNotes,
    loading: tourActive ? false : fleet.loading,
    error: tourActive ? null : fleet.error,

    // Pass through all actions
    applyPriceOptimization: fleet.applyPriceOptimization,
    createVehicle: fleet.createVehicle,
    deleteVehicle: fleet.deleteVehicle,
    deleteVehicles: fleet.deleteVehicles,
    createBooking: fleet.createBooking,
    updateBookingStatus: fleet.updateBookingStatus,
    updateBookingVehicle: fleet.updateBookingVehicle,
    updateBookingDetails: fleet.updateBookingDetails,
    uploadDocument: fleet.uploadDocument,
    deleteDocument: fleet.deleteDocument,
    createMaintenance: fleet.createMaintenance,
    sendMessage: fleet.sendMessage,
    generateReport: fleet.generateReport,
    createCustomer: fleet.createCustomer,
    updateCustomer: fleet.updateCustomer,
    addCustomerNote: fleet.addCustomerNote,
    blacklistCustomer: fleet.blacklistCustomer,
    createInspection: fleet.createInspection,
    createInspectionWithPhotos: fleet.createInspectionWithPhotos,
    createDamageClaim: fleet.createDamageClaim,
    createPayment: fleet.createPayment,
    refreshData: fleet.refreshData,
    refreshBookings: fleet.refreshBookings,
    refreshPayments: fleet.refreshPayments,
    refreshDamageClaims: fleet.refreshDamageClaims,
    refreshCustomers: fleet.refreshCustomers,
  };
};
