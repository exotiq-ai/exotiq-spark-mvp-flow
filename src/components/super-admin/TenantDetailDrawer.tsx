import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Copy, Mail, Phone } from 'lucide-react';

interface Props {
  teamId: string | null;
  onClose: () => void;
}

interface Detail {
  team_id: string;
  team_name: string;
  plan_tier: string | null;
  fleet_size_cap: number | null;
  is_annual: boolean | null;
  trial_start: string | null;
  trial_end: string | null;
  is_demo: boolean;
  stripe_connected: boolean;
  created_at: string;
  owner: { user_id: string; full_name: string | null; email: string | null; phone: string | null };
  fleet: { total: number; active: number; maintenance: number; retired: number; missing_hero_photo: number };
  bookings: { active_now: number; pending: number; this_week: number; last_week: number };
  revenue_30d: number;
  last_payment_at: string | null;
  last_login: string | null;
  active_users_7d: number;
  onboarding_pct: number | null;
  seat_audit_reviewed_at: string | null;
}

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);

const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleString() : '—');

const Stat = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="text-sm font-medium">{value}</span>
  </div>
);

export const TenantDetailDrawer = ({ teamId, onClose }: Props) => {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!teamId) {
      setDetail(null);
      return;
    }
    setLoading(true);
    (async () => {
      try {
        const { data, error } = await (supabase as any).rpc('get_super_admin_tenant_detail', { p_team_id: teamId });
        if (error) throw error;
        setDetail(data as Detail);
      } catch (e) {
        console.error('[TenantDetail] error', e);
        toast({ title: 'Could not load tenant', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    })();
  }, [teamId, toast]);

  const copySummary = async () => {
    if (!detail) return;
    const text = [
      `Account: ${detail.team_name}`,
      `Owner: ${detail.owner.full_name || '—'} <${detail.owner.email || '—'}>`,
      `Plan: ${detail.plan_tier || '—'} (cap ${detail.fleet_size_cap ?? '—'})`,
      `Vehicles in use: ${detail.fleet.active + detail.fleet.maintenance}`,
      `Active rentals: ${detail.bookings.active_now}`,
      `Revenue 30d: ${fmtCurrency(detail.revenue_30d)}`,
      `Last login: ${fmtDate(detail.last_login)}`,
      detail.trial_end ? `Trial ends: ${fmtDate(detail.trial_end)}` : null,
    ]
      .filter(Boolean)
      .join('\n');
    await navigator.clipboard.writeText(text);
    toast({ title: 'Support summary copied' });
  };

  const open = !!teamId;
  const trend =
    detail && detail.bookings.last_week > 0
      ? Math.round(((detail.bookings.this_week - detail.bookings.last_week) / detail.bookings.last_week) * 100)
      : null;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        {loading || !detail ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">Loading…</div>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                {detail.team_name}
                {detail.is_demo && <Badge variant="secondary">Demo</Badge>}
              </SheetTitle>
              <SheetDescription>
                {detail.plan_tier || 'No plan'} · cap {detail.fleet_size_cap ?? '—'} ·{' '}
                {detail.stripe_connected ? 'Stripe connected' : 'No Stripe'}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-4 mt-4">
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-4 space-y-2">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Business Contact
                  </div>
                  <div className="text-sm font-medium">{detail.owner.full_name || 'No name on file'}</div>
                  {detail.owner.email && (
                    <a
                      href={`mailto:${detail.owner.email}`}
                      className="flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      {detail.owner.email}
                    </a>
                  )}
                  {detail.owner.phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />
                      {detail.owner.phone}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground pt-1">
                    This view is audit-logged.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 grid grid-cols-3 gap-3">
                  <Stat label="Total" value={detail.fleet.total} />
                  <Stat label="Active" value={detail.fleet.active} />
                  <Stat label="Maintenance" value={detail.fleet.maintenance} />
                  <Stat label="Retired" value={detail.fleet.retired} />
                  <Stat label="Missing hero" value={detail.fleet.missing_hero_photo} />
                  <Stat
                    label="vs Plan cap"
                    value={
                      detail.fleet_size_cap
                        ? `${detail.fleet.active + detail.fleet.maintenance} / ${detail.fleet_size_cap}`
                        : '—'
                    }
                  />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 grid grid-cols-3 gap-3">
                  <Stat label="Active rentals" value={detail.bookings.active_now} />
                  <Stat label="Pending" value={detail.bookings.pending} />
                  <Stat
                    label="WoW trend"
                    value={trend === null ? '—' : `${trend > 0 ? '+' : ''}${trend}%`}
                  />
                  <Stat label="Revenue 30d" value={fmtCurrency(detail.revenue_30d)} />
                  <Stat label="Last payment" value={fmtDate(detail.last_payment_at)} />
                  <Stat label="Trial ends" value={fmtDate(detail.trial_end)} />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 grid grid-cols-3 gap-3">
                  <Stat label="Last login" value={fmtDate(detail.last_login)} />
                  <Stat label="Active users 7d" value={detail.active_users_7d} />
                  <Stat
                    label="Onboarding"
                    value={detail.onboarding_pct !== null ? `${detail.onboarding_pct}%` : '—'}
                  />
                </CardContent>
              </Card>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={copySummary} className="gap-2">
                  <Copy className="h-3.5 w-3.5" /> Copy support summary
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};
