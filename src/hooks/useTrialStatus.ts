import { useMemo } from 'react';
import { useTeam } from '@/contexts/TeamContext';
import { useAuth } from '@/contexts/AuthContext';

export interface TrialStatus {
  /** Team is on a tracked trial (trial_end populated). Grandfathered teams return false. */
  onTrial: boolean;
  /** Trial period has elapsed. */
  trialExpired: boolean;
  /** Whole days remaining (>=0). null when not on a trial. */
  daysLeft: number | null;
  /** Trial expired AND no active paid subscription → write actions should be blocked. */
  isReadOnly: boolean;
  trialEnd: Date | null;
}

export function useTrialStatus(): TrialStatus {
  const { currentTeam } = useTeam();
  const { subscription } = useAuth();

  return useMemo(() => {
    const end = currentTeam?.trial_end ? new Date(currentTeam.trial_end) : null;
    const onTrial = !!end;
    const now = Date.now();
    const trialExpired = !!end && end.getTime() < now;
    const daysLeft = end
      ? Math.max(0, Math.ceil((end.getTime() - now) / (1000 * 60 * 60 * 24)))
      : null;
    const isReadOnly = trialExpired && !subscription.subscribed;
    return { onTrial, trialExpired, daysLeft, isReadOnly, trialEnd: end };
  }, [currentTeam?.trial_end, subscription.subscribed]);
}
