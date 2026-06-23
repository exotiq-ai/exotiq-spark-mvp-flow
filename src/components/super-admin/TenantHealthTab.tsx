import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import { TenantDetailDrawer } from './TenantDetailDrawer';

interface Row {
  team_id: string;
  team_name: string;
  city: string | null;
  plan_tier: string | null;
  fleet_size_cap: number | null;
  vehicles_in_use: number;
  active_rentals: number;
  util_30d: number;
  revenue_30d: number;
  last_activity: string | null;
  trial_end: string | null;
  is_demo: boolean;
  stripe_connected: boolean;
  risk_flags: string[];
}

const FLAG_META: Record<string, { label: string; variant: 'destructive' | 'secondary' | 'outline' }> = {
  trial_ending: { label: 'Trial <7d', variant: 'outline' },
  no_stripe: { label: 'No Stripe', variant: 'outline' },
  no_payment_30d: { label: 'No payment 30d', variant: 'outline' },
  over_plan: { label: 'Over plan', variant: 'destructive' },
  stuck_onboarding: { label: 'Stuck onboarding', variant: 'outline' },
  demo: { label: 'Demo', variant: 'secondary' },
};

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);

const relTime = (s: string | null) => {
  if (!s) return '—';
  const diff = Date.now() - new Date(s).getTime();
  const d = Math.floor(diff / 86400000);
  if (d < 1) return 'today';
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
};

export const TenantHealthTab = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [flagFilter, setFlagFilter] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await (supabase as any).rpc('get_super_admin_tenant_health');
        if (error) throw error;
        setRows((data as Row[]) || []);
      } catch (e) {
        console.error('[TenantHealth] error', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (term && !r.team_name.toLowerCase().includes(term)) return false;
      if (flagFilter && !r.risk_flags.includes(flagFilter)) return false;
      return true;
    });
  }, [rows, search, flagFilter]);

  const flagCounts = useMemo(() => {
    const c: Record<string, number> = {};
    rows.forEach((r) => r.risk_flags.forEach((f) => (c[f] = (c[f] || 0) + 1)));
    return c;
  }, [rows]);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Tenant Health</CardTitle>
          <CardDescription>
            Per-account operational KPIs. Click a row to view contact and full diagnostics — every open is logged.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search team name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Button
                size="sm"
                variant={flagFilter === null ? 'default' : 'outline'}
                onClick={() => setFlagFilter(null)}
              >
                All ({rows.length})
              </Button>
              {Object.entries(FLAG_META).map(([k, m]) => (
                <Button
                  key={k}
                  size="sm"
                  variant={flagFilter === k ? 'default' : 'outline'}
                  onClick={() => setFlagFilter(flagFilter === k ? null : k)}
                  disabled={!flagCounts[k]}
                >
                  {m.label} ({flagCounts[k] || 0})
                </Button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b">
                <tr>
                  <th className="text-left py-2 pr-3 font-medium">Team</th>
                  <th className="text-left py-2 pr-3 font-medium">Plan</th>
                  <th className="text-right py-2 pr-3 font-medium">Vehicles</th>
                  <th className="text-right py-2 pr-3 font-medium">Active</th>
                  <th className="text-right py-2 pr-3 font-medium">Util 30d</th>
                  <th className="text-right py-2 pr-3 font-medium">Rev 30d</th>
                  <th className="text-left py-2 pr-3 font-medium">Last activity</th>
                  <th className="text-left py-2 font-medium">Flags</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-muted-foreground">
                      Loading…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-muted-foreground">
                      No tenants match
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => (
                    <tr
                      key={r.team_id}
                      className="border-b last:border-0 hover:bg-accent/40 cursor-pointer transition-colors"
                      onClick={() => setSelectedTeam(r.team_id)}
                    >
                      <td className="py-2 pr-3 font-medium">{r.team_name}</td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {r.plan_tier || '—'}
                        {r.fleet_size_cap ? ` · cap ${r.fleet_size_cap}` : ''}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">{r.vehicles_in_use}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{r.active_rentals}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{r.util_30d}%</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{fmtCurrency(r.revenue_30d)}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{relTime(r.last_activity)}</td>
                      <td className="py-2">
                        <div className="flex flex-wrap gap-1">
                          {r.risk_flags.map((f) => (
                            <Badge key={f} variant={FLAG_META[f]?.variant || 'outline'} className="text-[10px]">
                              {FLAG_META[f]?.label || f}
                            </Badge>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <TenantDetailDrawer teamId={selectedTeam} onClose={() => setSelectedTeam(null)} />
    </>
  );
};
