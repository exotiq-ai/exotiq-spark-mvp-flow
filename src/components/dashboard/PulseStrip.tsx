import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { isBlockingBooking } from "@/lib/conflictDetection";
import { ArrowUpRight, ArrowDownLeft, Clock } from "lucide-react";
import { format, isToday } from "date-fns";

interface PulseStripProps {
  onModuleClick: (moduleId: string) => void;
}

const money = (n: number) => {
  if (n >= 1000) return `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `$${Math.round(n).toLocaleString()}`;
};

/**
 * PulseStrip — three flat tiles below the Daily Brief.
 *
 * No collapsibles. No legends. Click a tile, go to its module.
 * Quiet enough that the Daily Brief stays the hero.
 */
export const PulseStrip = ({ onModuleClick }: PulseStripProps) => {
  const { vehicles, bookings, payments } = useLocationFilteredFleet();

  // ── Revenue: last 14 days sparkline + today's collected ──
  const revenue = useMemo(() => {
    const days: { date: Date; total: number }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      days.push({ date: d, total: 0 });
    }
    (payments || []).forEach((p) => {
      if (!p.transaction_date) return;
      const td = new Date(p.transaction_date);
      td.setHours(0, 0, 0, 0);
      const idx = days.findIndex((d) => d.date.getTime() === td.getTime());
      if (idx >= 0) days[idx].total += p.amount || 0;
    });
    const todayTotal = days[days.length - 1]?.total || 0;
    const series = days.map((d) => d.total);
    return { series, todayTotal };
  }, [payments]);

  // ── Fleet: out / available / maintenance ──
  const fleet = useMemo(() => {
    const today = new Date();
    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    const active = vehicles.filter((v) => v.status !== "retired");
    const total = active.length;
    const outIds = new Set(
      bookings
        .filter(
          (b) =>
            isBlockingBooking(b.status) &&
            new Date(b.start_date) <= todayEnd &&
            new Date(b.end_date) >= todayStart,
        )
        .map((b) => b.vehicle_id),
    );
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
        sub={`${money(revenue.todayTotal)} today`}
        onClick={() => onModuleClick("vault")}
      >
        <Sparkline values={revenue.series} />
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
  sub: string;
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

const Sparkline = ({ values }: { values: number[] }) => {
  if (values.length === 0) {
    return <div className="h-10 text-xs text-muted-foreground">No revenue yet.</div>;
  }
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const w = 200;
  const h = 40;
  const step = w / Math.max(values.length - 1, 1);
  const points = values
    .map((v, i) => `${(i * step).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`)
    .join(" ");
  const areaPoints = `0,${h} ${points} ${w},${h}`;
  const last = values[values.length - 1];
  const lastY = h - ((last - min) / range) * h;
  const lastX = (values.length - 1) * step;
  const gradId = `pulse-spark-grad-${values.length}`;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="h-10 w-full overflow-visible"
      aria-hidden
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.28" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#${gradId})`} />
      <polyline
        points={points}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={lastY} r={2.5} fill="hsl(var(--primary))" />
    </svg>
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
