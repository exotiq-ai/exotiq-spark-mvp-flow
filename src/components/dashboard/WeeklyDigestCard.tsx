import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  ChevronRight,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { cn, formatCurrencyCompact } from "@/lib/utils";
import { DeltaChip } from "./widgets/DeltaChip";

interface DigestData {
  id: string;
  week_start: string;
  summary_json: {
    weekInReview: {
      revenue: number;
      revenueChange: number;
      bookingsCompleted: number;
      newBookings: number;
      topVehicle: { name: string; revenue: number };
      utilizationChange: { from: number; to: number };
    };
    nextWeekOutlook: {
      events: Array<{ name: string; date: string; impact: string }>;
      demandSurge: number;
      vehiclesRecommended: number;
    };
    topAction: string;
    generatedAt: string;
    data_sources?: string[];
    coverage?: {
      week_start?: string;
      week_end?: string;
      vehicles_counted?: number;
      bookings_counted?: number;
      city_resolved?: string | null;
    };
  };
  created_at: string;
}

interface WeeklyDigestCardProps {
  bookings: any[];
  vehicles: any[];
  /** "card" = full digest card (week view); "strip" = single-row glance (today view) */
  variant?: "card" | "strip";
  onExpand?: () => void;
}

export const WeeklyDigestCard = ({
  bookings,
  vehicles,
  variant = "card",
  onExpand,
}: WeeklyDigestCardProps) => {
  const { user } = useAuth();
  const [digest, setDigest] = useState<DigestData | null>(null);
  const [showFullDigest, setShowFullDigest] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const loadDigest = async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from("weekly_digests")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          setDigest(data as unknown as DigestData);
        }
      } catch (err) {
        console.error("Failed to load digest:", err);
      }
    };
    loadDigest();
  }, [user]);

  const handleGenerateDigest = async () => {
    if (!user) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "weekly-intelligence-digest",
        { body: { userId: user.id } },
      );
      if (error) throw error;
      if (data?.digest) {
        setDigest(data.digest as DigestData);
        toast.success("Weekly digest generated");
      }
    } catch (err) {
      console.error("Failed to generate digest:", err);
      toast.error("Failed to generate weekly digest");
    } finally {
      setGenerating(false);
    }
  };

  const summary = digest?.summary_json;
  const isNew =
    digest &&
    Date.now() - new Date(digest.created_at).getTime() < 24 * 60 * 60 * 1000;

  // ── STRIP VARIANT ────────────────────────────────────────────────────────
  // One-line week glance for the Today view footer.
  if (variant === "strip") {
    if (!digest || !summary) {
      return (
        <button
          type="button"
          onClick={handleGenerateDigest}
          disabled={generating}
          className="w-full flex items-center justify-between gap-3 py-2.5 border-t border-border/50 text-[12.5px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <span className="flex items-center gap-2">
            {generating ? (
              <RefreshCw className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            {generating ? "Summarizing this week…" : "Summarize this week"}
          </span>
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      );
    }
    const wir = summary.weekInReview;
    const handleClick = () => (onExpand ? onExpand() : setShowFullDigest(true));
    return (
      <>
        <button
          type="button"
          onClick={handleClick}
          className="w-full flex items-center justify-between gap-3 py-2.5 border-t border-border/50 text-[12.5px] hover:bg-muted/30 transition-colors group"
        >
          <span className="flex items-center gap-3 min-w-0 text-muted-foreground">
            <span className="uppercase tracking-[0.14em] text-[10.5px] font-medium text-foreground/70">
              Week
            </span>
            <span className="tabular-nums text-foreground font-medium">
              {formatCurrencyCompact(wir.revenue)}
            </span>
            <span aria-hidden>·</span>
            <span className="tabular-nums">
              {wir.bookingsCompleted} bookings
            </span>
            <span aria-hidden>·</span>
            <span className="tabular-nums">
              {wir.utilizationChange.to}% util
            </span>
            {wir.revenueChange !== 0 && (
              <DeltaChip delta={wir.revenueChange} unit="%" title="vs last week" />
            )}
          </span>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
        </button>
        {!onExpand && (
          <FullDigestDialog
            open={showFullDigest}
            onOpenChange={setShowFullDigest}
            digest={digest}
            generating={generating}
            onRegenerate={handleGenerateDigest}
          />
        )}
      </>
    );
  }

  // ── CARD VARIANT (Week mode) ─────────────────────────────────────────────
  if (!digest) {
    return (
      <Card className="p-4 border-border/60">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h4 className="text-sm font-semibold">FleetCopilot™ Weekly Digest</h4>
            <p className="text-xs text-muted-foreground">
              AI-powered fleet intelligence report
            </p>
          </div>
          <Button
            onClick={handleGenerateDigest}
            disabled={generating}
            size="sm"
            variant="outline"
            className="gap-2"
          >
            {generating ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Generate
          </Button>
        </div>
      </Card>
    );
  }

  const wir = summary!.weekInReview;
  const weekEnd = digest.summary_json.coverage?.week_end;
  const headerLine = `Week of ${format(new Date(digest.week_start), "MMM d")}${
    weekEnd ? ` – ${format(new Date(weekEnd), "MMM d")}` : ""
  }`;
  const generatedAgo = formatDistanceToNow(new Date(digest.created_at), {
    addSuffix: true,
  });

  return (
    <>
      <Card
        className="p-4 border-border/60 cursor-pointer hover:border-primary/40 transition-colors group"
        onClick={() => setShowFullDigest(true)}
      >
        {/* Slim header row */}
        <div className="flex items-center justify-between gap-3 text-[12px] text-muted-foreground">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-medium text-foreground/80 truncate">
              {headerLine}
            </span>
            <span aria-hidden>·</span>
            <span className="truncate">Generated {generatedAgo}</span>
            {isNew && (
              <Badge className="bg-success/15 text-success text-[10px] px-1.5 py-0 border-0 h-4">
                New
              </Badge>
            )}
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleGenerateDigest();
            }}
            disabled={generating}
            className="text-[11px] hover:text-foreground transition-colors flex items-center gap-1"
          >
            <RefreshCw
              className={cn("h-3 w-3", generating && "animate-spin")}
            />
            Regenerate
          </button>
        </div>

        {/* KPI strip — 4-up tabular numerals, hairline dividers, no icons */}
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-y-3 sm:divide-x divide-border/50">
          <KpiCell
            label="Revenue"
            value={formatCurrencyCompact(wir.revenue)}
            deltaPct={wir.revenueChange}
          />
          <KpiCell
            label="Bookings"
            value={wir.bookingsCompleted.toLocaleString()}
            sub={`+${wir.newBookings} new`}
          />
          <KpiCell
            label="Top vehicle"
            value={wir.topVehicle.name}
            sub={formatCurrencyCompact(wir.topVehicle.revenue)}
            compact
          />
          <KpiCell
            label="Utilization"
            value={`${wir.utilizationChange.to}%`}
            sub={`from ${wir.utilizationChange.from}%`}
          />
        </div>

        {/* Top action — pull-quote, no panel */}
        {summary?.topAction && (
          <p className="mt-4 text-[14px] leading-snug italic text-foreground/90 max-w-[68ch]">
            {summary.topAction}
          </p>
        )}

        {/* Sources hairline — hide null-city technical noise */}
        <p className="mt-3 pt-2 border-t border-border/40 text-[10.5px] text-muted-foreground/80 tabular-nums">
          {(summary?.data_sources && summary.data_sources.length > 0
            ? summary.data_sources.join(" · ")
            : "bookings · vehicles")}
          {summary?.coverage?.city_resolved
            ? ` · ${summary.coverage.city_resolved}`
            : ""}
          {" · revenue overlap-weighted"}
        </p>
      </Card>

      <FullDigestDialog
        open={showFullDigest}
        onOpenChange={setShowFullDigest}
        digest={digest}
        generating={generating}
        onRegenerate={handleGenerateDigest}
      />
    </>
  );
};

