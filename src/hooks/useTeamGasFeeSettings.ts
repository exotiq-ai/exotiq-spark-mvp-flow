import { useTeam } from '@/contexts/TeamContext';
import { gasFeeFromTeam } from '@/lib/teamPricingDefaults';

interface GasFeeConfig {
  gasFeeEnabled: boolean;
  gasFeeAmount: number;
  gasFeeDefaultOn: boolean;
  isLoading: boolean;
}

/**
 * The team's gas / re-fuelling fee (teams.gas_fee_*), the same for every staff member.
 * It used to be read from the signed-in person's own user_settings, so two people could charge different fees.
 * Until a team row carries the columns (migration 20261116010000), the old built-in defaults apply.
 */
export function useTeamGasFeeSettings(): GasFeeConfig {
  const { currentTeam, loading } = useTeam();
  return { ...gasFeeFromTeam(currentTeam), isLoading: loading };
}
