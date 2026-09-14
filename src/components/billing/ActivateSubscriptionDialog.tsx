import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, ShieldCheck, Sparkles, ArrowRight } from 'lucide-react';
import { BillingToggle } from '@/components/landing/pricing/BillingToggle';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useBillingStatus, TIER_BOUNDS } from '@/hooks/useBillingStatus';

interface ActivateSubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnPath?: string;
  cancelPath?: string;
}

/**
 * Activation is fully server-derived: the number of vehicles in the workspace
 * decides the plan and the amount. Nothing here is typed in by hand.
 */
export const ActivateSubscriptionDialog = ({
  open,
  onOpenChange,
  returnPath = '/dashboard/settings?subscription=success',
  cancelPath = '/dashboard/settings',
}: ActivateSubscriptionDialogProps) => {
  const [isAnnual, setIsAnnual] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const billing = useBillingStatus();

  const bounds = billing.tier === 'enterprise' ? null : TIER_BOUNDS[billing.tier];
  const perVehicle = bounds
    ? isAnnual
      ? bounds.perVehicle.year
      : bounds.perVehicle.month
    : null;
  const total = perVehicle ? perVehicle * billing.fleetCount : null;

  const handleActivate = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { isAnnual, returnPath, cancelPath },
      });
      if (error) throw error;
      if (data?.contactSales) {
        window.open('https://calendly.com/exotiq/enterprise', '_blank');
        onOpenChange(false);
        return;
      }
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error('No checkout link was returned.');
    } catch (error: any) {
      toast({
        title: "Couldn't start activation",
        description: error?.message || 'Please try again in a moment.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (billing.needsEnterpriseQuote) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Let's talk pricing</DialogTitle>
            <DialogDescription>
              With {billing.fleetCount} vehicles you're past our standard plans. We'll put together
              pricing that fits your fleet.
            </DialogDescription>
          </DialogHeader>
          <Button
            className="w-full h-12"
            onClick={() => {
              window.open('https://calendly.com/exotiq/enterprise', '_blank');
              onOpenChange(false);
            }}
          >
            Book a call
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Activate your account</DialogTitle>
          <DialogDescription>
            Your first 30 days are free. We'll add your card now so nothing pauses when the trial
            ends.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="rounded-lg bg-muted/50 p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{billing.tierLabel}</span>
              <span className="text-sm text-muted-foreground">
                {billing.fleetCount} {billing.fleetCount === 1 ? 'vehicle' : 'vehicles'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Based on the vehicles in your workspace right now. Add or remove vehicles and your
              next bill follows automatically.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <span className="text-sm">Billing</span>
            <BillingToggle isAnnual={isAnnual} onChange={setIsAnnual} size="sm" />
          </div>

          {perVehicle !== null && total !== null && (
            <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <div className="flex justify-between text-sm">
                <span>
                  ${perVehicle.toLocaleString()}/vehicle/{isAnnual ? 'yr' : 'mo'}
                </span>
                <span>× {billing.fleetCount}</span>
              </div>
              {isAnnual && (
                <p className="text-xs text-success">Two months free on annual billing</p>
              )}
              <div className="flex justify-between border-t border-primary/20 pt-2 text-lg font-bold">
                <span>After the trial</span>
                <span className="text-primary">
                  ${total.toLocaleString()}/{isAnnual ? 'yr' : 'mo'}
                </span>
              </div>
            </div>
          )}

          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            <span>
              Nothing is charged today. We'll email you before the first charge, and you can cancel
              any time from this page.
            </span>
          </div>

          <Button className="h-12 w-full" onClick={handleActivate} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Opening secure checkout…
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Start 30-day free trial
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
