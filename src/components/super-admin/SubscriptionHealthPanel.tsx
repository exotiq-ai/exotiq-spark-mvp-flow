import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, RefreshCw, Search, AlertTriangle } from 'lucide-react';

interface HealthRow {
  team_id: string;
  team_name: string;
  owner_email: string | null;
  billing_status: string | null;
  billed_tier: string | null;
  billing_interval: string | null;
  billed_quantity: number | null;
  active_vehicles: number;
  expected_tier: string | null;
  trial_end: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  activated_at: string | null;
  is_demo_account: boolean;
  has_subscription: boolean;
  quantity_mismatch: boolean;
  over_cap: boolean;
}

const STATUS_BADGE: Record<string, string> = {
  trialing: 'bg-primary/10 text-primary border-primary/30',
  active: 'bg-success/10 text-success border-success/30',
  grandfathered: 'bg-muted text-muted-foreground border-border',
  pending_activation: 'bg-warning/10 text-warning border-warning/30',
  past_due: 'bg-warning/10 text-warning border-warning/30',
  unpaid: 'bg-destructive/10 text-destructive border-destructive/30',
  canceled: 'bg-destructive/10 text-destructive border-destructive/30',
};

const STATUS_LABEL: Record<string, string> = {
  trialing: 'On trial',
  active: 'Paying',
  grandfathered: 'Included',
  pending_activation: 'Needs card',
  past_due: 'Payment failed',
  unpaid: 'Unpaid',
  canceled: 'Cancelled',
};

const fmtDate = (v: string | null) =>
  v ? new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

const daysUntil = (v: string | null) =>
  v ? Math.ceil((new Date(v).getTime() - Date.now()) / 86400000) : null;

export const SubscriptionHealthPanel = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<HealthRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).rpc('get_super_admin_subscription_health');
    if (error) {
      toast({ title: 'Could not load subscriptions', description: error.message, variant: 'destructive' });
      setLoading(false);
      return;
    }
    setRows((data || []) as HealthRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const runCheck = async () => {
    setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke('billing-reconcile', {
        body: { dry_run: false },
      });
      if (error) throw error;
      toast({
        title: 'Subscriptions checked',
        description: `${data?.checked ?? 0} reviewed, ${data?.corrected ?? 0} corrected.`,
      });
      await load();
    } catch (e: any) {
      toast({ title: "Check didn't finish", description: e?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setChecking(false);
    }
  };

  const live = useMemo(() => rows.filter((r) => !r.is_demo_account), [rows]);

  const stats = useMemo(() => {
    const onTrial = live.filter((r) => r.billing_status === 'trialing');
    return {
      paying: live.filter((r) => r.billing_status === 'active').length,
      onTrial: onTrial.length,
      trialEndingSoon: onTrial.filter((r) => {
        const d = daysUntil(r.trial_end);
        return d !== null && d <= 7;
      }).length,
      needsCard: live.filter((r) => r.billing_status === 'pending_activation').length,
      trouble: live.filter((r) => ['past_due', 'unpaid'].includes(r.billing_status || '')).length,
      mismatched: live.filter((r) => r.quantity_mismatch).length,
    };
  }, [live]);

  const overCap = useMemo(() => live.filter((r) => r.over_cap), [live]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = live.filter((r) => r.has_subscription || r.billing_status === 'pending_activation');
    if (!q) return base;
    return base.filter(
      (r) => r.team_name.toLowerCase().includes(q) || (r.owner_email || '').toLowerCase().includes(q),
    );
  }, [live, search]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Subscription health</CardTitle>
            <CardDescription>
              Live vehicle counts against what Stripe is billing. Trials, failed payments and
              accounts over the 50-vehicle cap.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={runCheck} disabled={checking} className="gap-2">
            {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Check now
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
            {[
              { label: 'Paying', value: stats.paying },
              { label: 'On trial', value: stats.onTrial },
              { label: 'Trial ends ≤7d', value: stats.trialEndingSoon },
              { label: 'Needs card', value: stats.needsCard },
              { label: 'Payment trouble', value: stats.trouble },
              { label: 'Count mismatch', value: stats.mismatched },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-border bg-card p-3">
                <div className="text-2xl font-semibold">{loading ? '—' : s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-warning" />
            Over the 50-vehicle cap
          </CardTitle>
          <CardDescription>
            These accounts are billed for 50 vehicles until an Enterprise agreement is in place.
            They stay listed here until their fleet drops back under the cap.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
          ) : overCap.length === 0 ? (
            <div className="py-4 text-sm text-muted-foreground">
              No account is over the cap right now.
            </div>
          ) : (
            <div className="space-y-2">
              {overCap.map((r) => (
                <div
                  key={r.team_id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3"
                >
                  <div>
                    <div className="font-medium">{r.team_name}</div>
                    <div className="text-xs text-muted-foreground">{r.owner_email || 'No owner email'}</div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="font-medium">{r.active_vehicles} vehicles</div>
                    <div className="text-xs text-muted-foreground">
                      billed for {r.billed_quantity ?? 0}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Every subscription</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by company or owner email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Nothing to show.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3">Company</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Plan</th>
                    <th className="py-2 pr-3">Billed</th>
                    <th className="py-2 pr-3">Live</th>
                    <th className="py-2 pr-3">Trial ends</th>
                    <th className="py-2">Next charge</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.team_id} className="border-b border-border/50">
                      <td className="py-2 pr-3">
                        <div className="font-medium">{r.team_name}</div>
                        <div className="text-xs text-muted-foreground">{r.owner_email || '—'}</div>
                      </td>
                      <td className="py-2 pr-3">
                        <Badge
                          variant="outline"
                          className={STATUS_BADGE[r.billing_status || ''] || 'bg-muted text-muted-foreground'}
                        >
                          {STATUS_LABEL[r.billing_status || ''] || r.billing_status || 'Not set'}
                        </Badge>
                      </td>
                      <td className="py-2 pr-3 capitalize">
                        {r.billed_tier || r.expected_tier || '—'}
                        {r.billing_interval === 'year' && (
                          <span className="ml-1 text-xs text-muted-foreground">annual</span>
                        )}
                      </td>
                      <td className="py-2 pr-3">{r.billed_quantity ?? '—'}</td>
                      <td className={`py-2 pr-3 ${r.quantity_mismatch ? 'font-semibold text-warning' : ''}`}>
                        {r.active_vehicles}
                      </td>
                      <td className="py-2 pr-3">{fmtDate(r.trial_end)}</td>
                      <td className="py-2">
                        {fmtDate(r.current_period_end)}
                        {r.cancel_at_period_end && (
                          <span className="ml-1 text-xs text-destructive">cancels</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
