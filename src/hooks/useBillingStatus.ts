import { useMemo } from 'react';
import { useTeam } from '@/contexts/TeamContext';
import { useFleet } from '@/contexts/FleetContext';

export type BillingState =
  | 'grandfathered'
  | 'pending_activation'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'unpaid'
  | 'canceled';

/** Tier bounds — mirrors the single server-side definition. */
export const TIER_BOUNDS = {
  pro: { min: 1, max: 15, label: 'Pro', perVehicle: { month: 39, year: 390 } },
  business: { min: 16, max: 50, label: 'Business', perVehicle: { month: 29, year: 290 } },
} as const;

export const ENTERPRISE_THRESHOLD = 50;

export type BillingTier = 'pro' | 'business' | 'enterprise';

export function tierForCount(count: number): BillingTier {
  const n = Math.max(1, Math.floor(count || 1));
  if (n <= TIER_BOUNDS.pro.max) return 'pro';
  if (n <= TIER_BOUNDS.business.max) return 'business';
  return 'enterprise';
}

export const TIER_LABELS: Record<BillingTier, string> = {
  pro: 'Pro',
  business: 'Business',
  enterprise: 'Enterprise',
};

export interface BillingStatus {
  state: BillingState;
  /** Nothing is owed and nothing is asked of them. */
  isGrandfathered: boolean;
  /** Needs to add a card before taking bookings or payments. */
  needsActivation: boolean;
  onTrial: boolean;
  trialEnd: Date | null;
  daysLeftInTrial: number | null;
  /** Cannot create bookings or take payments. */
  transactionsBlocked: boolean;
  /** Read-only across the board (unpaid/cancelled). */
  isReadOnly: boolean;
  /** Live active-vehicle count. */
  fleetCount: number;
  tier: BillingTier;
  tierLabel: string;
  /** Quantity Stripe is currently billing, when known. */
  billedQuantity: number | null;
  billingInterval: 'month' | 'year' | null;
  nextChargeAt: Date | null;
  cancelAtPeriodEnd: boolean;
  /** Monthly-equivalent price per vehicle for the current tier. */
  perVehicleRate: number | null;
  estimatedTotal: number | null;
  needsEnterpriseQuote: boolean;
}

export function useBillingStatus(): BillingStatus {
  const { currentTeam } = useTeam();
  const { vehicles } = useFleet();

  return useMemo(() => {
    const team = currentTeam as (typeof currentTeam & {
      billing_status?: string | null;
      billing_interval?: string | null;
      billed_quantity?: number | null;
      billed_tier?: string | null;
      current_period_end?: string | null;
      cancel_at_period_end?: boolean | null;
    }) | null;

    const fleetCount = Math.max(
      1,
      (vehicles ?? []).filter((v: any) => !v?.archived_at && !v?.trashed_at).length,
    );

    const raw = team?.is_demo_account ? 'grandfathered' : (team?.billing_status ?? 'grandfathered');
    const state = (raw as BillingState) ?? 'grandfathered';

    const trialEnd = team?.trial_end && state === 'trialing' ? new Date(team.trial_end) : null;
    const now = Date.now();
    const daysLeftInTrial = trialEnd
      ? Math.max(0, Math.ceil((trialEnd.getTime() - now) / 86_400_000))
      : null;

    const tier = (team?.billed_tier as BillingTier | undefined) ?? tierForCount(fleetCount);
    const interval = (team?.billing_interval as 'month' | 'year' | null) ?? null;
    const perVehicleRate =
      tier === 'enterprise'
        ? null
        : interval === 'year'
          ? TIER_BOUNDS[tier].perVehicle.year / 12
          : TIER_BOUNDS[tier].perVehicle.month;

    const quantity = team?.billed_quantity ?? Math.min(fleetCount, ENTERPRISE_THRESHOLD);

    return {
      state,
      isGrandfathered: state === 'grandfathered',
      needsActivation: state === 'pending_activation',
      onTrial: state === 'trialing',
      trialEnd,
      daysLeftInTrial,
      transactionsBlocked: ['pending_activation', 'unpaid', 'canceled'].includes(state),
      isReadOnly: ['unpaid', 'canceled'].includes(state),
      fleetCount,
      tier,
      tierLabel: TIER_LABELS[tier],
      billedQuantity: team?.billed_quantity ?? null,
      billingInterval: interval,
      nextChargeAt: team?.current_period_end ? new Date(team.current_period_end) : null,
      cancelAtPeriodEnd: Boolean(team?.cancel_at_period_end),
      perVehicleRate,
      estimatedTotal: perVehicleRate ? perVehicleRate * quantity : null,
      needsEnterpriseQuote: fleetCount > ENTERPRISE_THRESHOLD,
    };
  }, [currentTeam, vehicles]);
}
