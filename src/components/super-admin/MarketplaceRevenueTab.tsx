import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  AlertTriangle,
  DollarSign,
  Percent,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Undo2,
} from 'lucide-react';

interface RevenueRow {
  team_id: string;
  team_name: string;
  is_demo: boolean;
  paid_bookings: number;
  gross_volume: number;
  exotiq_revenue: number;
  platform_fee: number;
  protection_fee: number;
  state_fee: number;
  processing_fee: number;
  uncollected_fees: number;
  uncollected_bookings: number;
  zero_fee_paid_bookings: number;
  refunded_volume: number;
  direct_bookings: number;
  direct_volume: number;
  marketplace_attempts: number;
  last_paid_at: string | null;
}

interface BookingRow {
  booking_id: string;
  booking_ref: string;
  team_name: string;
  status: string;
  created_at: string;
  paid_at: string | null;
  customer_name: string | null;
  vehicle_name: string | null;
  total_value: number;
  platform_fee: number;
  protection_fee: number;
  state_fee: number;
  processing_fee: number;
  exotiq_total: number;
  operator_payment_intent_id: string | null;
  exotiq_payment_intent_id: string | null;
  exotiq_leg_attempt: number;
  fee_state: string;
}

const PERIODS = [
  { key: '7d', label: '7 days', days: 7 },
  { key: '30d', label: '30 days', days: 30 },
  { key: '90d', label: '90 days', days: 90 },
  { key: 'all', label: 'All time', days: 3650 },
] as const;

const money = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n || 0);

const money0 = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);

const dateStr = (s: string | null) => (s ? new Date(s).toLocaleDateString() : '—');

const FEE_STATE: Record<string, { label: string; variant: 'default' | 'destructive' | 'secondary' | 'outline' }> = {
  collected: { label: 'Fee collected', variant: 'default' },
  uncollected: { label: 'Fee not collected', variant: 'destructive' },
  zero_fee: { label: 'Zero fee', variant: 'outline' },
  refunded: { label: 'Refunded', variant: 'secondary' },
  unpaid: { label: 'Never paid', variant: 'outline' },
};

const Tile = ({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  sub?: string;
  tone?: 'default' | 'danger';
}) => (
  <Card className={tone === 'danger' ? 'border-destructive/40 bg-destructive/5' : ''}>
    <CardContent className="p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="text-2xl font-bold tracking-tight">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </CardContent>
  </Card>
);

