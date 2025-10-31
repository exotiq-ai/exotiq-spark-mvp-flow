import { useNavigate } from 'react-router-dom';

export const useModuleNavigation = () => {
  const navigate = useNavigate();
  
  const goToCustomerProfile = (customerId: string) => {
    navigate(`/dashboard?module=core&customerId=${customerId}`);
  };
  
  const goToBooking = (bookingId: string) => {
    navigate(`/dashboard?module=book&bookingId=${bookingId}`);
  };
  
  const goToVehicle = (vehicleId: string) => {
    navigate(`/dashboard?module=motoriq&vehicleId=${vehicleId}`);
  };
  
  const goToDocument = (documentId: string) => {
    navigate(`/dashboard?module=vault&documentId=${documentId}`);
  };
  
  const goToMaintenance = (maintenanceId: string) => {
    navigate(`/dashboard?module=pulse&maintenanceId=${maintenanceId}`);
  };

  const goToModule = (module: string, params?: Record<string, string>) => {
    const queryParams = new URLSearchParams({ module, ...params }).toString();
    navigate(`/dashboard?${queryParams}`);
  };
  
  return {
    goToCustomerProfile,
    goToBooking,
    goToVehicle,
    goToDocument,
    goToMaintenance,
    goToModule
  };
};
