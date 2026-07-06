import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrency, formatPercent } from "@/lib/marginCsv";
import { TrendingUp, TrendingDown, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useMarginData,
  sumGross,
  sumCollected,
  sumRefunds,
  sumPlatformFees,
  sumVehicleExpenses,
  sumPendingPayouts,
  sumPartnerPayouts,
  countsForRevenue,
} from "./useMarginData";

/**
 * Desktop margin hero — 3-zone rail matching Dashboard/Pulse cohesion:
 *   [ Operator Net (hero) ] [ Margin % ] [ Gross Booked ]
 * followed by a single dense secondary strip for supporting metrics.
 */
export function MarginOverview() {
  const { loading, bookings, payments, expenses, payouts } = useMarginData();

  const gross = sumGross(bookings);
  const collected = sumCollected(payments);
  const refunds = sumRefunds(payments);
  const outstanding = Math.max(gross - collected - refunds, 0);
  const fees = sumPlatformFees(bookings);
  const vehicleExpenses = sumVehicleExpenses(expenses);
  const pendingPayouts = sumPendingPayouts(payouts);
  const totalPayouts = sumPartnerPayouts(payouts);
  const operatorNet = gross - fees - vehicleExpenses - totalPayouts;
  const marginPct = gross > 0 ? (operatorNet / gross) * 100 : 0;
  const bookingCount = bookings.filter((b) => countsForRevenue(b.status)).length;
  const positive = operatorNet >= 0;
  const marginHealth =
    marginPct >= 30 ? "Healthy" : marginPct >= 10 ? "Steady" : marginPct > 0 ? "Tight" : "Loss";
  const marginHealthTone =
    marginPct >= 30
      ? "text-emerald-500"
      : marginPct >= 10
        ? "text-foreground"
        : marginPct > 0
          ? "text-amber-500"
          : "text-destructive";

  const hasAnyData =
    bookings.length > 0 || payments.length > 0 || expenses.length > 0 || payouts.length > 0;

  const secondary = [
    { label: "Collected", value: formatCurrency(collected) },
    { label: "Outstanding", value: formatCurrency(outstanding) },
    { label: "Platform fees", value: formatCurrency(fees) },
    { label: "Vehicle expenses", value: formatCurrency(vehicleExpenses) },
    { label: "Partner payouts", value: formatCurrency(totalPayouts), sub: pendingPayouts > 0 ? `${formatCurrency(pendingPayouts)} pending` : undefined },
    { label: "Refunds", value: formatCurrency(refunds) },
  ];

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-3">
        {/* Hero rail */}
        <div className="grid grid-cols-1 md:grid-cols-[1.6fr,1fr,1fr] gap-3">
          {/* Operator Net — hero tile */}
          <Card className="border-primary/30 bg-gradient-to-br from-primary/[0.04] to-transparent">
            <CardContent className="p-5 space-y-2 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground flex items-center gap-1">
                  Operator Net
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="text-muted-foreground/60 hover:text-foreground">
                        <Info className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[260px] text-xs">
                      Gross Booked − Platform Fees − Vehicle Expenses − Partner Payouts. The bottom line after partners are paid.
                    </TooltipContent>
                  </Tooltip>
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full",
                    positive ? "bg-emerald-500/10 text-emerald-500" : "bg-destructive/10 text-destructive",
                  )}
                >
                  {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {marginHealth}
                </span>
              </div>
              <div className={cn("text-3xl md:text-[32px] font-semibold tabular-nums leading-none truncate", !positive && "text-destructive")}>
                {loading ? "…" : formatCurrency(operatorNet)}
              </div>
              <div className="text-xs text-muted-foreground tabular-nums">
                from {formatCurrency(gross)} gross · {bookingCount} {bookingCount === 1 ? "booking" : "bookings"}
              </div>
            </CardContent>
          </Card>

          {/* Margin % */}
          <Card>
            <CardContent className="p-5 space-y-2 min-w-0">
              <span className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground flex items-center gap-1">
                Margin
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="text-muted-foreground/60 hover:text-foreground">
                      <Info className="h-3 w-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[220px] text-xs">
                    Operator Net ÷ Gross Booked.
                  </TooltipContent>
                </Tooltip>
              </span>
              <div className={cn("text-3xl font-semibold tabular-nums leading-none", marginHealthTone)}>
                {loading ? "…" : formatPercent(marginPct)}
              </div>
              <div className="text-xs text-muted-foreground">{marginHealth} margin</div>
            </CardContent>
          </Card>

          {/* Gross Booked */}
          <Card>
            <CardContent className="p-5 space-y-2 min-w-0">
              <span className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">
                Gross Booked
              </span>
              <div className="text-3xl font-semibold tabular-nums leading-none truncate">
                {loading ? "…" : formatCurrency(gross)}
              </div>
              <div className="text-xs text-muted-foreground">
                {bookingCount} {bookingCount === 1 ? "booking" : "bookings"} in period
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Secondary strip — one dense row */}
        <Card className="bg-muted/30">
          <CardContent className="p-3">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-x-4 gap-y-2">
              {secondary.map((s) => (
                <div key={s.label} className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">
                    {s.label}
                  </div>
                  <div className="text-sm font-semibold tabular-nums truncate">
                    {loading ? "…" : s.value}
                  </div>
                  {s.sub && (
                    <div className="text-[10px] text-amber-600 dark:text-amber-400 tabular-nums truncate">
                      {s.sub}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {!loading && !hasAnyData && (
          <Card className="border-dashed">
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              No bookings, expenses, or partner payouts in this range yet.
              Adjust filters or record activity to see your margin breakdown.
            </CardContent>
          </Card>
        )}
      </div>
    </TooltipProvider>
  );
}