export const MarketplaceRevenueTab = () => {
  const { toast } = useToast();
  const [period, setPeriod] = useState<(typeof PERIODS)[number]['key']>('30d');
  const [rows, setRows] = useState<RevenueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [drill, setDrill] = useState<{ teamId: string | null; teamName: string } | null>(null);
  const [drillRows, setDrillRows] = useState<BookingRow[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);
  const [retrying, setRetrying] = useState<string | null>(null);

  const range = useMemo(() => {
    const days = PERIODS.find((p) => p.key === period)!.days;
    const from = new Date(Date.now() - days * 86400000).toISOString();
    return { from, to: new Date().toISOString() };
  }, [period]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc('get_super_admin_marketplace_revenue', {
        _from: range.from,
        _to: range.to,
      });
      if (error) throw error;
      setRows(((data as RevenueRow[]) || []).map((r) => ({ ...r })));
    } catch (e) {
      console.error('[MarketplaceRevenue] error', e);
      toast({
        title: 'Could not load revenue',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [range, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const openDrill = useCallback(
    async (teamId: string | null, teamName: string) => {
      setDrill({ teamId, teamName });
      setDrillLoading(true);
      setDrillRows([]);
      try {
        const { data, error } = await (supabase as any).rpc('get_super_admin_marketplace_bookings', {
          _team_id: teamId,
          _from: range.from,
          _to: range.to,
        });
        if (error) throw error;
        setDrillRows((data as BookingRow[]) || []);
      } catch (e) {
        console.error('[MarketplaceRevenue] drill error', e);
        toast({
          title: 'Could not load bookings',
          description: e instanceof Error ? e.message : String(e),
          variant: 'destructive',
        });
      } finally {
        setDrillLoading(false);
      }
    },
    [range, toast],
  );

  const retryFee = async (bookingRef: string) => {
    setRetrying(bookingRef);
    try {
      const { data, error } = await supabase.functions.invoke('rent-retry-exotiq-leg', {
        body: { booking_ref: bookingRef },
      });
      if (error) throw error;
      toast({
        title: 'Retry submitted',
        description: `${bookingRef}: ${(data as any)?.status || 'requested'}`,
      });
      if (drill) await openDrill(drill.teamId, drill.teamName);
      await load();
    } catch (e) {
      toast({
        title: 'Retry failed',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    } finally {
      setRetrying(null);
    }
  };

  const totals = useMemo(() => {
    const t = {
      revenue: 0,
      platform: 0,
      protection: 0,
      state: 0,
      processing: 0,
      gross: 0,
      uncollected: 0,
      uncollectedCount: 0,
      zeroFee: 0,
      refunded: 0,
      paid: 0,
    };
    rows.forEach((r) => {
      if (r.is_demo) return;
      t.revenue += Number(r.exotiq_revenue);
      t.platform += Number(r.platform_fee);
      t.protection += Number(r.protection_fee);
      t.state += Number(r.state_fee);
      t.processing += Number(r.processing_fee);
      t.gross += Number(r.gross_volume);
      t.uncollected += Number(r.uncollected_fees);
      t.uncollectedCount += Number(r.uncollected_bookings);
      t.zeroFee += Number(r.zero_fee_paid_bookings);
      t.refunded += Number(r.refunded_volume);
      t.paid += Number(r.paid_bookings);
    });
    return t;
  }, [rows]);

  const takeRate = totals.gross > 0 ? (totals.revenue / totals.gross) * 100 : 0;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => r.team_name.toLowerCase().includes(term));
  }, [rows, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5">
          {PERIODS.map((p) => (
            <Button
              key={p.key}
              size="sm"
              variant={period === p.key ? 'default' : 'outline'}
              onClick={() => setPeriod(p.key)}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <Tile
          icon={DollarSign}
          label="Exotiq revenue"
          value={loading ? '…' : money(totals.revenue)}
          sub={`${totals.paid} paid marketplace booking${totals.paid === 1 ? '' : 's'}`}
        />
        <Tile
          icon={Percent}
          label="Effective take rate"
          value={loading ? '…' : `${takeRate.toFixed(1)}%`}
          sub={`on ${money0(totals.gross)} gross volume`}
        />
        <Tile
          icon={ShieldCheck}
          label="Fee breakdown"
          value={loading ? '…' : money0(totals.platform)}
          sub={`platform · ${money0(totals.protection)} protection · ${money0(totals.state)} state · ${money0(totals.processing)} processing`}
        />
        <Tile
          icon={AlertTriangle}
          label="Fees owed, not collected"
          value={loading ? '…' : money(totals.uncollected)}
          sub={`${totals.uncollectedCount} booking${totals.uncollectedCount === 1 ? '' : 's'} · ${totals.zeroFee} zero-fee paid`}
          tone={totals.uncollected > 0 || totals.zeroFee > 0 ? 'danger' : 'default'}
        />
        <Tile icon={Undo2} label="Refunded volume" value={loading ? '…' : money(totals.refunded)} sub="In period" />
      </div>

      {!loading && (totals.uncollectedCount > 0 || totals.zeroFee > 0) && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Exposure
            </CardTitle>
            <CardDescription>
              {totals.uncollectedCount > 0 && (
                <>
                  {money(totals.uncollected)} across {totals.uncollectedCount} booking
                  {totals.uncollectedCount === 1 ? '' : 's'} where the operator was paid but the Exotiq fee charge never
                  went through.{' '}
                </>
              )}
              {totals.zeroFee > 0 && (
                <>
                  {totals.zeroFee} paid marketplace booking{totals.zeroFee === 1 ? '' : 's'} carried no fee snapshot —
                  usually a missing platform fee confirmation on that account.
                </>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="sm" variant="outline" onClick={() => openDrill(null, 'All tenants')}>
              Review affected bookings
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Take rate by tenant</CardTitle>
          <CardDescription>
            Only marketplace bookings carry an Exotiq fee. Direct bookings created inside an operator's own dashboard are
            0% by design and shown separately. Click a row for booking-level detail.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tenant…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b">
                <tr>
                  <th className="text-left py-2 pr-3 font-medium">Tenant</th>
                  <th className="text-right py-2 pr-3 font-medium">Paid mkt</th>
                  <th className="text-right py-2 pr-3 font-medium">Gross</th>
                  <th className="text-right py-2 pr-3 font-medium">Exotiq rev</th>
                  <th className="text-right py-2 pr-3 font-medium">Take</th>
                  <th className="text-right py-2 pr-3 font-medium">Uncollected</th>
                  <th className="text-right py-2 pr-3 font-medium">Direct (no fee)</th>
                  <th className="text-left py-2 font-medium">Last paid</th>
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
                      No booking activity in this period
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => {
                    const rate = Number(r.gross_volume) > 0 ? (Number(r.exotiq_revenue) / Number(r.gross_volume)) * 100 : 0;
                    const noMarketplace = Number(r.paid_bookings) === 0;
                    return (
                      <tr
                        key={r.team_id}
                        className="border-b last:border-0 hover:bg-accent/40 cursor-pointer transition-colors"
                        onClick={() => openDrill(r.team_id, r.team_name)}
                      >
                        <td className="py-2 pr-3 font-medium">
                          {r.team_name}
                          {r.is_demo && (
                            <Badge variant="secondary" className="ml-2 text-[10px]">
                              Demo
                            </Badge>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">{r.paid_bookings}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{money0(Number(r.gross_volume))}</td>
                        <td className="py-2 pr-3 text-right tabular-nums font-medium">
                          {noMarketplace ? (
                            <span className="text-muted-foreground font-normal">no fees expected</span>
                          ) : (
                            money(Number(r.exotiq_revenue))
                          )}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">{noMarketplace ? '—' : `${rate.toFixed(1)}%`}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {Number(r.uncollected_fees) > 0 ? (
                            <span className="text-destructive font-medium">{money(Number(r.uncollected_fees))}</span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">
                          {r.direct_bookings} · {money0(Number(r.direct_volume))}
                        </td>
                        <td className="py-2 text-muted-foreground">{dateStr(r.last_paid_at)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!drill} onOpenChange={(o) => !o && setDrill(null)}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{drill?.teamName} — marketplace bookings</DialogTitle>
            <DialogDescription>
              Every marketplace booking in the selected period, with each fee component and both Stripe payment
              references. The operator leg is the rental; the Exotiq leg is our revenue.
            </DialogDescription>
          </DialogHeader>

          {drillLoading ? (
            <div className="py-10 text-center text-muted-foreground">Loading…</div>
          ) : drillRows.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              No marketplace bookings in this period. Bookings created inside the operator dashboard are direct bookings
              and carry no platform fee.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b">
                  <tr>
                    <th className="text-left py-2 pr-3 font-medium">Ref</th>
                    <th className="text-left py-2 pr-3 font-medium">Status</th>
                    <th className="text-left py-2 pr-3 font-medium">Customer</th>
                    <th className="text-right py-2 pr-3 font-medium">Total</th>
                    <th className="text-right py-2 pr-3 font-medium">Platform</th>
                    <th className="text-right py-2 pr-3 font-medium">Protection</th>
                    <th className="text-right py-2 pr-3 font-medium">State</th>
                    <th className="text-right py-2 pr-3 font-medium">Processing</th>
                    <th className="text-right py-2 pr-3 font-medium">Exotiq</th>
                    <th className="text-left py-2 pr-3 font-medium">Fee state</th>
                    <th className="text-left py-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {drillRows.map((b) => {
                    const meta = FEE_STATE[b.fee_state] || { label: b.fee_state, variant: 'outline' as const };
                    return (
                      <tr key={b.booking_id} className="border-b last:border-0 align-top">
                        <td className="py-2 pr-3 font-medium whitespace-nowrap">
                          {b.booking_ref}
                          <div className="text-[10px] text-muted-foreground font-normal">{dateStr(b.created_at)}</div>
                          {b.operator_payment_intent_id && (
                            <div className="text-[10px] text-muted-foreground font-mono font-normal">
                              op {b.operator_payment_intent_id.slice(-8)}
                            </div>
                          )}
                          {b.exotiq_payment_intent_id && b.exotiq_payment_intent_id !== 'none_required' && (
                            <div className="text-[10px] text-muted-foreground font-mono font-normal">
                              fee {b.exotiq_payment_intent_id.slice(-8)}
                            </div>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap">{b.status}</td>
                        <td className="py-2 pr-3">
                          {b.customer_name || '—'}
                          <div className="text-[10px] text-muted-foreground">{b.vehicle_name || ''}</div>
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">{money(Number(b.total_value))}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{money(Number(b.platform_fee))}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{money(Number(b.protection_fee))}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{money(Number(b.state_fee))}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{money(Number(b.processing_fee))}</td>
                        <td className="py-2 pr-3 text-right tabular-nums font-medium">{money(Number(b.exotiq_total))}</td>
                        <td className="py-2 pr-3">
                          <Badge variant={meta.variant} className="text-[10px]">
                            {meta.label}
                          </Badge>
                          {b.exotiq_leg_attempt > 0 && (
                            <div className="text-[10px] text-muted-foreground mt-1">
                              {b.exotiq_leg_attempt} retry attempt{b.exotiq_leg_attempt === 1 ? '' : 's'}
                            </div>
                          )}
                        </td>
                        <td className="py-2">
                          {b.fee_state === 'uncollected' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5"
                              disabled={retrying === b.booking_ref}
                              onClick={() => retryFee(b.booking_ref)}
                            >
                              <RotateCcw className={`h-3 w-3 ${retrying === b.booking_ref ? 'animate-spin' : ''}`} />
                              Retry fee
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MarketplaceRevenueTab;
