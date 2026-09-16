import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Store, ExternalLink, Copy, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useTeam } from '@/contexts/TeamContext';
import { useMarketplaceReadiness, useMarketplaceFeeStatus } from '@/hooks/useMarketplaceReadiness';
import { renterStorefrontUrl, renterStorefrontDisplayUrl } from '@/lib/renterApp';
import { PermissionGuard } from '@/components/common/PermissionGuard';

interface FleetListingBannerProps {
  /** Called after vehicles are published so the fleet list refreshes. */
  onPublished?: () => void;
}

/**
 * Shows the live truth about how many cars renters can actually see, with the
 * storefront address and a one-click way to publish everything that's ready.
 */
export const FleetListingBanner = ({ onPublished }: FleetListingBannerProps) => {
  const { currentTeam } = useTeam();
  const { data: readiness, refetch } = useMarketplaceReadiness(currentTeam?.id);
  const { data: feeRow } = useMarketplaceFeeStatus(currentTeam?.id);
  const [publishing, setPublishing] = useState(false);
  const [copied, setCopied] = useState(false);

  const isLive = feeRow?.marketplace_visible === true;
  if (!isLive || !readiness) return null;

  const vehicles = readiness.vehicles || [];
  const published = vehicles.filter((v) => v.ready && v.marketplace_visible).length;
  const eligible = vehicles.filter((v) => v.ready).length;
  const total = vehicles.length;
  const publishable = eligible - published;

  const slug = feeRow?.slug ?? null;
  const url = renterStorefrontUrl(slug);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy the link');
    }
  };

  const handlePublishAll = async () => {
    if (!currentTeam?.id) return;
    setPublishing(true);
    try {
      const { data, error } = await supabase.rpc('publish_eligible_team_vehicles', {
        _team_id: currentTeam.id,
      });
      if (error) throw error;
      const count = Number(data ?? 0);
      toast.success(
        count > 0
          ? `${count} ${count === 1 ? 'car is' : 'cars are'} now on your booking site`
          : 'Nothing new to publish right now',
      );
      await refetch();
      onPublished?.();
    } catch (err: any) {
      toast.error(err?.message || 'Could not publish your cars');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <Card className="p-4 border-primary/20 bg-primary/5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
            <Store className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-foreground">
                {published} of {total} {total === 1 ? 'car' : 'cars'} on your booking site
              </p>
              {published === 0 && (
                <Badge variant="outline" className="border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  Nothing visible to renters
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
              <span className="truncate">{renterStorefrontDisplayUrl(slug)}</span>
              <Button variant="ghost" size="sm" className="h-6 px-2" onClick={handleCopy}>
                {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                {copied ? 'Copied' : 'Copy link'}
              </Button>
            </div>
            {publishable > 0 && (
              <p className="text-xs text-muted-foreground">
                {publishable} ready {publishable === 1 ? 'car is' : 'cars are'} not published yet.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" onClick={() => window.open(url, '_blank')}>
            <ExternalLink className="h-4 w-4 mr-2" />
            View site
          </Button>
          {publishable > 0 && (
            <PermissionGuard minRole="manager">
              <Button size="sm" onClick={handlePublishAll} disabled={publishing}>
                {publishing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Publish all ready
              </Button>
            </PermissionGuard>
          )}
        </div>
      </div>
    </Card>
  );
};
