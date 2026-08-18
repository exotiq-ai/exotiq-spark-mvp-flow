import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { moduleIdToPath, pathToModuleId } from '@/lib/moduleRoutes';

// Helper to scroll to top of page smoothly
const scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

export const useModuleNavigation = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const goToCustomerProfile = (customerId: string) => {
    navigate(moduleIdToPath('customers', { customerId }));
    scrollToTop();
  };

  const goToBookingDetails = (bookingId: string) => {
    navigate(moduleIdToPath('book', { bookingId }));
    scrollToTop();
  };

  const goToVehicleDetails = (vehicleId: string) => {
    navigate(moduleIdToPath('fleet', { vehicle: vehicleId }));
    scrollToTop();
  };

  const goToDamageReport = (damageClaimId: string) => {
    navigate(moduleIdToPath('vault', { view: 'damage', damageClaimId }));
    scrollToTop();
  };

  const goToInspection = (inspectionId: string) => {
    navigate(moduleIdToPath('fleet', { tab: 'inspections', inspectionId }));
    scrollToTop();
  };

  // `tab` is the param the Bookings page actually switches on. The booking id
  // rides under `paymentBookingId` so the page's "open this booking's card"
  // effect doesn't hijack the navigation.
  const goToPayments = (bookingId?: string) => {
    navigate(moduleIdToPath('book', { tab: 'payments', ...(bookingId && { paymentBookingId: bookingId }) }));
    scrollToTop();
  };

  const goToCustomerBookings = (customerId: string) => {
    navigate(moduleIdToPath('book', { customerId }));
    scrollToTop();
  };

  const goToTask = (taskId: string) => {
    navigate(moduleIdToPath('fleet', { taskId }));
    scrollToTop();
  };

  const goToWorkOrder = (workOrderId: string) => {
    navigate(moduleIdToPath('fleet', { tab: 'maintenance', workOrderId }));
    scrollToTop();
  };

  const goToMaintenance = (maintenanceId?: string) => {
    const params: Record<string, string> = { tab: 'maintenance' };
    if (maintenanceId) params.maintenanceId = maintenanceId;
    navigate(moduleIdToPath('fleet', params));
    scrollToTop();
  };

  const getCurrentModule = () => pathToModuleId(location.pathname);
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
