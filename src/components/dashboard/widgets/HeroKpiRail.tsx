import { useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useCountUp } from "@/hooks/useCountUp";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { ArrowUp, ArrowDown } from "lucide-react";

/**
 * HeroKpiRail — editorial 4-cell KPI rail for the Daily Brief hero.
 *
 * Replaces the inline "20 OUT · 6 PICKUPS · …" caption with large tabular
 * numerals, delta-vs-yesterday chips, and a faint sparkline behind the
 * "collected" cell. No boxes, only hairline dividers — keeps the editorial
 * register of the rest of the brief.
 */

interface HeroKpiRailProps {
  onRent: number;
  pickupsToday: number;
  returnsToday: number;
  revenueToday: number;
  utilization: number;
}

const formatMoney = (n: number) => {
  if (n >= 1000) return `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `$${Math.round(n).toLocaleString()}`;
};

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export const HeroKpiRail = ({
  onRent,
  pickupsToday,
  returnsToday,
  revenueToday,
  utilization,
}: HeroKpiRailProps) => {
  const { bookings, payments } = useLocationFilteredFleet();

  // Compute yesterday's same-day metrics + 7-day collections sparkline.
  const { yOnRent, yPickups, yReturns, yCollected, collectedSeries } = useMemo(() => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    // At "this time yesterday", which vehicles were out?
    const yOnRent = new Set(
      bookings
        .filter((b) => {
          const start = new Date(b.start_date);
          const end = new Date(b.end_date);
          return (
            (b.status === "confirmed" || b.status === "active" || b.status === "completed") &&
            start <= yesterday &&
            end >= yesterday
          );
        })
        .map((b) => b.vehicle_id),
    ).size;

    const yPickups = bookings.filter(
      (b) =>
        ["confirmed", "pending", "active", "completed"].includes(b.status ?? "") &&
        isSameDay(new Date(b.start_date), yesterday),
    ).length;

    const yReturns = bookings.filter(
      (b) =>
        ["confirmed", "active", "completed"].includes(b.status ?? "") &&
        isSameDay(new Date(b.end_date), yesterday),
    ).length;

    // 7-day collections sparkline + yesterday's collected total
    const days: number[] = [];
    let yCollected = 0;
    for (let i = 6; i >= 0; i--) {
      const day = new Date(now);
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() - i);
      const dayEnd = new Date(day);
      dayEnd.setHours(23, 59, 59, 999);
      const total = (payments || [])
        .filter((p) => {
          if (!p.transaction_date) return false;
          const td = new Date(p.transaction_date);
          return td >= day && td <= dayEnd;
        })
        .reduce((sum, p) => sum + (p.amount || 0), 0);
      days.push(total);
      if (i === 1) yCollected = total;
    }
    return { yOnRent, yPickups, yReturns, yCollected, collectedSeries: days };
  }, [bookings, payments]);

  const cells = [
    { key: "out", label: "Out", value: onRent, delta: onRent - yOnRent, format: (n: number) => n.toLocaleString() },
    { key: "pickups", label: "Pickups", value: pickupsToday, delta: pickupsToday - yPickups, format: (n: number) => n.toLocaleString() },
    { key: "returns", label: "Returns", value: returnsToday, delta: returnsToday - yReturns, format: (n: number) => n.toLocaleString() },
    revenueToday > 0
      ? {
          key: "collected",
          label: "Collected",
          value: revenueToday,
          delta: revenueToday - yCollected,
          format: formatMoney,
          spark: collectedSeries,
        }
      : {
          key: "utilization",
          label: "Utilization",
          value: utilization,
          delta: 0,
          format: (n: number) => `${n}%`,
        },
  ];

  return (
    <div
      className={cn(
        "grid grid-cols-2 sm:grid-cols-4 gap-y-4",
        "divide-y sm:divide-y-0 sm:divide-x divide-border/50",
      )}
    >
      {cells.map((cell, i) => (
        <motion.div
          key={cell.key}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: i * 0.06, ease: "easeOut" }}
          className={cn(
            "relative px-0 sm:px-5 first:sm:pl-0 last:sm:pr-0 py-2 sm:py-0",
            "min-w-0",
          )}
        >
          {"spark" in cell && cell.spark && (
            <MiniSparkline values={cell.spark} className="absolute inset-x-0 bottom-1 h-6 opacity-[0.18]" />
          )}
          <KpiCell
            label={cell.label}
            value={cell.value}
            delta={cell.delta}
            format={cell.format}
            delay={i * 0.06}
          />
        </motion.div>
      ))}
    </div>
  );
};

interface KpiCellProps {
  label: string;
  value: number;
  delta: number;
  format: (n: number) => string;
  delay: number;
}

const KpiCell = ({ label, value, delta, format, delay }: KpiCellProps) => {
  const { value: animated } = useCountUp({
    end: value,
    duration: 700,
    delay: delay * 1000 + 80,
    decimals: 0,
  });
  const animatedNum = Number(animated.replace(/,/g, ""));
  const display = format(Number.isFinite(animatedNum) ? animatedNum : value);

  return (
    <div className="relative flex flex-col gap-1">
      <div className="flex items-baseline gap-2">
        <span className="text-3xl sm:text-[2.25rem] leading-none font-semibold tracking-tight tabular-nums text-foreground">
          {display}
        </span>
        {delta !== 0 && (
          <DeltaChip delta={delta} />
        )}
      </div>
      <span className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
    </div>
  );
};

const DeltaChip = ({ delta }: { delta: number }) => {
  const positive = delta > 0;
  const Icon = positive ? ArrowUp : ArrowDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[10.5px] font-medium tabular-nums px-1.5 py-0.5 rounded-full",
        positive
          ? "text-success bg-success/10"
          : "text-muted-foreground bg-muted/60",
      )}
      title="vs yesterday"
    >
      <Icon className="h-2.5 w-2.5" strokeWidth={2.5} />
      {Math.abs(delta) >= 1000 ? `${(Math.abs(delta) / 1000).toFixed(1)}k` : Math.abs(delta)}
    </span>
  );
};

const MiniSparkline = ({ values, className }: { values: number[]; className?: string }) => {
  if (values.length === 0) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const w = 100;
  const h = 24;
  const step = w / Math.max(values.length - 1, 1);
  const points = values
    .map((v, i) => `${(i * step).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`)
    .join(" ");
  const areaPoints = `0,${h} ${points} ${w},${h}`;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.6" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill="url(#spark-grad)" />
      <polyline
        points={points}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth={1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default HeroKpiRail;
