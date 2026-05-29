import { useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatPercent } from "@/lib/marginCsv";
import { TrendingUp, TrendingDown } from "lucide-react";
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
} from "./useMarginData";

export function MarginHeroOverview() {
  const { loading, bookings, payments, expenses, payouts } = useMarginData();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

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
  const positive = marginPct >= 0;

  const hasAnyData =
    bookings.length > 0 || payments.length > 0 || expenses.length > 0 || payouts.length > 0;

  const slides = [
    {
      key: "revenue",
      title: "Revenue",
      primary: { label: "Gross Booked", value: gross },
      secondary: [
        { label: "Collected", value: collected },
        { label: "Outstanding", value: outstanding },
      ],
    },
    {
      key: "costs",
      title: "Costs",
      primary: { label: "Vehicle Expenses", value: vehicleExpenses },
      secondary: [
        { label: "Platform Fees", value: fees },
        { label: "Refunds", value: refunds },
      ],
    },
    {
      key: "partners",
      title: "Partners",
      primary: { label: "Partner Payouts", value: totalPayouts },
      secondary: [
        { label: "Pending", value: pendingPayouts },
        { label: "Bookings", value: bookings.filter((b) => b.status !== "cancelled").length, isCount: true },
      ],
    },
  ];

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    if (idx !== active) setActive(idx);
  };

  return (
    <div className="space-y-3">
      {/* Hero */}
      <Card className="border-primary/30 overflow-hidden">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
              Operator Net
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full",
                positive ? "bg-emerald-500/10 text-emerald-500" : "bg-destructive/10 text-destructive",
              )}
            >
              {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {formatPercent(marginPct)}
            </span>
          </div>
          <div className="text-3xl font-semibold tabular-nums truncate">
            {loading ? "…" : formatCurrency(operatorNet)}
          </div>
          <div className="text-xs text-muted-foreground tabular-nums">
            from {formatCurrency(gross)} gross · {bookings.filter((b) => b.status !== "cancelled").length} bookings
          </div>
        </CardContent>
      </Card>

      {/* Swipeable secondary cards */}
      <div>
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="flex overflow-x-auto snap-x snap-mandatory gap-3 -mx-4 px-4 pb-2 scrollbar-none"
          style={{ scrollbarWidth: "none" }}
        >
          {slides.map((s) => (
            <Card key={s.key} className="snap-center shrink-0 w-[calc(100%-2rem)]">
              <CardContent className="p-4 space-y-2">
                <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                  {s.title}
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm text-muted-foreground truncate">{s.primary.label}</span>
                  <span className="text-lg font-semibold tabular-nums">
                    {formatCurrency(s.primary.value as number)}
                  </span>
                </div>
                <div className="pt-2 border-t border-border/50 grid grid-cols-2 gap-2">
                  {s.secondary.map((row) => (
                    <div key={row.label} className="min-w-0">
                      <div className="text-[10px] text-muted-foreground uppercase truncate">{row.label}</div>
                      <div className="text-sm font-medium tabular-nums truncate">
                        {(row as any).isCount ? row.value : formatCurrency(row.value as number)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="flex justify-center gap-1.5 mt-2">
          {slides.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === active ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30",
              )}
            />
          ))}
        </div>
      </div>

      {!loading && !hasAnyData && (
        <Card className="border-dashed">
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            No bookings, expenses, or payouts in this range.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
