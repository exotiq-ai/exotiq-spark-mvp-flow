import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTeam } from '@/contexts/TeamContext';
import { useUserRole } from '@/hooks/useUserRole';
import {
  useMarketplaceReadiness,
  useMarketplaceFeeStatus,
  CHECK_LABELS,
  VEHICLE_CHECK_LABELS,
} from '@/hooks/useMarketplaceReadiness';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Store,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  ChevronRight,
  ExternalLink,
  Car,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const CTA_PATHS: Record<string, string> = {
  stripe_charges_enabled: '/dashboard/settings?tab=payments',
  stripe_payouts_enabled: '/dashboard/settings?tab=payments',
  logo_set: '/dashboard/settings?tab=business',
  business_name_set: '/dashboard/settings?tab=business',
  business_address_set: '/dashboard/settings?tab=business',
  owner_email_set: '/dashboard/settings?tab=account',
  terms_accepted: '/dashboard/settings?tab=legal',
  has_ready_vehicle: '/dashboard/fleet',
};

const CTA_LABELS: Record<string, string> = {
  stripe_charges_enabled: 'Go to Payments',
  stripe_payouts_enabled: 'Go to Payments',
  logo_set: 'Update business profile',
  business_name_set: 'Update business profile',
  business_address_set: 'Update business profile',
  owner_email_set: 'Update account',
  terms_accepted: 'Review legal terms',
  has_ready_vehicle: 'Open Fleet',
};

