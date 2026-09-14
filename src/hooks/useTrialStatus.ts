import { useMemo } from 'react';
import { useTeam } from '@/contexts/TeamContext';
import { useAuth } from '@/contexts/AuthContext';

export interface TrialStatus {
  /** Team is on a tracked trial. Grandfathered teams return false. */
  onTrial: boolean;
  /** Trial period has elapsed. */
  trialExpired: boolean;
  /** Whole days remaining (>=0). null when not on a trial. */
  daysLeft: number | null;
  /** Write actions should be blocked (unpaid, cancelled, or never activated). */
  isReadOnly: boolean;
  trialEnd: Date | null;
  /** Card still needs to be added before bookings and payments work. */
  needsActivation: boolean;
}

export function useTrialStatus(): TrialStatus {
  const { currentTeam } = useTeam();
  const { subscription } = useAuth();

  const billingStatus = (currentTeam as any)?.billing_status as string | null | undefined;
  const trialEndRaw = currentTeam?.trial_end ?? null;
  const isDemo = Boolean(currentTeam?.is_demo_account);

  return useMemo(() => {
    // Founding operators and demo workspaces are never nagged.
    if (isDemo || billingStatus === 'grandfathered') {
      return {
        onTrial: false,
        trialExpired: false,
        daysLeft: null,
        isReadOnly: false,
        trialEnd: null,
        needsActivation: false,
      };
    }

    const end = trialEndRaw ? new Date(trialEndRaw) : null;
    const now = Date.now();
    const onTrial = billingStatus === 'trialing' && !!end;
    const trialExpired = !!end && end.getTime() < now && billingStatus !== 'active';
    const daysLeft =
      onTrial && end ? Math.max(0, Math.ceil((end.getTime() - now) / (1000 * 60 * 60 * 24))) : null;

    const needsActivation = billingStatus === 'pending_activation';
    const isReadOnly =
      billingStatus === 'unpaid' ||
      billingStatus === 'canceled' ||
      needsActivation ||
      (trialExpired && !subscription.subscribed);

    return { onTrial, trialExpired, daysLeft, isReadOnly, trialEnd: end, needsActivation };
  }, [billingStatus, trialEndRaw, isDemo, subscription.subscribed]);
}
