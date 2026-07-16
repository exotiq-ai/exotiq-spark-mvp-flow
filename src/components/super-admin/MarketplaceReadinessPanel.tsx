/**
 * MarketplaceReadinessPanel
 *
 * Read-only checklist rendered inside the expanded team row of
 * MarketplaceVisibilityTab. Calls `get_marketplace_readiness(team_id)`
 * and shows green/red pills per check plus a per-vehicle summary.
 *
 * The DB trigger `enforce_marketplace_readiness` only fires when the
 * session GUC `app.marketplace_gate_enforced` = 'on', so this panel is
 * safe to ship ahead of enforcement.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface Props {
  teamId: string;
}

type Readiness = {
  ready: boolean;
  team_checks: Record<string, boolean>;
  vehicles: Array<{ id: string; label: string; ready: boolean; marketplace_visible: boolean }>;
  ready_vehicle_count: number;
};

const CHECK_LABELS: Record<string, string> = {
  stripe_charges_enabled: 'Stripe charges enabled',
  stripe_payouts_enabled: 'Stripe payouts enabled',
  logo_set: 'Team logo uploaded',
  business_name_set: 'Business name set',
  business_address_set: 'Business address on file',
  owner_email_set: 'Owner contact email',
  terms_accepted: 'Terms accepted by owner',
  not_demo: 'Not a demo account',
  has_ready_vehicle: 'At least one publish-ready vehicle',
};

export const MarketplaceReadinessPanel = ({ teamId }: Props) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['marketplace-readiness', teamId],
    queryFn: async (): Promise<Readiness> => {
      const { data, error } = await supabase.rpc('get_marketplace_readiness', {
        p_team_id: teamId,
      });
      if (error) throw error;
      return data as unknown as Readiness;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <Loader2 className="h-3 w-3 animate-spin" /> Checking readiness…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-xs text-destructive py-2">
        Failed to load readiness: {(error as Error | undefined)?.message ?? 'unknown error'}
      </div>
    );
  }

  const entries = Object.entries(data.team_checks ?? {});
  const passing = entries.filter(([, v]) => !!v).length;

  return (
    <div className="rounded-md border bg-background p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Go-live checklist</div>
        <Badge variant={data.ready ? 'default' : 'secondary'} className="text-xs">
          {passing}/{entries.length} checks passing
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
        {entries.map(([key, ok]) => (
          <div key={key} className="flex items-center gap-2 text-xs">
            {ok ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-destructive" />
            )}
            <span className={ok ? 'text-foreground' : 'text-muted-foreground'}>
              {CHECK_LABELS[key] ?? key}
            </span>
          </div>
        ))}
      </div>

      <div className="text-xs text-muted-foreground pt-1 border-t">
        Publish-ready vehicles: <span className="font-medium text-foreground">{data.ready_vehicle_count}</span>
        {' · '}
        Total non-archived: <span className="font-medium text-foreground">{data.vehicles?.length ?? 0}</span>
      </div>
    </div>
  );
};

export default MarketplaceReadinessPanel;
