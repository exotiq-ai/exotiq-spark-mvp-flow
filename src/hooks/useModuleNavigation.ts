import { useSearchParams } from 'react-router-dom';

// Helper to scroll to top of page smoothly
const scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

export const useModuleNavigation = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const goToCustomerProfile = (customerId: string) => {
    setSearchParams({ 
      module: 'core', 
      view: 'crm', 
      customerId 
    });
    scrollToTop();
  };

  const goToBookingDetails = (bookingId: string) => {
    setSearchParams({ 
      module: 'book', 
      bookingId 
    });
    scrollToTop();
  };

  const goToVehicleDetails = (vehicleId: string) => {
    setSearchParams({ 
      module: 'core', 
      vehicleId 
    });
    scrollToTop();
  };

  const goToDamageReport = (damageClaimId: string) => {
    setSearchParams({ 
      module: 'vault', 
      view: 'damage', 
      damageClaimId 
    });
    scrollToTop();
  };

  const goToInspection = (inspectionId: string) => {
    setSearchParams({ 
      module: 'vault', 
      view: 'inspections', 
      inspectionId 
    });
    scrollToTop();
  };

  const goToPayments = (bookingId?: string) => {
    setSearchParams({ 
      module: 'book', 
      view: 'payments',
      ...(bookingId && { bookingId })
    });
    scrollToTop();
  };

  const goToCustomerBookings = (customerId: string) => {
    setSearchParams({ 
      module: 'book', 
      customerId 
    });
    scrollToTop();
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
