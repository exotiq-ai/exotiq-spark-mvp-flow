import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { onRentVehicleIdsAt } from "@/lib/fleetMetrics";
import { useChartData } from "@/hooks/useChartData";
import { useMoney } from "@/hooks/useMoney";
import { RevenueLineChart } from "@/components/charts/RevenueLineChart";
import { ArrowUpRight, ArrowDownLeft, Clock, TrendingUp, TrendingDown } from "lucide-react";
import { format, isToday } from "date-fns";

interface PulseStripProps {
  onModuleClick: (moduleId: string) => void;
}


/**
 * PulseStrip — three flat tiles below the Daily Brief.
 *
 * No collapsibles. No legends. Click a tile, go to its module.
 * Quiet enough that the Daily Brief stays the hero.
 */
export const PulseStrip = ({ onModuleClick }: PulseStripProps) => {
  const { vehicles, bookings, payments } = useLocationFilteredFleet();
  const { money } = useMoney();

  // ── Revenue: 30-day booked series + today's collected + prior-period delta ──
  // Uses the same chart data source as the Margin module so numbers line up.
  const { collectedData, revenueData } = useChartData(bookings, payments, "30D");
  const revenue = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayTotal = collectedData.find((d) => d.fullDate === todayStr)?.revenue || 0;
    const rangeTotal = revenueData.reduce((s, d) => s + d.revenue, 0);
    const priorTotal = revenueData.reduce((s, d) => s + d.previousRevenue, 0);
    const deltaPct = priorTotal > 0 ? Math.round(((rangeTotal - priorTotal) / priorTotal) * 100) : null;
    return { todayTotal, rangeTotal, deltaPct };
  }, [collectedData, revenueData]);


  // ── Fleet: out / available / maintenance ──
  const fleet = useMemo(() => {
    const now = new Date();
    const active = vehicles.filter((v) => v.status !== "retired");
    const total = active.length;
    // Use shared helper so "out" here matches the KPI rail and useDailyBrief exactly.
    const outIds = onRentVehicleIdsAt(bookings, now);
    const out = outIds.size;
    const maintenance = active.filter((v) => v.status === "maintenance").length;
    const available = Math.max(0, total - out - maintenance);
    return { total, out, available, maintenance };
  }, [vehicles, bookings]);

  // ── Next 4 hours: today's pickups + returns sorted by time ──
  const upcoming = useMemo(() => {
    const now = new Date();
    const horizon = new Date(now.getTime() + 4 * 60 * 60 * 1000);
    const items: { id: string; time: Date; label: string; kind: "pickup" | "return" }[] = [];
    bookings.forEach((b) => {
      const start = new Date(b.start_date);
      const end = new Date(b.end_date);
      if (
        (b.status === "confirmed" || b.status === "pending" || b.status === "active") &&
        isToday(start) &&
        start >= now &&
        start <= horizon
      ) {
        items.push({
          id: `${b.id}-pu`,
          time: start,
          label: b.vehicle_name || b.customer_name || "Pickup",
          kind: "pickup",
        });
      }
      if (
        (b.status === "confirmed" || b.status === "active") &&
        isToday(end) &&
        end >= now &&
        end <= horizon
      ) {
        items.push({
          id: `${b.id}-rt`,
          time: end,
          label: b.vehicle_name || b.customer_name || "Return",
          kind: "return",
        });
      }
    });
    items.sort((a, b) => a.time.getTime() - b.time.getTime());
    return items.slice(0, 3);
  }, [bookings]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
      <Tile
        label="Revenue"
        sub={
          <span className="inline-flex items-center gap-2">
            <span>{money(revenue.todayTotal)} today</span>
            {revenue.deltaPct !== null && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                  revenue.deltaPct >= 0
                    ? "bg-success/10 text-success"
                    : "bg-destructive/10 text-destructive",
                )}
                title={`Booked revenue vs prior 30 days`}
              >
                {revenue.deltaPct >= 0 ? (
                  <TrendingUp className="h-2.5 w-2.5" />
                ) : (
                  <TrendingDown className="h-2.5 w-2.5" />
                )}
                {revenue.deltaPct >= 0 ? "+" : ""}
                {revenue.deltaPct}%
              </span>
            )}
          </span>
        }
        onClick={() => onModuleClick("margin")}
      >
        <RevenueLineChart compact compactRange="30D" compactHeight={56} />
      </Tile>


      <Tile
        label="Fleet"
        sub={`${fleet.out} of ${fleet.total} on rent`}
        onClick={() => onModuleClick("pulse")}
      >
        <FleetBar out={fleet.out} available={fleet.available} maintenance={fleet.maintenance} />
      </Tile>

      <Tile
        label="Next 4 hours"
        sub={upcoming.length > 0 ? `${upcoming.length} scheduled` : "Nothing on the horizon"}
        onClick={() => onModuleClick("book")}
      >
        {upcoming.length === 0 ? (
          <HorizonTimeline />
        ) : (
          <ul className="space-y-1.5">
            {upcoming.map((u) => (
              <li
                key={u.id}
                className="flex items-center gap-2.5 text-sm"
              >
                {u.kind === "pickup" ? (
                  <ArrowUpRight className="h-3.5 w-3.5 text-success flex-shrink-0" />
                ) : (
                  <ArrowDownLeft className="h-3.5 w-3.5 text-warning flex-shrink-0" />
                )}
                <span className="font-medium text-foreground truncate flex-1 min-w-0">
                  {u.label}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {format(u.time, "h:mm a")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Tile>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

const Tile = ({
  label,
  sub,
  onClick,
  children,
}: {
  label: string;
  sub: React.ReactNode;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "group text-left rounded-xl border border-border/60 bg-card/40 p-4 sm:p-5",
      "transition-all hover:border-border hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      "min-h-[120px] flex flex-col",
    )}
  >
    <div className="flex items-baseline justify-between gap-2 mb-3">
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      <span className="text-xs text-muted-foreground/80 truncate">{sub}</span>
    </div>
    <div className="flex-1 flex flex-col justify-end">{children}</div>
  </button>
);


const HorizonTimeline = () => {
  const ticks = useMemo(() => {
    const now = new Date();
    return [1, 2, 3, 4].map((h) => {
      const t = new Date(now.getTime() + h * 60 * 60 * 1000);
      return format(t, "h a").toLowerCase();
    });
  }, []);
  return (
    <div className="space-y-2 py-1">
      <div className="relative h-px bg-border/60">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="absolute top-1/2 -translate-y-1/2 h-1.5 w-px bg-muted-foreground/40"
            style={{ left: `${(i / 3) * 100}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground/70 tabular-nums">
        {ticks.map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
        <Clock className="h-3 w-3" />
        Quiet stretch ahead.
      </div>
    </div>
  );
};


const FleetBar = ({
  out,
  available,
  maintenance,
}: {
  out: number;
  available: number;
  maintenance: number;
}) => {
  const total = out + available + maintenance;
  if (total === 0) {
    return <div className="text-xs text-muted-foreground">No vehicles yet.</div>;
  }
  const seg = (n: number) => `${(n / total) * 100}%`;
  return (
    <div className="space-y-2">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
        {out > 0 && <div className="bg-primary" style={{ width: seg(out) }} />}
        {available > 0 && (
          <div className="bg-success/70" style={{ width: seg(available) }} />
        )}
        {maintenance > 0 && (
          <div className="bg-warning/70" style={{ width: seg(maintenance) }} />
        )}
      </div>
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        <Legend dot="bg-primary" label={`${out} out`} />
        <Legend dot="bg-success/70" label={`${available} free`} />
        {maintenance > 0 && (
          <Legend dot="bg-warning/70" label={`${maintenance} svc`} />
        )}
      </div>
    </div>
  );
};

const Legend = ({ dot, label }: { dot: string; label: string }) => (
  <span className="inline-flex items-center gap-1.5">
    <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
    {label}
  </span>
);

export default PulseStrip;
