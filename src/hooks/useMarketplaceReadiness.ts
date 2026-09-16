import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type MarketplaceReadinessData = {
  team_id: string;
  ready: boolean;
  real_ready?: boolean;
  test_mode?: boolean;
  team_checks: Record<string, boolean>;
  vehicles: Array<{
    id: string;
    label: string;
    ready: boolean;
    marketplace_visible: boolean;
    checks?: Record<string, boolean>;
    suggestions?: Record<string, boolean>;
    photo_count?: number;
    hero_count?: number;
  }>;
  /** Vehicles that pass every check AND are already switched on for the marketplace. */
  ready_vehicle_count: number;
  published_vehicle_count?: number;
  /** Vehicles that pass every check, whether published yet or not. */
  eligible_vehicle_count?: number;
  trashed_marketplace_visible_count?: number;
  checked_at: string;
};

export const CHECK_LABELS: Record<string, string> = {
  stripe_charges_enabled: 'Stripe charges enabled',
  stripe_payouts_enabled: 'Stripe payouts enabled',
  logo_set: 'Team logo uploaded',
  business_name_set: 'Business name set',
  business_address_set: 'Business address on file',
  owner_email_set: 'Owner contact email',
  terms_accepted: 'Terms accepted by owner',
  not_demo: 'Not a demo account',
  has_ready_vehicle: 'At least one vehicle ready to publish',
};

/** Plain-English fix for each failing account-level check. */
export const CHECK_FIX_HINTS: Record<string, string> = {
  stripe_charges_enabled: 'Finish payout onboarding so this workspace can take card payments',
  stripe_payouts_enabled: 'Finish payout onboarding so funds can be paid out',
  logo_set: 'Upload a business logo in Team Settings',
  business_name_set: 'Add the business name in Team Settings',
  business_address_set: 'Add the business address in Team Settings',
  owner_email_set: 'The workspace owner needs a contact email on file',
  terms_accepted: 'The owner must accept the current terms',
  not_demo: 'This is a demo workspace — switch it out of demo mode to go live',
  has_ready_vehicle: 'No vehicle passes every check yet — see the per-vehicle list below',
};

export const VEHICLE_CHECK_LABELS: Record<string, string> = {
  hero_photo_set: 'Hero photo uploaded',
  photos_min_5: 'At least 5 photos',
  rate_set: 'Daily rate set',
  location_set: 'Pickup location set',
  status_available: 'Status is available',
  not_archived: 'Not archived',
};

export const VEHICLE_SUGGESTION_LABELS: Record<string, string> = {
  hero_angle_front_quarter: 'Hero is a front 3/4 (45°) shot',
};


export const useMarketplaceReadiness = (teamId: string | null | undefined) => {
  return useQuery({
    queryKey: ['marketplace-readiness', teamId],
    enabled: !!teamId,
    queryFn: async (): Promise<MarketplaceReadinessData> => {
      const { data, error } = await supabase.rpc('get_marketplace_readiness', {
        p_team_id: teamId,
      });
      if (error) throw error;
      return (data as unknown as MarketplaceReadinessData) ?? {
        team_id: teamId as string,
        ready: false,
        team_checks: {},
        vehicles: [],
        ready_vehicle_count: 0,
        checked_at: new Date().toISOString(),
      };
    },
  });
};

export const useMarketplaceFeeStatus = (teamId: string | null | undefined) => {
  return useQuery({
    queryKey: ['marketplace-readiness-fee', teamId],
    enabled: !!teamId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('platform_fee_confirmed_at, platform_fee_percent, marketplace_visible, marketplace_request_status, marketplace_requested_at, marketplace_rejection_reason, slug')
        .eq('id', teamId as string)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
};
