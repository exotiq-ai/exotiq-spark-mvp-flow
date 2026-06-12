import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useTrialStatus } from '@/hooks/useTrialStatus';

/**
 * Returns a `guard(action)` wrapper. If the team's trial has expired and there
 * is no active subscription, calls are blocked, the user is toasted, and they
 * are routed to the billing settings to upgrade. Otherwise the action runs.
 */
export function useTrialGuard() {
  const { isReadOnly } = useTrialStatus();
  const navigate = useNavigate();
  const { toast } = useToast();

  const guard = useCallback(
    <T extends (...args: any[]) => any>(action: T) =>
      ((...args: Parameters<T>) => {
        if (isReadOnly) {
          toast({
            title: 'Trial ended',
            description: 'Upgrade to a paid plan to keep creating and editing records.',
            variant: 'destructive',
          });
          navigate('/dashboard/settings?section=billing');
          return undefined;
        }
        return action(...args);
      }) as T,
    [isReadOnly, navigate, toast]
  );

  return { guard, isReadOnly };
}
