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

  const goToTask = (taskId: string) => {
    setSearchParams({ module: 'fleet', taskId });
    scrollToTop();
  };

  const goToWorkOrder = (workOrderId: string) => {
    setSearchParams({ module: 'fleet', tab: 'maintenance', workOrderId });
    scrollToTop();
  };

  const goToMaintenance = (maintenanceId?: string) => {
    const params: Record<string, string> = { module: 'fleet', tab: 'maintenance' };
    if (maintenanceId) params.maintenanceId = maintenanceId;
    setSearchParams(params);
    scrollToTop();
  };

  const getCurrentModule = () => searchParams.get('module') || 'core';
  const getCurrentView = () => searchParams.get('view');
  const getCurrentCustomerId = () => searchParams.get('customerId');
  const getCurrentBookingId = () => searchParams.get('bookingId');
  const getCurrentVehicleId = () => searchParams.get('vehicleId');
  const getCurrentTaskId = () => searchParams.get('taskId');
  const getCurrentWorkOrderId = () => searchParams.get('workOrderId');
  const getCurrentTab = () => searchParams.get('tab');

  return {
    goToCustomerProfile,
    goToBookingDetails,
    goToVehicleDetails,
    goToDamageReport,
    goToInspection,
    goToPayments,
    goToCustomerBookings,
    goToTask,
    goToWorkOrder,
    goToMaintenance,
    getCurrentModule,
    getCurrentView,
    getCurrentCustomerId,
    getCurrentBookingId,
    getCurrentVehicleId,
    getCurrentTaskId,
    getCurrentWorkOrderId,
    getCurrentTab,
  };
};
