import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreditCard, Check } from 'lucide-react';
import { useBillingStatus } from '@/hooks/useBillingStatus';
import { ActivateSubscriptionDialog } from '@/components/billing/ActivateSubscriptionDialog';

/**
 * Shown inside first-run setup. The fleet is normally already loaded for the
 * operator before their call, so the count here is real.
 */
export const OnboardingActivateCard = ({ returnPath = '/onboarding' }: { returnPath?: string }) => {
  const billing = useBillingStatus();
  const [open, setOpen] = useState(false);

  if (billing.isGrandfathered) return null;

  if (billing.onTrial || billing.state === 'active') {
    return (
      <Card className="border-success/30 bg-success/5 p-4">
        <div className="flex items-center gap-3">
          <Check className="h-5 w-5 text-success" />
          <div className="text-sm">
            <p className="font-medium">Account activated</p>
            <p className="text-muted-foreground">
              {billing.onTrial && billing.daysLeftInTrial !== null
                ? `${billing.daysLeftInTrial} free days left — nothing charged yet.`
                : 'Your plan is live.'}
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-primary/30 bg-primary/5 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="text-sm">
              <p className="font-medium">Activate your account — 30 days free</p>
              <p className="text-muted-foreground">
                {billing.fleetCount} {billing.fleetCount === 1 ? 'vehicle' : 'vehicles'} in your
                workspace · {billing.tierLabel} plan. Nothing is charged today, and bookings and
                payments switch on as soon as your card is saved.
              </p>
            </div>
          </div>
          <Button onClick={() => setOpen(true)} className="shrink-0">
            Add card
          </Button>
        </div>
      </Card>
      <ActivateSubscriptionDialog
        open={open}
        onOpenChange={setOpen}
        returnPath={returnPath}
        cancelPath={returnPath}
      />
    </>
  );
};
