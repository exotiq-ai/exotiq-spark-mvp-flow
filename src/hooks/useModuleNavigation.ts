import { useSearchParams } from 'react-router-dom';

export const useModuleNavigation = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const goToCustomerProfile = (customerId: string) => {
    setSearchParams({ 
      module: 'core', 
      view: 'crm', 
      customerId 
    });
  };

  const goToBookingDetails = (bookingId: string) => {
    setSearchParams({ 
      module: 'book', 
      bookingId 
    });
  };

  const goToVehicleDetails = (vehicleId: string) => {
    setSearchParams({ 
      module: 'core', 
      vehicleId 
    });
  };

  const goToDamageReport = (damageClaimId: string) => {
    setSearchParams({ 
      module: 'vault', 
      view: 'damage', 
      damageClaimId 
    });
  };

  const goToInspection = (inspectionId: string) => {
    setSearchParams({ 
      module: 'vault', 
      view: 'inspections', 
      inspectionId 
    });
  };

  const goToPayments = (bookingId?: string) => {
    setSearchParams({ 
      module: 'book', 
      view: 'payments',
      ...(bookingId && { bookingId })
    });
  };

  const goToCustomerBookings = (customerId: string) => {
    setSearchParams({ 
      module: 'book', 
      customerId 
    });
  };

  const getCurrentModule = () => searchParams.get('module') || 'core';
  const getCurrentView = () => searchParams.get('view');
  const getCurrentCustomerId = () => searchParams.get('customerId');
  const getCurrentBookingId = () => searchParams.get('bookingId');
  const getCurrentVehicleId = () => searchParams.get('vehicleId');

  return {
    goToCustomerProfile,
    goToBookingDetails,
    goToVehicleDetails,
    goToDamageReport,
    goToInspection,
    goToPayments,
    goToCustomerBookings,
    getCurrentModule,
    getCurrentView,
    getCurrentCustomerId,
    getCurrentBookingId,
    getCurrentVehicleId,
  };
};
