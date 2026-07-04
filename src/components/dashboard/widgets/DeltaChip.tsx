import { ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface DeltaChipProps {
  delta: number;
  /** Suffix appended to the number, e.g. "%" or "k". Default: none. */
  unit?: string;
  /** Optional formatter for the absolute value. */
  format?: (n: number) => string;
  /** Tooltip / aria label (default: "vs previous period"). */
  title?: string;
  className?: string;
}

/**
 * DeltaChip — single visual treatment for period-over-period deltas.
 * Used by HeroKpiRail, WeeklyDigestCard (strip + card), and anywhere else
 * a "±N vs prior" chip appears. Neutral (0) renders nothing.
 */
export const DeltaChip = ({
  delta,
  unit = "",
  format,
  title = "vs previous period",
  className,
}: DeltaChipProps) => {
  if (delta === 0 || !Number.isFinite(delta)) return null;
  const positive = delta > 0;
  const Icon = positive ? ArrowUp : ArrowDown;
  const abs = Math.abs(delta);
  const display = format
    ? format(abs)
    : abs >= 1000
      ? `${(abs / 1000).toFixed(1)}k`
      : String(abs);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[10.5px] font-medium tabular-nums px-1.5 py-0.5 rounded-full",
        positive
          ? "text-success bg-success/10"
          : "text-muted-foreground bg-muted/60",
        className,
      )}
      title={title}
    >
      <Icon className="h-2.5 w-2.5" strokeWidth={2.5} />
      {display}
      {unit}
    </span>
  );
};

export default DeltaChip;
