import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Activity, AlertTriangle, Clock, CreditCard, TrendingUp, Users } from 'lucide-react';

interface Pulse {
  active_rentals_now: number;
  trials_ending_7d: number;
  accounts_over_plan: number;
  stuck_onboarding: number;
  failed_payments_7d: number;
  revenue_7d: number;
  revenue_sparkline: Array<{ d: string; v: number }> | null;
}

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);

const Sparkline = ({ data }: { data: Array<{ d: string; v: number }> }) => {
  if (!data?.length) return null;
  const max = Math.max(1, ...data.map((p) => p.v));
  const w = 80;
  const h = 24;
  const step = w / Math.max(1, data.length - 1);
  const points = data.map((p, i) => `${i * step},${h - (p.v / max) * h}`).join(' ');
  return (
    <svg width={w} height={h} className="text-primary/70">
      <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points={points} />
    </svg>
  );
};

const Tile = ({
  icon: Icon,
  label,
  value,
  sub,
  tone,
  children,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  sub?: string;
  tone?: 'default' | 'warn' | 'danger';
  children?: React.ReactNode;
}) => (
  <Card
    className={
      tone === 'danger'
        ? 'border-destructive/40 bg-destructive/5'
        : tone === 'warn'
          ? 'border-amber-500/40 bg-amber-500/5'
          : ''
    }
  >
    <CardContent className="p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="text-2xl font-bold tracking-tight">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      {children}
    </CardContent>
  </Card>
);

export const PlatformPulseStrip = () => {
  const [pulse, setPulse] = useState<Pulse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await (supabase as any).rpc('get_super_admin_platform_pulse');
        if (error) throw error;
        const row = Array.isArray(data) ? data[0] : data;
        setPulse(row || null);
      } catch (e) {
        console.error('[PlatformPulse] error', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const v = (n?: number) => (loading ? '…' : (n ?? 0).toLocaleString());

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      <Tile icon={Activity} label="Active rentals" value={v(pulse?.active_rentals_now)} sub="Right now" />
      <Tile
        icon={Clock}
        label="Trials ending"
        value={v(pulse?.trials_ending_7d)}
        sub="Next 7 days"
        tone={(pulse?.trials_ending_7d ?? 0) > 0 ? 'warn' : 'default'}
      />
      <Tile
        icon={AlertTriangle}
        label="Over plan"
        value={v(pulse?.accounts_over_plan)}
        sub="Seats > fleet size"
        tone={(pulse?.accounts_over_plan ?? 0) > 0 ? 'danger' : 'default'}
      />
      <Tile icon={Users} label="Stuck onboarding" value={v(pulse?.stuck_onboarding)} sub="Idle >3 days" />
      <Tile
        icon={CreditCard}
        label="Failed payments"
        value={v(pulse?.failed_payments_7d)}
        sub="Last 7 days"
        tone={(pulse?.failed_payments_7d ?? 0) > 0 ? 'warn' : 'default'}
      />
      <Tile icon={TrendingUp} label="Revenue 7d" value={loading ? '…' : fmtCurrency(pulse?.revenue_7d ?? 0)}>
        <div className="mt-2">
          {pulse?.revenue_sparkline && <Sparkline data={pulse.revenue_sparkline} />}
        </div>
      </Tile>
    </div>
  );
};
