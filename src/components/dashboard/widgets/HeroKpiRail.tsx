import { useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useCountUp } from "@/hooks/useCountUp";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import {
  isSameDay,
  onRentVehicleIdsAt,
  pickupsOnDay,
  returnsOnDay,
  sumCollectedOnDay,
} from "@/lib/fleetMetrics";
import { DeltaChip } from "./DeltaChip";

/**
 * HeroKpiRail — editorial 4-cell KPI rail for the Daily Brief hero.
 *
 * Every filter/status decision routes through src/lib/fleetMetrics so today's
 * and yesterday's numbers use identical definitions. "Collected" reads from
 * payments (cash actually received), never booking total_value.
 */

interface HeroKpiRailProps {
  onRent: number;
  pickupsToday: number;
  returnsToday: number;
  /** Cash collected today. Passed in from useDailyBrief so the whole dashboard agrees. */
  collectedToday: number;
  utilization: number;
}

const formatMoney = (n: number) => {
  if (n >= 1000) return `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `$${Math.round(n).toLocaleString()}`;
};

const identity = (n: number) => n.toLocaleString();

export const HeroKpiRail = ({
  onRent,
  pickupsToday,
  returnsToday,
  collectedToday,
  utilization,
}: HeroKpiRailProps) => {
  const { bookings, payments, vehicles } = useLocationFilteredFleet();

  // Yesterday's same-day metrics + 7-day utilization avg using the exact same helpers.
  const { yOnRent, yPickups, yReturns, yCollected, collectedSeries, utilization7dAvg } = useMemo(() => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayDay = new Date(yesterday);
    yesterdayDay.setHours(12, 0, 0, 0);

    const yOnRent = onRentVehicleIdsAt(bookings || [], yesterday).size;
    const yPickups = pickupsOnDay(bookings || [], yesterdayDay).length;
    const yReturns = returnsOnDay(bookings || [], yesterdayDay).length;
    const yCollected = sumCollectedOnDay(payments || [], yesterday);

    // 7-day collections sparkline
    const days: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date(now);
      day.setDate(day.getDate() - i);
      days.push(sumCollectedOnDay(payments || [], day));
    }

    // 7-day rolling utilization avg (distinct on-rent vehicles / fleet size, per day)
    const fleetSize = (vehicles || []).filter((v: { status?: string }) => v.status !== 'retired').length;
    let utilization7dAvg = 0;
    if (fleetSize > 0) {
      let sum = 0;
      for (let i = 0; i < 7; i++) {
        const day = new Date(now);
        day.setDate(day.getDate() - i);
        day.setHours(12, 0, 0, 0);
        sum += onRentVehicleIdsAt(bookings || [], day).size / fleetSize;
      }
      utilization7dAvg = Math.round((sum / 7) * 100);
    }

    return { yOnRent, yPickups, yReturns, yCollected, collectedSeries: days, utilization7dAvg };
  }, [bookings, payments, vehicles]);

  // Suppress noise from silent-void days (avoid endless red 0→0 chips)
  const _ = isSameDay; // keep import if unused later
  void _;

  const cells = [
    { key: "out", label: "Out", value: onRent, delta: onRent - yOnRent, format: identity },
    { key: "pickups", label: "Pickups", value: pickupsToday, delta: pickupsToday - yPickups, format: identity },
    { key: "returns", label: "Returns", value: returnsToday, delta: returnsToday - yReturns, format: identity },
    collectedToday > 0 || yCollected > 0
      ? {
          key: "collected",
          label: "Collected",
          value: collectedToday,
          delta: collectedToday - yCollected,
          format: formatMoney,
          spark: collectedSeries,
        }
      : {
          key: "utilization",
          label: "Utilization",
          value: utilization,
          delta: 0,
          format: (n: number) => `${n}%`,
          subline: `7-day avg: ${utilization7dAvg}%`,
        },
  ];

  return (
    <div className="space-y-2">
    <dl
      className={cn(
        "grid grid-cols-2 sm:grid-cols-4 gap-y-4",
        "divide-y sm:divide-y-0 sm:divide-x divide-border/50",
      )}
      aria-label="Today's fleet KPIs"
    >
      {cells.map((cell, i) => (
        <motion.div
          key={cell.key}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, delay: i * 0.05, ease: "easeOut" }}
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
            unit={cell.key === "collected" ? undefined : ""}
            format={cell.format}
            delay={i * 0.05}
          />
        </motion.div>
      ))}
    </dl>
      <p className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-muted-foreground px-0 sm:px-5">
        Utilization today {utilization}% · 7-day avg {utilization7dAvg}%
      </p>
    </div>
  );
};

interface KpiCellProps {
  label: string;
  value: number;
  delta: number;
  unit?: string;
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
        <dd className="text-[2rem] sm:text-[2.125rem] leading-none font-semibold tracking-tight tabular-nums text-foreground m-0">
          {display}
        </dd>
        {delta !== 0 && (
          <DeltaChip delta={delta} title="vs yesterday" />
        )}
      </div>
      <dt className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </dt>
    </div>
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
