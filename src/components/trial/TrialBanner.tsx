import { AlertTriangle, Clock, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTrialStatus } from '@/hooks/useTrialStatus';
import { useNavigate } from 'react-router-dom';

/**
 * Sticky strip for billing state: needs a card, trial ending, or paused.
 * Founding-operator and demo workspaces see nothing.
 */
export function TrialBanner() {
  const { onTrial, daysLeft, isReadOnly, needsActivation } = useTrialStatus();
  const navigate = useNavigate();

  const goBilling = () => navigate('/dashboard/settings?section=billing');

  if (needsActivation) {
    return (
      <div className="w-full bg-primary/10 text-foreground border-b border-primary/30 px-4 py-2 flex items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2 min-w-0">
          <CreditCard className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate">
            Add a card to start your 30 free days. Bookings and payments stay off until you do.
          </span>
        </div>
        <Button size="sm" onClick={goBilling} className="shrink-0">
          Activate
        </Button>
      </div>
    );
  }

  if (isReadOnly) {
    return (
      <div className="w-full bg-destructive text-destructive-foreground px-4 py-2 flex items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2 min-w-0">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="truncate">
            Your account is paused. You can still see everything, but new bookings and edits are on
            hold until billing is sorted.
          </span>
        </div>
        <Button size="sm" variant="secondary" onClick={goBilling} className="shrink-0">
          Fix billing
        </Button>
      </div>
    );
  }

  if (onTrial && daysLeft !== null && daysLeft <= 7) {
    return (
      <div className="w-full bg-amber-500/10 text-amber-900 dark:text-amber-200 border-b border-amber-500/30 px-4 py-2 flex items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2 min-w-0">
          <Clock className="h-4 w-4 shrink-0" />
          <span className="truncate">
            {daysLeft === 0
              ? 'Your free trial ends today — your card will be charged next.'
              : `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left in your free trial.`}
          </span>
        </div>
        <Button size="sm" variant="outline" onClick={goBilling} className="shrink-0">
          View billing
        </Button>
      </div>
    );
  }

  return null;
}
