import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from "sonner";
import { AlertTriangle, Check, Copy } from 'lucide-react';

interface Row {
  team_id: string;
  team_name: string;
  plan_tier: string | null;
  fleet_size_cap: number | null;
  vehicles_in_use: number;
  overage: number;
  trial_end: string | null;
  is_demo: boolean;
  seat_audit_reviewed_at: string | null;
}

// Placeholder per-seat monthly rate by tier — tune after first review pass.
const PER_SEAT_MONTHLY: Record<string, number> = {
  starter: 49,
  growth: 39,
  scale: 29,
  enterprise: 19,
};

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);

const relTime = (s: string | null) => {
  if (!s) return 'Never';
  const d = Math.floor((Date.now() - new Date(s).getTime()) / 86400000);
  if (d < 1) return 'today';
  if (d < 30) return `${d}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
};

const leakage = (r: Row) => r.overage * (PER_SEAT_MONTHLY[(r.plan_tier || '').toLowerCase()] || 39);

type Filter = 'all' | 'over' | 'trial' | 'unconverted';

export const VehicleAuditTab = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc('get_super_admin_vehicle_audit');
      if (error) throw error;
      setRows((data as Row[]) || []);
    } catch (e) {
      console.error('[VehicleAudit] error', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filter === 'over') return r.overage > 0;
      if (filter === 'trial') return !!r.trial_end && new Date(r.trial_end) > new Date();
      if (filter === 'unconverted')
        return !!r.trial_end && new Date(r.trial_end) < new Date();
      return true;
    });
  }, [rows, filter]);

  const totals = useMemo(() => {
    const seatsSold = rows.reduce((a, r) => a + (r.fleet_size_cap || 0), 0);
    const seatsInUse = rows.reduce((a, r) => a + r.vehicles_in_use, 0);
    const totalLeak = rows.reduce((a, r) => a + leakage(r), 0);
    const overCount = rows.filter((r) => r.overage > 0).length;
    return { seatsSold, seatsInUse, totalLeak, overCount };
  }, [rows]);

  const markReviewed = async (teamId: string) => {
    try {
      const { error } = await (supabase as any).rpc('mark_tenant_seat_review', {
        p_team_id: teamId,
        p_note: null,
      });
      if (error) throw error;
      toast('Marked as reviewed');
      load();
    } catch (e) {
      console.error(e);
      toast.error('Could not mark reviewed');
    }
  };

  const copyOutreach = async (r: Row) => {
    const text = [
      `Hi ${r.team_name} team,`,
      ``,
      `Quick heads up — your account is currently using ${r.vehicles_in_use} vehicles, ` +
        `which is ${r.overage} above your ${r.plan_tier || 'current'} plan cap of ${r.fleet_size_cap ?? '—'}.`,
      ``,
      `Want us to help you size up your plan, or adjust the active fleet?`,
      ``,
      `— Exotiq Support`,
    ].join('\n');
    await navigator.clipboard.writeText(text);
    toast('Outreach summary copied');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Vehicle Seat Audit
        </CardTitle>
        <CardDescription>
          Compare vehicles in use against each plan's fleet-size cap. Leakage estimates use placeholder per-seat
          rates — tune in code after first pass.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Seats sold</div>
              <div className="text-2xl font-bold tabular-nums">{totals.seatsSold}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Seats in use</div>
              <div className="text-2xl font-bold tabular-nums">{totals.seatsInUse}</div>
            </CardContent>
          </Card>
          <Card className={totals.overCount > 0 ? 'border-destructive/40 bg-destructive/5' : ''}>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Accounts over plan</div>
              <div className="text-2xl font-bold tabular-nums">{totals.overCount}</div>
            </CardContent>
          </Card>
          <Card className={totals.totalLeak > 0 ? 'border-amber-500/40 bg-amber-500/5' : ''}>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Est. monthly leakage</div>
              <div className="text-2xl font-bold tabular-nums">{fmtCurrency(totals.totalLeak)}</div>
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-1.5">
          {(['all', 'over', 'trial', 'unconverted'] as Filter[]).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? 'default' : 'outline'}
              onClick={() => setFilter(f)}
              className="capitalize"
            >
              {f === 'over' ? 'Over plan' : f}
            </Button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b">
              <tr>
                <th className="text-left py-2 pr-3 font-medium">Team</th>
                <th className="text-left py-2 pr-3 font-medium">Plan</th>
                <th className="text-right py-2 pr-3 font-medium">Cap</th>
                <th className="text-right py-2 pr-3 font-medium">In use</th>
                <th className="text-right py-2 pr-3 font-medium">Overage</th>
                <th className="text-right py-2 pr-3 font-medium">Est. leakage</th>
                <th className="text-left py-2 pr-3 font-medium">Last reviewed</th>
                <th className="text-right py-2 font-medium">Actions</th>
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
                    Nothing here
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.team_id} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-medium">
                      {r.team_name}
                      {r.is_demo && (
                        <Badge variant="secondary" className="ml-2 text-[10px]">
                          Demo
                        </Badge>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">{r.plan_tier || '—'}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{r.fleet_size_cap ?? '—'}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{r.vehicles_in_use}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {r.overage > 0 ? (
                        <Badge variant="destructive">+{r.overage}</Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {r.overage > 0 ? fmtCurrency(leakage(r)) : '—'}
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">{relTime(r.seat_audit_reviewed_at)}</td>
                    <td className="py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyOutreach(r)}
                          disabled={r.overage === 0}
                          title="Copy outreach summary"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => markReviewed(r.team_id)}
                          title="Mark reviewed"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
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
  );
};