export const MarketplaceSection = () => {
  const { currentTeam } = useTeam();
  const { isOwnerOrAdmin } = useUserRole();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [requesting, setRequesting] = useState(false);

  const teamId = currentTeam?.id;
  const { data, isLoading, error, refetch } = useMarketplaceReadiness(teamId);
  const { data: feeRow, refetch: refetchFee } = useMarketplaceFeeStatus(teamId);

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  const handleRequestReview = async () => {
    if (!teamId) return;
    setRequesting(true);
    try {
      const { error: rpcError } = await supabase.rpc('request_marketplace_inclusion', {
        _team_id: teamId,
      });
      if (rpcError) throw rpcError;
      await refetchFee();
      toast({
        title: 'Review requested',
        description: 'Your marketplace review request has been submitted. We will notify you once it is approved.',
      });
    } catch (err: unknown) {
      toast({
        title: 'Request failed',
        description: err instanceof Error ? err.message : 'Could not submit review request.',
        variant: 'destructive',
      });
    } finally {
      setRequesting(false);
    }
  };

  if (!isOwnerOrAdmin) {
    return (
      <Card className="p-6">
        <div className="text-sm text-muted-foreground">
          Only team owners or admins can view marketplace settings.
        </div>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading marketplace readiness…
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card className="p-6 border-destructive/50">
        <div className="flex items-start gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5" />
          <span>Failed to load readiness: {(error as Error)?.message ?? 'unknown error'}</span>
        </div>
      </Card>
    );
  }

  const entries = Object.entries(data.team_checks ?? {});
  const passing = entries.filter(([, v]) => !!v).length;
  const progress = entries.length ? Math.round((passing / entries.length) * 100) : 0;
  const isLive = feeRow?.marketplace_visible && feeRow?.marketplace_request_status === 'approved';
  const isRequested = feeRow?.marketplace_request_status === 'requested';
  const isRejected = feeRow?.marketplace_request_status === 'rejected';
  const isReady = data.real_ready ?? data.ready;
  const feeConfirmed = !!feeRow?.platform_fee_confirmed_at;

  return (
    <div className="space-y-6">
      {/* Status header */}
      <Card className="p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-primary/10">
            <Store className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-semibold">Public marketplace</h2>
              {isLive ? (
                <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">Live</Badge>
              ) : isRequested ? (
                <Badge variant="secondary">Review pending</Badge>
              ) : isRejected ? (
                <Badge variant="destructive">Rejected</Badge>
              ) : (
                <Badge variant="secondary">Not visible</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {isLive
                ? 'Your team is visible on the public marketplace and can receive online bookings.'
                : isRequested
                ? 'Your team is under review. You will be notified once approved.'
                : isRejected
                ? `Your request was rejected: ${feeRow?.marketplace_rejection_reason || 'No reason provided'}. Address the feedback and request again.`
                : 'Complete the go-live checklist to request review and appear on the public marketplace.'}
            </p>
            {feeRow?.slug && isLive && (
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => window.open(`/${feeRow.slug}`, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open public storefront
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Go-live checklist */}
      <Card className="p-6 space-y-5">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">Go-live checklist</h3>
            <span className="text-sm text-muted-foreground">{passing}/{entries.length} complete</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <div className="grid gap-2">
          {entries.map(([key, ok]) => {
            const ctaPath = CTA_PATHS[key];
            return (
              <div
                key={key}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-lg border transition-colors',
                  ok ? 'bg-muted/30 border-border' : 'bg-background border-border'
                )}
              >
                {ok ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <span className={cn('text-sm font-medium', ok ? 'text-foreground' : 'text-foreground')}>{CHECK_LABELS[key] ?? key}</span>
                    {!ok && ctaPath && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs w-fit"
                        onClick={() => handleNavigate(ctaPath)}
                      >
                        {CTA_LABELS[key] ?? 'Fix'}
                        <ChevronRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    )}
                  </div>
                  {!ok && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {key === 'stripe_charges_enabled' && 'Card payments must be enabled before renters can check out.'}
                      {key === 'stripe_payouts_enabled' && 'Payouts must be enabled so rental revenue can reach your bank account.'}
                      {key === 'logo_set' && 'Your logo appears on the marketplace listing and receipts.'}
                      {key === 'business_name_set' && 'Your business name is shown to renters on the public storefront.'}
                      {key === 'business_address_set' && 'A business address is required for tax invoices and receipts.'}
                      {key === 'owner_email_set' && 'The owner email is used for critical account notifications.'}
                      {key === 'terms_accepted' && 'You must accept the operator terms before going live.'}
                      {key === 'not_demo' && 'Demo accounts cannot appear on the marketplace.'}
                      {key === 'has_ready_vehicle' && 'At least one vehicle must have photos, rate, location, and status set.'}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Platform fee card */}
        <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {feeConfirmed ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive" />
              )}
              <span className="text-sm font-medium">Platform fee acknowledged</span>
            </div>
            {feeRow?.platform_fee_percent != null && (
              <Badge variant="outline" className="text-xs">{Number(feeRow.platform_fee_percent).toFixed(2)}%</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Exotiq charges a platform fee on the rental subtotal for marketplace bookings. This is set by your account representative.
          </p>
          {!feeConfirmed && (
            <p className="text-xs text-destructive/80">
              Your platform fee has not been confirmed yet. Submit a review request once the rest of the checklist is complete.
            </p>
          )}
        </div>

        {/* Request review CTA */}
        {!isLive && (
          <div className="pt-2">
            <Button
              onClick={handleRequestReview}
              disabled={requesting || isRequested}
              className="w-full sm:w-auto"
            >
              {requesting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4 mr-2" />
              )}
              {isRequested ? 'Review requested' : isRejected ? 'Request review again' : 'Request marketplace review'}
            </Button>
            {isRequested && (
              <p className="text-xs text-muted-foreground mt-2">
                Requested {feeRow?.marketplace_requested_at ? new Date(feeRow.marketplace_requested_at).toLocaleString() : 'recently'}
              </p>
            )}
          </div>
        )}
      </Card>

      {/* Vehicle readiness */}
      <Card className="p-6 space-y-4">
        <CardHeader className="p-0">
          <div className="flex items-center gap-2">
            <Car className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Vehicle readiness</CardTitle>
          </div>
          <CardDescription className="p-0">
            {data.ready_vehicle_count} of {data.vehicles?.length ?? 0} vehicles are ready to publish.
          </CardDescription>
        </CardHeader>

        <Accordion type="single" collapsible className="w-full">
          {data.vehicles?.map((vehicle) => (
            <AccordionItem key={vehicle.id} value={vehicle.id} className="border-b last:border-b-0">
              <AccordionTrigger className="text-sm hover:no-underline py-3">
                <div className="flex items-center gap-2 text-left">
                  {vehicle.ready ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                  )}
                  <span className={cn('font-medium', vehicle.ready ? 'text-foreground' : 'text-muted-foreground')}>
                    {vehicle.label}
                  </span>
                  {vehicle.marketplace_visible && (
                    <Badge variant="outline" className="text-[10px] h-5">Visible</Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-3">
                <div className="pl-6 space-y-2">
                  {vehicle.checks &&
                    Object.entries(vehicle.checks).map(([checkKey, ok]) => (
                      <div key={checkKey} className="flex items-center gap-2 text-xs">
                        {ok ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-destructive" />
                        )}
                        <span className={ok ? 'text-foreground' : 'text-muted-foreground'}>
                          {VEHICLE_CHECK_LABELS[checkKey] ?? checkKey}
                        </span>
                      </div>
                    ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs w-fit"
                    onClick={() => handleNavigate(`/dashboard/fleet?vehicle=${vehicle.id}`)}
                  >
                    Open vehicle
                    <ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
          {(!data.vehicles || data.vehicles.length === 0) && (
            <div className="text-sm text-muted-foreground py-4">No vehicles found. Add vehicles in Fleet to publish them.</div>
          )}
        </Accordion>
      </Card>
    </div>
  );
};

export default MarketplaceSection;
