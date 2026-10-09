import { BarChart3, CalendarDays, CircleHelp, DollarSign, Info, PackageOpen, Sparkles, TrendingDown, TrendingUp, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Confidence, Insight, InsightAction, InsightKind } from "@/lib/motoriq/types";

const KIND: Record<InsightKind, { icon: typeof Zap; tone: string; label: string }> = {
  "price-action": { icon: Zap, tone: "bg-primary/15 text-primary", label: "Rates" },
  pace: { icon: BarChart3, tone: "bg-accent/15 text-accent", label: "Booking pace" },
  event: { icon: CalendarDays, tone: "bg-warning/15 text-warning", label: "Event" },
  gap: { icon: PackageOpen, tone: "bg-muted text-muted-foreground", label: "Open days" },
  realization: { icon: TrendingDown, tone: "bg-destructive/10 text-destructive", label: "Price accepted" },
  idle: { icon: CircleHelp, tone: "bg-muted text-muted-foreground", label: "Idle cars" },
  revenue: { icon: DollarSign, tone: "bg-success/15 text-success", label: "Booked revenue" },
  data: { icon: Info, tone: "bg-muted text-muted-foreground", label: "About the data" },
};

const CONF: Record<Confidence, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
};

interface Props {
  insight: Insight;
  onAction: (action: InsightAction) => void;
  /** show "apply" style actions (hidden for roles that cannot change rates) */
  canApply?: boolean;
}

export const InsightCard = ({ insight, onAction, canApply = true }: Props) => {
  const k = KIND[insight.kind];
  const Icon = k.icon;
  const actions = insight.actions.filter((a) => canApply || a.kind !== "apply-rates");
  const first = insight.provenance[0];

  return (
    <article className="rounded-xl border bg-card p-4" aria-label={insight.headline}>
      <div className="flex items-start gap-3">
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", k.tone)} aria-hidden>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{k.label}</div>
          <h3 className="mt-0.5 break-words text-base font-semibold leading-snug">{insight.headline}</h3>
          <p className="mt-1 break-words text-sm text-muted-foreground">{insight.body}</p>

          {insight.metrics.length > 0 && (
            <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
              {insight.metrics.map((m) => (
                <div key={m.label}>
                  <dt className="text-[11px] text-muted-foreground">{m.label}</dt>
                  <dd className="text-sm font-semibold tabular-nums">{m.value}</dd>
                </div>
              ))}
            </dl>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {actions.map((a, i) => (
              <Button key={`${a.kind}-${i}`} size="sm" variant={i === 0 && a.kind === "apply-rates" ? "default" : "outline"} className="min-h-9" onClick={() => onAction(a)}>
                {a.kind === "apply-rates" && <TrendingUp className="mr-1.5 h-3.5 w-3.5" />}
                {a.label}
              </Button>
            ))}
            <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Sparkles className="h-3 w-3" /> {CONF[insight.confidence]}
            </span>
          </div>

          {first && (
            <details className="mt-2 text-xs text-muted-foreground">
              <summary className="min-h-8 cursor-pointer select-none py-1.5 hover:text-foreground">
                Where this comes from: {first.source}{first.n ? ` (${first.n})` : ""}
              </summary>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {insight.provenance.map((p, i) => (
                  <li key={i}>{p.source}: {p.n} {p.n === 1 ? "record" : "records"}, as of {p.asOf}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </div>
    </article>
  );
};

export default InsightCard;
