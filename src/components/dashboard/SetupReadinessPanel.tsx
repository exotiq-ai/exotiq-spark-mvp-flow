import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Check, ChevronRight, Loader2, Gauge } from 'lucide-react';
import { useTeam } from '@/contexts/TeamContext';
import { useSetupReadiness } from '@/hooks/useSetupReadiness';

/**
 * The single setup list on the dashboard. Two honest tracks — ready to take
 * bookings, ready for Drive Exotiq — with every gap linking to the exact field
 * that fills it. Disappears once both tracks are complete.
 */
export const SetupReadinessPanel = () => {
  const navigate = useNavigate();
  const { currentTeam } = useTeam();
  const {
    rows,
    bookingDone,
    bookingTotal,
    marketplaceDone,
    marketplaceTotal,
    complete,
    isLoading,
  } = useSetupReadiness(currentTeam?.id);

  if (!currentTeam?.id) return null;

  if (isLoading) {
    return (
      <Card className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Checking your setup…
      </Card>
    );
  }

  if (complete) return null;

  const remaining = rows.filter(r => !r.done);
  const done = rows.filter(r => r.done);
  const nextUp = remaining[0];

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="p-6 border-border bg-card">
        <div className="flex items-center gap-3 mb-5">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Gauge className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground">
              {remaining.length === 1
                ? "You're one step from being fully set up"
                : `You're ${remaining.length} steps from being fully set up`}
            </h3>
            <p className="text-xs text-muted-foreground">
              Each step links straight to the setting it needs
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 mb-5">
          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-xs font-medium text-foreground">Ready to take bookings</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {bookingDone} / {bookingTotal}
              </span>
            </div>
            <Progress value={(bookingDone / bookingTotal) * 100} className="h-1.5" />
          </div>
          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-xs font-medium text-foreground">Ready for Drive Exotiq</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {marketplaceDone} / {marketplaceTotal}
              </span>
            </div>
            <Progress value={(marketplaceDone / marketplaceTotal) * 100} className="h-1.5" />
          </div>
        </div>

        <div className="space-y-1">
          {remaining.map((row, i) => (
            <button
              key={row.key}
              onClick={() => navigate(row.to)}
              className="w-full flex items-center gap-3 p-3 rounded-lg text-left hover:bg-muted/50 transition-colors active:scale-[0.995]"
            >
              <div className="h-8 w-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                <span className="text-xs tabular-nums">{i + 1}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{row.label}</p>
                <p className="text-xs text-muted-foreground truncate">{row.hint}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>

        {done.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border flex flex-wrap gap-x-3 gap-y-1.5">
            {done.map(row => (
              <span key={row.key} className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Check className="h-3 w-3 text-success" />
                {row.label}
              </span>
            ))}
          </div>
        )}

        {nextUp && (
          <Button variant="ghost" size="sm" className="mt-4 text-xs" onClick={() => navigate(nextUp.to)}>
            Continue setup
            <ChevronRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        )}
      </Card>
    </motion.div>
  );
};

export default SetupReadinessPanel;
