import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useMarketplaceReadiness } from '@/hooks/useMarketplaceReadiness';

export type ReadinessRow = {
  key: string;
  label: string;
  hint: string;
  to: string;
  done: boolean;
  /** Also required before the workspace can be listed on the marketplace. */
  marketplaceOnly?: boolean;
};

type LocationTaxRow = {
  id: string;
  name: string | null;
  tax_rate_percent: number | null;
  is_active: boolean | null;
};

/**
 * Reads the same checks the marketplace gate uses, plus the pickup-location and
 * tax checks that live outside it, and turns them into two plain-language
 * tracks: what's needed to take a booking, and what's needed to be listed.
 */
export const useSetupReadiness = (teamId: string | null | undefined) => {
  const marketplace = useMarketplaceReadiness(teamId);

  const locations = useQuery({
    queryKey: ['setup-readiness-locations', teamId],
    enabled: !!teamId,
    queryFn: async () => {
      const [locRes, teamRes] = await Promise.all([
        supabase
          .from('locations')
          .select('id, name, tax_rate_percent, is_active')
          .eq('team_id', teamId as string),
        supabase
          .from('teams')
          .select('tax_rate_percent')
          .eq('id', teamId as string)
          .maybeSingle(),
      ]);
      if (locRes.error) throw locRes.error;
      if (teamRes.error) throw teamRes.error;
      return {
        locations: (locRes.data ?? []) as LocationTaxRow[],
        teamTaxRate: (teamRes.data?.tax_rate_percent ?? null) as number | null,
      };
    },
  });

  const rows = useMemo<ReadinessRow[]>(() => {
    const checks = marketplace.data?.team_checks ?? {};
    const locs = (locations.data?.locations ?? []).filter(l => l.is_active !== false);
    const hasLocation = locs.length > 0;
    const teamTax = locations.data?.teamTaxRate;
    const taxSet =
      (teamTax !== null && teamTax !== undefined) ||
      locs.some(l => l.tax_rate_percent !== null && l.tax_rate_percent !== undefined);

    return [
      { key: 'business_name_set', label: 'Business name', hint: 'Shown on invoices and your booking page', to: '/dashboard/settings?tab=business', done: checks.business_name_set === true },
      { key: 'owner_email_set', label: 'Contact email', hint: 'Where booking requests are sent', to: '/dashboard/settings?tab=business', done: checks.owner_email_set === true },
      { key: 'terms_accepted', label: 'Terms accepted', hint: 'Needed before you can take real bookings', to: '/dashboard/settings?tab=legal', done: checks.terms_accepted === true },
      { key: 'pickup_location', label: 'A pickup location', hint: 'Where renters collect the car', to: '/dashboard/settings?tab=locations', done: hasLocation },
      { key: 'tax_configured', label: 'Tax rate', hint: 'So quotes and invoices total correctly', to: '/dashboard/settings?tab=locations', done: taxSet },
      { key: 'has_ready_vehicle', label: 'A bookable vehicle', hint: 'Photos, daily rate and pickup location', to: '/dashboard/fleet', done: checks.has_ready_vehicle === true },

      { key: 'business_address_set', label: 'Business address', hint: 'Required for tax and payouts', to: '/dashboard/settings?tab=business', done: checks.business_address_set === true, marketplaceOnly: true },
      { key: 'logo_set', label: 'Logo', hint: 'Used across your emails and booking page', to: '/dashboard/settings?tab=business', done: checks.logo_set === true, marketplaceOnly: true },
      { key: 'stripe_charges_enabled', label: 'Card payments', hint: 'Finish payment setup to charge renters', to: '/dashboard/settings?tab=payments', done: checks.stripe_charges_enabled === true, marketplaceOnly: true },
      { key: 'stripe_payouts_enabled', label: 'Payouts', hint: 'Where your money lands', to: '/dashboard/settings?tab=payments', done: checks.stripe_payouts_enabled === true, marketplaceOnly: true },
    ];
  }, [marketplace.data, locations.data]);

  const bookingRows = rows.filter(r => !r.marketplaceOnly);
  const bookingDone = bookingRows.filter(r => r.done).length;
  const marketplaceDone = rows.filter(r => r.done).length;

  return {
    rows,
    bookingRows,
    bookingDone,
    bookingTotal: bookingRows.length,
    marketplaceDone,
    marketplaceTotal: rows.length,
    complete: marketplaceDone === rows.length,
    isLoading: marketplace.isLoading || locations.isLoading,
  };
};
