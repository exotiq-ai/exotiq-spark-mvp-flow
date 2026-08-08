import { useEffect, useState } from 'react';
import { LifeBuoy, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSupportSession } from '@/hooks/useSupportSession';
import { useToast } from '@/hooks/use-toast';

const formatRemaining = (expiresAt: string) => {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'expired';
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
};

/**
 * Persistent banner shown while a super admin is working inside a customer
 * account through a time-boxed support session.
 */
export const SupportSessionBanner = () => {
  const { session, endSession, refresh } = useSupportSession();
  const { toast } = useToast();
  const [ending, setEnding] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!session) return;
    const interval = window.setInterval(() => {
      setTick((t) => t + 1);
      if (new Date(session.expires_at).getTime() <= Date.now()) {
        refresh().then(() => window.location.reload());
      }
    }, 30000);
    return () => window.clearInterval(interval);
  }, [session?.expires_at, refresh]);

  if (!session) return null;

  const handleEnd = async () => {
    setEnding(true);
    try {
      await endSession();
      toast({ title: 'Support session ended', description: 'You are back in your own account.' });
      window.location.href = '/dashboard';
    } catch (err) {
      setEnding(false);
      toast({
        title: 'Could not end session',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="w-full border-b border-amber-500/40 bg-amber-500/10 px-3 py-2 sm:px-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-xs text-amber-800 dark:text-amber-300 sm:text-sm">
          <LifeBuoy className="h-4 w-4 shrink-0" />
          <span className="truncate">
            <strong>Support session</strong> — you are working inside{' '}
            <strong>{session.team_name}</strong>. Ends in {formatRemaining(session.expires_at)}.
          </span>
        </div>
        <Button size="sm" variant="outline" onClick={handleEnd} disabled={ending} className="shrink-0">
          {ending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
          End session
        </Button>
      </div>
    </div>
  );
};

export default SupportSessionBanner;
