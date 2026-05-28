import { AlertTriangle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTrialStatus } from '@/hooks/useTrialStatus';
import { useNavigate } from 'react-router-dom';

/**
 * Renders a sticky trial-status strip when the current team is on a tracked
 * trial. Grandfathered teams (no trial_end) and paid subscribers see nothing.
 */
export function TrialBanner() {
  const { onTrial, trialExpired, daysLeft, isReadOnly } = useTrialStatus();
  const navigate = useNavigate();

  if (!onTrial) return null;
  // If subscribed, useTrialStatus.isReadOnly is false even when expired — hide.
  if (trialExpired && !isReadOnly) return null;

  const goBilling = () => navigate('/dashboard/settings?section=billing');

  if (isReadOnly) {
    return (
      <div className="w-full bg-destructive text-destructive-foreground px-4 py-2 flex items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2 min-w-0">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="truncate">
            Your free trial has ended. Reads still work, but new bookings, vehicle changes,
            and other edits are paused until you upgrade.
          </span>
        </div>
        <Button size="sm" variant="secondary" onClick={goBilling} className="shrink-0">
          Upgrade
        </Button>
      </div>
    );
  }

  // Active trial — show countdown when ≤7 days remain
  if (daysLeft !== null && daysLeft <= 7) {
    return (
      <div className="w-full bg-amber-500/10 text-amber-900 dark:text-amber-200 border-b border-amber-500/30 px-4 py-2 flex items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2 min-w-0">
          <Clock className="h-4 w-4 shrink-0" />
          <span className="truncate">
            {daysLeft === 0
              ? 'Your free trial ends today.'
              : `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left in your free trial.`}
          </span>
        </div>
        <Button size="sm" variant="outline" onClick={goBilling} className="shrink-0">
          Choose a plan
        </Button>
      </div>
    );
  }

  return null;
}
