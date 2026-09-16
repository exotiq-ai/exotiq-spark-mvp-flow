/**
 * MarketplaceReadinessPanel
 *
 * Checklist rendered inside the expanded team row of MarketplaceVisibilityTab.
 * Calls `get_marketplace_readiness(team_id)` and shows green/red pills per
 * check, the exact reason each failing check is failing, and per-vehicle
 * detail so a car that is simply out of service reads differently from a car
 * that is missing photos or a rate.
 *
 * Two confirmations (platform fee, default security deposit) are gated by DB
 * triggers before anything can be published; both can be recorded from here.
 */

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  useMarketplaceReadiness,
  useMarketplaceFeeStatus,
  useMarketplaceDepositStatus,
  CHECK_LABELS,
  CHECK_FIX_HINTS,
  VEHICLE_CHECK_LABELS,
} from '@/hooks/useMarketplaceReadiness';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface Props {
  teamId: string;
}

export const MarketplaceReadinessPanel = ({ teamId }: Props) => {
  const { data, isLoading, error } = useMarketplaceReadiness(teamId);
  const { data: feeRow } = useMarketplaceFeeStatus(teamId);
  const { data: depositRow } = useMarketplaceDepositStatus(teamId);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [confirming, setConfirming] = useState<string | null>(null);

  const runConfirm = async (action: 'confirm_platform_fee' | 'confirm_deposit_source') => {
    setConfirming(action);
    try {
      const { data: res, error: fnError } = await supabase.functions.invoke(
        'super-admin-tenant-lifecycle',
        { body: { action, team_id: teamId } },
      );
      if (fnError) throw fnError;
      if ((res as { error?: string } | null)?.error) {
        throw new Error((res as { error: string }).error);
      }
      toast({
        title: action === 'confirm_platform_fee' ? 'Platform fee confirmed' : 'Default deposit confirmed',
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['marketplace-readiness', teamId] }),
        queryClient.invalidateQueries({ queryKey: ['marketplace-readiness-fee', teamId] }),
        queryClient.invalidateQueries({ queryKey: ['marketplace-readiness-deposit', teamId] }),
      ]);
    } catch (e) {
      toast({
        title: 'Could not confirm',
        description: e instanceof Error ? e.message : 'Unexpected error',
        variant: 'destructive',
      });
    } finally {
      setConfirming(null);
    }
  };

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
  const eligible = data.eligible_vehicle_count ?? 0;
  const published = data.published_vehicle_count ?? data.ready_vehicle_count ?? 0;
  const total = data.vehicles?.length ?? 0;
  const feeConfirmed = !!feeRow?.platform_fee_confirmed_at;
  const depositConfirmed = !!depositRow?.deposit_source_confirmed_at;
  const blockedVehicles = (data.vehicles ?? []).filter((v) => !v.ready);

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

      <div className="grid grid-cols-1 gap-y-1.5">
        {entries.map(([key, ok]) => (
          <div key={key} className="flex items-start gap-2 text-xs">
            {ok ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
            )}
            <span className={ok ? 'text-foreground' : 'text-muted-foreground'}>
              {CHECK_LABELS[key] ?? key}
              {!ok && CHECK_FIX_HINTS[key] && (
                <span className="block text-destructive/80">{CHECK_FIX_HINTS[key]}</span>
              )}
            </span>
          </div>
        ))}
      </div>

      {/* Confirmations enforced by DB triggers before anything can publish */}
      <div className="pt-2 border-t space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2 text-xs">
            {feeConfirmed ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
            )}
            <span className={feeConfirmed ? 'text-foreground' : 'text-muted-foreground'}>
              Platform fee confirmed
              {feeRow?.platform_fee_percent != null && (
                <span className="ml-1 text-muted-foreground">
                  ({Number(feeRow.platform_fee_percent).toFixed(2)}%)
                </span>
              )}
              {!feeConfirmed && (
                <span className="block text-destructive/80">
                  Nothing can be published until the fee is confirmed for this workspace
                </span>
              )}
            </span>
          </div>
          {!feeConfirmed && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs shrink-0"
              disabled={confirming !== null}
              onClick={() => runConfirm('confirm_platform_fee')}
            >
              {confirming === 'confirm_platform_fee' && (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              )}
              Confirm fee
            </Button>
          )}
        </div>

        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2 text-xs">
            {depositConfirmed ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
            )}
            <span className={depositConfirmed ? 'text-foreground' : 'text-muted-foreground'}>
              Default security deposit confirmed
              {depositRow?.default_deposit_cents != null && (
                <span className="ml-1 text-muted-foreground">
                  (${(Number(depositRow.default_deposit_cents) / 100).toFixed(0)})
                </span>
              )}
              {!depositConfirmed && (
                <span className="block text-destructive/80">
                  Confirm the default deposit, or set a per-vehicle override, before publishing
                </span>
              )}
            </span>
          </div>
          {!depositConfirmed && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs shrink-0"
              disabled={confirming !== null}
              onClick={() => runConfirm('confirm_deposit_source')}
            >
              {confirming === 'confirm_deposit_source' && (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              )}
              Confirm deposit
            </Button>
          )}
        </div>
      </div>

      {!!data.trashed_marketplace_visible_count && (
        <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-2.5 text-xs text-amber-900 dark:text-amber-200">
          <span className="font-medium">
            {data.trashed_marketplace_visible_count} trashed vehicle
            {data.trashed_marketplace_visible_count === 1 ? '' : 's'} still flagged for the
            marketplace
          </span>{' '}
          — they are hidden from renters, but clear the flag so the fleet list stays accurate.
        </div>
      )}

      <div className="pt-2 border-t space-y-1.5">
        <div className="text-xs text-muted-foreground">
          Ready to publish: <span className="font-medium text-foreground">{eligible}</span> of {total}
          {' · '}
          Already published: <span className="font-medium text-foreground">{published}</span>
        </div>

        {blockedVehicles.length > 0 && (
          <div className="space-y-1">
            {blockedVehicles.map((v) => {
              const failing = Object.entries(v.checks ?? {})
                .filter(([, ok]) => !ok)
                .map(([key]) => VEHICLE_CHECK_LABELS[key] ?? key);
              return (
                <div key={v.id} className="flex items-start gap-2 text-xs">
                  <XCircle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
                  <span>
                    <span className="text-foreground">{v.label}</span>
                    {failing.length > 0 && (
                      <span className="text-muted-foreground"> — missing: {failing.join(', ')}</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MarketplaceReadinessPanel;
