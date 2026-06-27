import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Calendar,
  Car,
  Activity,
  TrendingUp,
  ChevronRight,
} from "lucide-react";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { useMemo } from "react";

interface QuickJumpTilesProps {
  onModuleClick: (moduleId: string) => void;
}

/**
 * QuickJumpTiles — 2×2 grid of module shortcuts with live counts.
 * Sits to the right of the LiveActivityStrip in the dashboard's 3rd band.
 */
export const QuickJumpTiles = ({ onModuleClick }: QuickJumpTilesProps) => {
  const { vehicles, bookings } = useLocationFilteredFleet();

  const { todayBookings, vehicleCount, pendingCount } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayB = bookings.filter((b) => {
      const start = new Date(b.start_date);
      return start >= today && start < tomorrow;
    }).length;

    const pending = bookings.filter((b) => b.status === "pending").length;

    return {
      todayBookings: todayB,
      vehicleCount: vehicles.length,
      pendingCount: pending,
    };
  }, [vehicles, bookings]);

  const tiles = [
    {
      id: "book",
      label: "Bookings",
      meta: `${todayBookings} today`,
      icon: Calendar,
      badge: pendingCount > 0 ? `${pendingCount} pending` : null,
    },
    {
      id: "fleet",
      label: "Fleet",
      meta: `${vehicleCount} vehicles`,
      icon: Car,
      badge: null,
    },
    {
      id: "pulse",
      label: "Pulse",
      meta: "Live ops",
      icon: Activity,
      badge: null,
    },
    {
      id: "motoriq",
      label: "MotorIQ",
      meta: "Pricing",
      icon: TrendingUp,
      badge: null,
    },
  ];

  return (
    <section className="space-y-3" aria-label="Quick jump">
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Jump to
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {tiles.map((tile, i) => (
          <motion.button
            key={tile.id}
            type="button"
            onClick={() => onModuleClick(tile.id)}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.04 }}
            className={cn(
              "group relative text-left rounded-xl border border-border/60 bg-card/40 p-4",
              "transition-all hover:border-border hover:bg-card",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "min-h-[88px] flex flex-col justify-between",
            )}
          >
            <tile.icon
              className="absolute top-3 right-3 h-4 w-4 text-muted-foreground/40 group-hover:text-foreground/70 transition-colors"
              strokeWidth={1.75}
            />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-foreground">{tile.label}</span>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {tile.meta}
              </span>
            </div>
            <div className="flex items-center justify-between">
              {tile.badge ? (
                <span className="text-[10px] font-medium uppercase tracking-wider text-warning">
                  {tile.badge}
                </span>
              ) : (
                <span />
              )}
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
            </div>
          </motion.button>
        ))}
      </div>
    </section>
  );
};

export default QuickJumpTiles;
