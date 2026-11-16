import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { useUserRole } from '@/hooks/useUserRole';
import { fleetPricingAccess, type PricingAccess } from '@/lib/fleetPricingAccess';

/** Fleet → Pricing permissions for the signed-in user (see fleetPricingAccess). */
export function useFleetPricingAccess(): PricingAccess & { loading: boolean } {
  const { user } = useAuth();
  const { currentTeam } = useTeam();
  const { isManagerOrHigher, loading } = useUserRole();
  return {
    ...fleetPricingAccess({ isManagerOrHigher, userId: user?.id, teamOwnerId: currentTeam?.owner_id }),
    loading,
  };
}
