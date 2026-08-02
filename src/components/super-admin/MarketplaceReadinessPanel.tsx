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

import {
  useMarketplaceReadiness,
  useMarketplaceFeeStatus,
  CHECK_LABELS,
} from '@/hooks/useMarketplaceReadiness';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface Props {
  teamId: string;
}

export const MarketplaceReadinessPanel = ({ teamId }: Props) => {
  const { data, isLoading, error } = useMarketplaceReadiness(teamId);
  const { data: feeRow } = useMarketplaceFeeStatus(teamId);

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
      {data.test_mode && (
        <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-2.5 text-xs text-amber-900 dark:text-amber-200">
          <span className="font-medium">Test mode active</span> — go-live checklist is bypassed for
          this team. Real checks still shown below.
          {data.real_ready === false && (
            <span className="block mt-0.5 text-amber-800/80 dark:text-amber-300/80">
              Real readiness: <span className="font-medium">not passing</span>
            </span>
          )}
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Go-live checklist</div>
        <Badge variant={data.real_ready ?? data.ready ? 'default' : 'secondary'} className="text-xs">
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

      <div className="pt-2 border-t space-y-1.5">
        <div className="flex items-center gap-2 text-xs">
          {feeRow?.platform_fee_confirmed_at ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          ) : (
            <XCircle className="h-3.5 w-3.5 text-destructive" />
          )}
          <span className={feeRow?.platform_fee_confirmed_at ? 'text-foreground' : 'text-muted-foreground'}>
            Platform fee explicitly confirmed by operator
            {feeRow?.platform_fee_percent != null && (
              <span className="ml-1 text-muted-foreground">({Number(feeRow.platform_fee_percent).toFixed(2)}%)</span>
            )}
            {!feeRow?.platform_fee_confirmed_at && (
              <span className="ml-1 text-destructive/80">— set platform_fee_percent explicitly for this team</span>
            )}
          </span>
        </div>
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
