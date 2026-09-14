import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, RotateCcw, PlayCircle, StopCircle, CreditCard } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type Action = 'restart_onboarding' | 'start_demo' | 'stop_demo' | 'set_billing';

interface Props {
  teamId: string;
  teamName: string;
  isDemo: boolean;
  billingStatus: string | null;
  onChanged?: () => void;
}

const COPY: Record<Action, { title: string; body: string; confirm: string }> = {
  restart_onboarding: {
    title: 'Restart setup for this workspace?',
    body: 'The owner will be taken back to the first setup step next time they sign in. Their fleet, bookings and settings are untouched.',
    confirm: 'Restart setup',
  },
  start_demo: {
    title: 'Switch this workspace to demo?',
    body: 'Demo workspaces show sample content and are never billed. Use this for walkthroughs before a real handover.',
    confirm: 'Start demo',
  },
  stop_demo: {
    title: 'Turn demo mode off?',
    body: 'The workspace goes back to showing its own real data.',
    confirm: 'Stop demo',
  },
  set_billing: {
    title: 'Ask this workspace for a card?',
    body: 'They will be prompted to add a card and start their 30 free days. Bookings and payments stay off until they do.',
    confirm: 'Require activation',
  },
};

export const TenantLifecycleSection = ({
  teamId,
  teamName,
  isDemo,
  billingStatus,
  onChanged,
}: Props) => {
  const { toast } = useToast();
  const [pending, setPending] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (action: Action) => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('super-admin-tenant-lifecycle', {
        body: {
          action,
          team_id: teamId,
          ...(action === 'set_billing' ? { billing_status: 'pending_activation' } : {}),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: 'Done', description: `${teamName} updated.` });
      onChanged?.();
    } catch (e: any) {
      toast({
        title: "That didn't work",
        description: e?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Lifecycle
          </div>
          <Badge variant="secondary">{isDemo ? 'Demo' : billingStatus ?? 'not set'}</Badge>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={busy}
            onClick={() => setPending('restart_onboarding')}
          >
            <RotateCcw className="h-3.5 w-3.5" /> Restart setup
          </Button>

          {isDemo ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={busy}
              onClick={() => setPending('stop_demo')}
            >
              <StopCircle className="h-3.5 w-3.5" /> Stop demo
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={busy}
              onClick={() => setPending('start_demo')}
            >
              <PlayCircle className="h-3.5 w-3.5" /> Start demo
            </Button>
          )}

          {!isDemo && billingStatus !== 'pending_activation' && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={busy}
              onClick={() => setPending('set_billing')}
            >
              <CreditCard className="h-3.5 w-3.5" /> Require activation
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Every action here is audit-logged.</p>
      </CardContent>

      <AlertDialog open={pending !== null} onOpenChange={(v) => !v && setPending(null)}>
        <AlertDialogContent>
          {pending && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{COPY[pending].title}</AlertDialogTitle>
                <AlertDialogDescription>{COPY[pending].body}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
                <AlertDialogAction disabled={busy} onClick={() => run(pending)}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {COPY[pending].confirm}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
