import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Check, ChevronRight, Loader2, Gauge } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTeam } from '@/contexts/TeamContext';
import { useMarketplaceReadiness } from '@/hooks/useMarketplaceReadiness';

type ReadinessItem = {
  key: string;
  label: string;
  hint: string;
  to: string;
};

/**
 * Tenant-facing readiness meter. Turns the same checks the marketplace uses
 * into a plain-language score with a direct link to fix each gap.
 */
const ITEMS: ReadinessItem[] = [
  { key: 'business_name_set', label: 'Business name', hint: 'Shown on invoices and your booking page', to: '/dashboard/settings?tab=business' },
  { key: 'business_address_set', label: 'Business address', hint: 'Required for tax and payouts', to: '/dashboard/settings?tab=business' },
  { key: 'owner_email_set', label: 'Contact email', hint: 'Where booking requests are sent', to: '/dashboard/settings?tab=business' },
  { key: 'logo_set', label: 'Logo', hint: 'Used across your emails and booking page', to: '/dashboard/settings?tab=business' },
  { key: 'terms_accepted', label: 'Terms accepted', hint: 'Needed before you can take real bookings', to: '/dashboard/settings?tab=legal' },
  { key: 'stripe_charges_enabled', label: 'Card payments', hint: 'Finish payment setup to charge renters', to: '/dashboard/settings?tab=payments' },
  { key: 'stripe_payouts_enabled', label: 'Payouts', hint: 'Where your money lands', to: '/dashboard/settings?tab=payments' },
  { key: 'has_ready_vehicle', label: 'A bookable vehicle', hint: 'Photos, daily rate and pickup location', to: '/dashboard/fleet' },
];

export const BookingReadinessCard = () => {
  const navigate = useNavigate();
  const { currentTeam } = useTeam();
  const { data, isLoading } = useMarketplaceReadiness(currentTeam?.id);

  const rows = useMemo(() => {
    const checks = data?.team_checks ?? {};
    return ITEMS.map(item => ({ ...item, done: checks[item.key] === true }));
  }, [data]);

  const completed = rows.filter(r => r.done).length;
  const score = Math.round((completed / rows.length) * 100);
  const remaining = rows.filter(r => !r.done);

  if (!currentTeam?.id) return null;

  if (isLoading) {
    return (
      <Card className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Checking your setup…
      </Card>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="p-6 border-border bg-card">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Gauge className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">Ready to take bookings</h3>
            <p className="text-xs text-muted-foreground">{completed} of {rows.length} complete</p>
          </div>
          <Badge variant={score === 100 ? 'default' : 'secondary'} className="tabular-nums">
            {score}%
          </Badge>
        </div>

        <Progress value={score} className="h-1.5 mb-5" />

        {score === 100 ? (
          <p className="text-sm text-muted-foreground">
            Everything's in place — you can take bookings and list on the marketplace.
          </p>
        ) : (
          <div className="space-y-1">
            {remaining.map(row => (
              <button
                key={row.key}
                onClick={() => navigate(row.to)}
                className="w-full flex items-center gap-3 p-3 rounded-lg text-left hover:bg-muted/50 transition-colors"
              >
                <div className="h-8 w-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                  <span className="text-xs">{rows.indexOf(row) + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{row.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{row.hint}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        )}

        {completed > 0 && score < 100 && (
          <div className="mt-4 pt-4 border-t border-border flex flex-wrap gap-2">
            {rows.filter(r => r.done).map(row => (
              <span
                key={row.key}
                className={cn('inline-flex items-center gap-1 text-xs text-muted-foreground')}
              >
                <Check className="h-3 w-3 text-success" />
                {row.label}
              </span>
            ))}
          </div>
        )}

        {score < 100 && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-4 text-xs"
            onClick={() => navigate(remaining[0]?.to ?? '/dashboard/settings?tab=business')}
          >
            Continue setup
            <ChevronRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        )}
      </Card>
    </motion.div>
  );
};

export default BookingReadinessCard;
