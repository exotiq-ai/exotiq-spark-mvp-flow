import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Brain,
  Sparkles,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  CalendarDays,
} from "lucide-react";
import { useDailyBrief, type DailyBriefIssue, type DailyBriefMetric } from "@/hooks/useDailyBrief";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { WeeklyDigestCard } from "./WeeklyDigestCard";
import { supabase } from "@/integrations/supabase/client";

interface DailyBriefCardProps {
  onModuleClick: (moduleId: string) => void;
}

type Mode = "today" | "week";

const greetingFor = (hour: number) => {
  if (hour < 5) return "Good evening";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

const formatAmount = (n: number) => {
  if (n >= 1000) return `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `$${Math.round(n).toLocaleString()}`;
};

const toneClasses: Record<NonNullable<DailyBriefMetric["tone"]>, string> = {
  default: "text-foreground",
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
};

const severityBadge: Record<DailyBriefIssue["severity"], { className: string; icon: typeof AlertCircle; label: string }> = {
  high: { className: "bg-destructive/15 text-destructive border-destructive/30", icon: AlertCircle, label: "High" },
  medium: { className: "bg-warning/15 text-warning border-warning/30", icon: AlertTriangle, label: "Medium" },
  low: { className: "bg-muted text-muted-foreground border-border", icon: Info, label: "Low" },
};

interface NarrativePayload {
  role: string | null;
  counts: {
    onRent: number;
    pickupsToday: number;
    returnsToday: number;
    overdueReturns: number;
    newBookings24h: number;
    pendingConfirmations: number;
    openTasks: number;
    overdueTasks: number;
    utilization: number;
  };
  issueTitles: string[]; // counts/categories only — NO customer names, NO vehicle names
}

export const DailyBriefCard = ({ onModuleClick }: DailyBriefCardProps) => {
  const facts = useDailyBrief();
  const fleet = useLocationFilteredFleet();
  const [mode, setMode] = useState<Mode>("today");
  const [showAllIssues, setShowAllIssues] = useState(false);
  const [narrative, setNarrative] = useState<string | null>(null);

  const greeting = useMemo(() => greetingFor(new Date().getHours()), []);
  const visibleIssues = showAllIssues ? facts.issues : facts.issues.slice(0, 5);

  // ----- AI narrative (DPA §3.8 safe: counts + non-PII titles only) -----
  useEffect(() => {
    if (facts.loading) return;
    if (!facts.role) return;

    const today = new Date().toISOString().slice(0, 10);
    const cacheKey = `daily-brief-narrative:${today}:${facts.role}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        setNarrative(cached);
        return;
      }
    } catch {
      /* ignore */
    }

    // Strip any potentially-PII fields. Only send counts + sanitized titles.
    const sanitizedTitles = facts.issues
      .slice(0, 8)
      .map((i) => i.title.replace(/\(([^)]+)\)/g, "").trim()); // strip "(customer name)" parens

    const payload: NarrativePayload = {
      role: facts.role,
      counts: {
        onRent: facts.onRent,
        pickupsToday: facts.pickupsToday,
        returnsToday: facts.returnsToday,
        overdueReturns: facts.overdueReturns,
        newBookings24h: facts.newBookings24h,
        pendingConfirmations: facts.pendingConfirmations,
        openTasks: facts.openTasks,
        overdueTasks: facts.overdueTasks,
        utilization: facts.utilization,
      },
      issueTitles: sanitizedTitles,
    };

    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("daily-brief-narrative", {
          body: payload,
        });
        if (cancelled) return;
        if (error || !data?.narrative) return;
        setNarrative(data.narrative);
        try {
          localStorage.setItem(cacheKey, data.narrative);
        } catch {
          /* ignore quota errors */
        }
      } catch {
        /* silent — deterministic facts already stand on their own */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facts.loading, facts.role]);

  // ----- Loading state -----
  if (facts.loading) {
    return (
      <Card className="card-premium p-5 bg-gradient-to-br from-primary/5 via-accent/5 to-transparent space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-64" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      </Card>
    );
  }

  // ----- This Week mode: defer to existing WeeklyDigestCard -----
  if (mode === "week") {
    return (
      <div className="space-y-3">
        <ModeToggle mode={mode} onChange={setMode} />
        <WeeklyDigestCard bookings={fleet.bookings} vehicles={fleet.vehicles} />
      </div>
    );
  }

  // ----- Today mode -----
  return (
    <div className="space-y-3">
      <ModeToggle mode={mode} onChange={setMode} />

      <Card className="card-premium p-5 bg-gradient-to-br from-primary/5 via-accent/5 to-transparent">
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2.5 bg-primary/10 rounded-xl">
            <Brain className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold flex items-center gap-2">
              {greeting}, {facts.greetingName}
              <Sparkles className="h-3.5 w-3.5 text-primary/70" />
            </h3>
            <p className="text-xs text-muted-foreground">
              {facts.companyName ? `${facts.companyName} • ` : ""}
              {facts.dateLabel}
            </p>
          </div>
        </div>

        {/* AI narrative placeholder slot — wired in Prompt D */}
        {narrative && (
          <p className="text-sm italic text-muted-foreground mb-4 leading-relaxed">
            {narrative}
          </p>
        )}

        {/* Punch-list metric chips */}
        {facts.metrics.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-5">
            {facts.metrics.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => m.module && onModuleClick(m.module)}
                disabled={!m.module}
                className={cn(
                  "text-left rounded-lg border border-border/60 bg-card/60 px-3 py-2 transition-all",
                  "hover:border-primary/40 hover:bg-card disabled:opacity-70 disabled:hover:border-border/60 disabled:cursor-default touch-target",
                )}
              >
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{m.label}</div>
                <div className={cn("font-semibold text-lg leading-tight", toneClasses[m.tone ?? "default"])}>
                  {m.key === "utilization" ? `${m.count}%` : m.count.toLocaleString()}
                </div>
                {typeof m.amount === "number" && m.amount > 0 && (
                  <div className="text-[11px] text-success font-medium">{formatAmount(m.amount)}</div>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Needs you / All clear */}
        {facts.isClear ? (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-success/5 border border-success/20">
            <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
            <div>
              <p className="text-sm font-medium">All clear</p>
              <p className="text-xs text-muted-foreground">Nothing needs your attention right now.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-warning" />
                Needs you
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {facts.issues.length}
                </Badge>
              </h4>
              {facts.issues.length > 5 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setShowAllIssues((s) => !s)}
                >
                  {showAllIssues ? "Show top 5" : `View all (${facts.issues.length})`}
                </Button>
              )}
            </div>

            <div className="space-y-1.5">
              {visibleIssues.map((issue) => {
                const sev = severityBadge[issue.severity];
                const SevIcon = sev.icon;
                const clickable = Boolean(issue.module);
                return (
                  <button
                    key={issue.id}
                    type="button"
                    onClick={() => issue.module && onModuleClick(issue.module)}
                    disabled={!clickable}
                    className={cn(
                      "w-full flex items-start gap-3 rounded-lg border border-border/60 bg-card/40 px-3 py-2.5 text-left transition-all",
                      "hover:bg-card hover:border-primary/40 disabled:hover:border-border/60 disabled:cursor-default touch-target group",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 inline-flex items-center justify-center h-6 w-6 rounded-md border",
                        sev.className,
                      )}
                      aria-label={sev.label}
                    >
                      <SevIcon className="h-3.5 w-3.5" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-snug">{issue.title}</p>
                      {issue.detail && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{issue.detail}</p>
                      )}
                    </div>
                    {clickable && (
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-0.5" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

const ModeToggle = ({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) => (
  <div
    role="tablist"
    aria-label="Brief timeframe"
    className="inline-flex items-center p-1 rounded-lg border border-border/60 bg-muted/40 text-xs"
  >
    {(["today", "week"] as Mode[]).map((m) => (
      <button
        key={m}
        role="tab"
        aria-selected={mode === m}
        onClick={() => onChange(m)}
        className={cn(
          "px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5",
          mode === m
            ? "bg-background text-foreground shadow-sm border border-border/50"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        {m === "today" ? <Sparkles className="h-3 w-3" /> : <CalendarDays className="h-3 w-3" />}
        {m === "today" ? "Today" : "This Week"}
      </button>
    ))}
  </div>
);

export default DailyBriefCard;