// ─── KPI cell ───────────────────────────────────────────────────────────────

const KpiCell = ({
  label,
  value,
  sub,
  deltaPct,
  compact,
}: {
  label: string;
  value: string;
  sub?: string;
  deltaPct?: number;
  compact?: boolean;
}) => (
  <div className="px-0 sm:px-4 first:sm:pl-0 last:sm:pr-0 min-w-0">
    <div className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground font-medium">
      {label}
    </div>
    <div
      className={cn(
        "mt-1 font-semibold text-foreground tabular-nums tracking-tight truncate",
        compact ? "text-[15px]" : "text-[2rem] leading-none",
      )}
    >
      {value}
    </div>
    {(sub || deltaPct !== undefined) && (
      <div className="mt-1 flex items-center gap-1.5 text-[11px] tabular-nums">
        {deltaPct !== undefined && deltaPct !== 0 && (
          <DeltaChip delta={deltaPct} unit="%" />
        )}
        {sub && <span className="text-muted-foreground truncate">{sub}</span>}
      </div>
    )}
  </div>
);

// ─── Full digest dialog ─────────────────────────────────────────────────────

const FullDigestDialog = ({
  open,
  onOpenChange,
  digest,
  generating,
  onRegenerate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  digest: DigestData;
  generating: boolean;
  onRegenerate: () => void;
}) => {
  const summary = digest.summary_json;
  if (!summary) return null;
  const wir = summary.weekInReview;
  const weekEnd = summary.coverage?.week_end;
  const headerLine = `Week of ${format(new Date(digest.week_start), "MMM d")}${
    weekEnd ? ` – ${format(new Date(weekEnd), "MMM d")}` : ""
  }`;

  const impactLetter = (impact: string) =>
    impact === "high" ? "H" : impact === "medium" ? "M" : "L";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[82vh]">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            {headerLine}
          </DialogTitle>
          <p className="text-[11.5px] text-muted-foreground">
            Generated{" "}
            {format(new Date(digest.created_at), "MMM d, h:mm a")} ·{" "}
            {(summary.data_sources && summary.data_sources.length > 0
              ? summary.data_sources.join(" · ")
              : "bookings · vehicles")}
            {summary.coverage?.city_resolved
              ? ` · ${summary.coverage.city_resolved}`
              : ""}
          </p>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-5 py-1">
            {/* KPI strip — same density as the card */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-3 sm:divide-x divide-border/50">
              <KpiCell
                label="Revenue"
                value={formatCurrencyCompact(wir.revenue)}
                deltaPct={wir.revenueChange}
                sub="vs last week"
              />
              <KpiCell
                label="Bookings"
                value={wir.bookingsCompleted.toLocaleString()}
                sub={`+${wir.newBookings} new`}
              />
              <KpiCell
                label="Top vehicle"
                value={wir.topVehicle.name}
                sub={formatCurrencyCompact(wir.topVehicle.revenue)}
                compact
              />
              <KpiCell
                label="Utilization"
                value={`${wir.utilizationChange.to}%`}
                sub={`from ${wir.utilizationChange.from}%`}
              />
            </div>

            {/* Top action — pull-quote */}
            {summary.topAction && (
              <p className="text-[14.5px] leading-snug italic text-foreground/90 max-w-[68ch]">
                {summary.topAction}
              </p>
            )}

            <Separator />

            {/* Outlook */}
            <div>
              <h4 className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground font-medium mb-2">
                Next week
              </h4>
              {summary.nextWeekOutlook.events.length > 0 ? (
                <ul className="divide-y divide-border/40">
                  {summary.nextWeekOutlook.events.map((event, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-3 py-1.5 min-h-[28px] text-[13px]"
                    >
                      <span className="tabular-nums text-muted-foreground w-20 flex-shrink-0">
                        {event.date}
                      </span>
                      <span className="flex-1 truncate text-foreground">
                        {event.name}
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-semibold",
                          event.impact === "high"
                            ? "bg-warning/20 text-warning"
                            : event.impact === "medium"
                              ? "bg-muted text-foreground"
                              : "bg-muted/60 text-muted-foreground",
                        )}
                        title={`${event.impact} impact`}
                      >
                        {impactLetter(event.impact)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[12.5px] text-muted-foreground">
                  No major events detected for next week.
                </p>
              )}
              {(summary.nextWeekOutlook.demandSurge > 0 ||
                summary.nextWeekOutlook.vehiclesRecommended > 0) && (
                <div className="mt-2 flex items-center gap-4 text-[12px] text-muted-foreground tabular-nums">
                  {summary.nextWeekOutlook.demandSurge > 0 && (
                    <span className="text-success">
                      +{summary.nextWeekOutlook.demandSurge}% demand
                    </span>
                  )}
                  {summary.nextWeekOutlook.vehiclesRecommended > 0 && (
                    <span>
                      {summary.nextWeekOutlook.vehiclesRecommended} vehicles to
                      reprice
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="flex items-center justify-end pt-1">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs gap-1.5 h-7"
                onClick={onRegenerate}
                disabled={generating}
              >
                <RefreshCw
                  className={cn("h-3 w-3", generating && "animate-spin")}
                />
                Regenerate
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
