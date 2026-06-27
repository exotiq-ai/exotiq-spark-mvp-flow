import { useEffect, useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  ChevronRight,
  CheckCircle2,
  CalendarDays,
  Sun,
} from "lucide-react";
import {
  useDailyBrief,
  type DailyBriefIssue,
  type IssueSeverity,
} from "@/hooks/useDailyBrief";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { WeeklyDigestCard } from "./WeeklyDigestCard";
import { supabase } from "@/integrations/supabase/client";
import { useModuleNavigation } from "@/hooks/useModuleNavigation";
import { useNavigate } from "react-router-dom";
import { moduleIdToPath } from "@/lib/moduleRoutes";

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

const formatMoney = (n: number) => {
  if (n >= 1000) return `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `$${Math.round(n).toLocaleString()}`;
};

const dotClass: Record<IssueSeverity, string> = {
  high: "bg-destructive",
  medium: "bg-warning",
  low: "bg-muted-foreground/50",
};

// Role-aware re-rank: nudge the most relevant categories to the top
// without changing the underlying severity contract.
const roleBoost = (role: string | null) => (issue: DailyBriefIssue): number => {
  const base = issue.severity === "high" ? 30 : issue.severity === "medium" ? 20 : 10;
  if (role === "owner" || role === "admin") {
    if (issue.category === "payment" || issue.category === "pricing") return base + 5;
  } else if (role === "manager") {
    if (issue.category === "booking" || issue.category === "task") return base + 5;
  } else if (role === "operator") {
    if (issue.category === "task" || issue.category === "maintenance") return base + 5;
  }
  return base;
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
  const nav = useModuleNavigation();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("today");
  const [showAllIssues, setShowAllIssues] = useState(false);
  const [narrative, setNarrative] = useState<string | null>(null);

  const greeting = useMemo(() => greetingFor(new Date().getHours()), []);

  const handleIssueClick = (issue: DailyBriefIssue) => {
    const meta = issue.meta ?? {};
    const bookingId = meta.bookingId ? String(meta.bookingId) : undefined;
    const taskId = meta.taskId ? String(meta.taskId) : undefined;
    const damageClaimId = meta.damageClaimId ? String(meta.damageClaimId) : undefined;
    const vehicleId = meta.vehicleId ? String(meta.vehicleId) : undefined;

    switch (issue.id) {
      case "overdue-returns":
      case "pending-confirmations":
        if (bookingId) return nav.goToBookingDetails(bookingId);
        break;
      case "outstanding-balance":
        return nav.goToPayments(bookingId);
      case "overdue-tasks":
      case "urgent-tasks":
        if (taskId) return nav.goToTask(taskId);
        break;
      case "open-damage":
        if (damageClaimId) return nav.goToDamageReport(damageClaimId);
        break;
      case "maintenance":
        return nav.goToMaintenance();
      case "pricing-opportunity":
        if (vehicleId) {
          return navigate(moduleIdToPath("motoriq", { vehicleId }));
        }
        break;
    }
    if (issue.module) onModuleClick(issue.module);
  };


  // Operator role hides the "This Week" toggle — they live in the now.
  const showWeekToggle = facts.role !== "operator";

  // Role-aware re-rank on top of severity sort
  const rankedIssues = useMemo(() => {
    const boost = roleBoost(facts.role);
    return [...facts.issues].sort((a, b) => boost(b) - boost(a));
  }, [facts.issues, facts.role]);

  const visibleIssues = showAllIssues ? rankedIssues : rankedIssues.slice(0, 5);

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

    const sanitizedTitles = facts.issues
      .slice(0, 8)
      .map((i) => i.title.replace(/\(([^)]+)\)/g, "").trim());

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
          /* ignore */
        }
      } catch {
        /* silent */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facts.loading, facts.role]);

  // ----- Loading -----
  if (facts.loading) {
    return (
      <section className="space-y-6">
        <div className="space-y-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      </section>
    );
  }

  // ----- This Week -----
  if (mode === "week") {
    return (
      <section className="space-y-5">
        <BriefHeader
          greeting={greeting}
          name={facts.greetingName}
          company={facts.companyName}
          dateLabel={facts.dateLabel}
          mode={mode}
          onModeChange={setMode}
          showWeekToggle={showWeekToggle}
        />
        <WeeklyDigestCard bookings={fleet.bookings} vehicles={fleet.vehicles} />
      </section>
    );
  }

  // ----- Today -----
  return (
    <section className="space-y-6 sm:space-y-7" aria-label="Daily brief">
      <BriefHeader
        greeting={greeting}
        name={facts.greetingName}
        company={facts.companyName}
        dateLabel={facts.dateLabel}
        mode={mode}
        onModeChange={setMode}
        showWeekToggle={showWeekToggle}
      />

      {/* Status line — inline typography, no boxes */}
      <StatusLine
        onRent={facts.onRent}
        pickupsToday={facts.pickupsToday}
        returnsToday={facts.returnsToday}
        revenueToday={facts.revenueToday}
        utilization={facts.utilization}
      />

      {/* Rari's read — italic, muted, the "why" */}
      {narrative && (
        <p className="text-[15px] leading-relaxed italic text-muted-foreground max-w-2xl">
          {narrative}
        </p>
      )}

      {/* Punch list — the work */}
      {facts.isClear ? (
        <AllClear />
      ) : (
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Needs you
              <span className="ml-2 text-foreground/80 tracking-normal normal-case font-medium">
                {rankedIssues.length}
              </span>
            </h2>
            {rankedIssues.length > 5 && (
              <button
                type="button"
                onClick={() => setShowAllIssues((s) => !s)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {showAllIssues ? "Show top 5" : `View all (${rankedIssues.length})`}
              </button>
            )}
          </div>

          <ul className="divide-y divide-border/60 border-y border-border/60">
            {visibleIssues.map((issue) => {
              const clickable = Boolean(issue.module);
              return (
                <li key={issue.id}>
                  <button
                    type="button"
              const clickable = Boolean(issue.module);
              return (
                <li key={issue.id}>
                  <button
                    type="button"
                    onClick={() => handleIssueClick(issue)}
                    disabled={!clickable}
                    className={cn(
                      "group w-full flex items-center gap-4 py-3.5 sm:py-3 text-left",
                      "min-h-[56px] sm:min-h-[52px]",
                      "transition-colors hover:bg-muted/30 disabled:hover:bg-transparent disabled:cursor-default",
                      "-mx-2 px-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "flex-shrink-0 h-2 w-2 rounded-full",
                        dotClass[issue.severity],
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-medium text-foreground leading-snug truncate">
                        {issue.title}
                      </p>
                      {issue.detail && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {issue.detail}
                        </p>
                      )}
                    </div>
                    {clickable && (
                      <ChevronRight className="h-4 w-4 text-muted-foreground/60 group-hover:text-foreground group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

const BriefHeader = ({
  greeting,
  name,
  company,
  dateLabel,
  mode,
  onModeChange,
  showWeekToggle,
}: {
  greeting: string;
  name: string;
  company?: string;
  dateLabel: string;
  mode: Mode;
  onModeChange: (m: Mode) => void;
  showWeekToggle: boolean;
}) => (
  <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
    <div className="min-w-0">
      <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
        {greeting}, {name}.
      </h1>
      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
        {company ? `${company} · ` : ""}
        {dateLabel}
      </p>
    </div>
    {showWeekToggle && <ModeToggle mode={mode} onChange={onModeChange} />}
  </header>
);

const StatusLine = ({
  onRent,
  pickupsToday,
  returnsToday,
  revenueToday,
  utilization,
}: {
  onRent: number;
  pickupsToday: number;
  returnsToday: number;
  revenueToday: number;
  utilization: number;
}) => {
  const facts = [
    { label: "out", value: onRent.toLocaleString() },
    { label: "pickups", value: pickupsToday.toLocaleString() },
    { label: "returns", value: returnsToday.toLocaleString() },
    revenueToday > 0
      ? { label: "collected", value: formatMoney(revenueToday) }
      : { label: "utilization", value: `${utilization}%` },
  ];
  return (
    <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2 text-foreground">
      {facts.map((f, i) => (
        <span key={f.label} className="flex items-baseline gap-1.5">
          {i > 0 && (
            <span className="text-muted-foreground/40 mr-3 hidden sm:inline" aria-hidden>
              ·
            </span>
          )}
          <span className="text-xl sm:text-2xl font-semibold tracking-tight tabular-nums">
            {f.value}
          </span>
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            {f.label}
          </span>
        </span>
      ))}
    </div>
  );
};

const AllClear = () => (
  <div className="flex items-center gap-3 py-4">
    <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
    <div>
      <p className="text-sm font-medium text-foreground">All clear.</p>
      <p className="text-xs text-muted-foreground">Nothing needs your attention right now.</p>
    </div>
  </div>
);

const ModeToggle = ({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) => (
  <div
    role="tablist"
    aria-label="Brief timeframe"
    className="inline-flex items-center p-0.5 rounded-full border border-border bg-muted/40 text-xs self-start sm:self-auto"
  >
    {(
      [
        { id: "today" as Mode, label: "Today", icon: Sun },
        { id: "week" as Mode, label: "This Week", icon: CalendarDays },
      ]
    ).map(({ id, label, icon: Icon }) => (
      <button
        key={id}
        role="tab"
        aria-selected={mode === id}
        onClick={() => onChange(id)}
        className={cn(
          "px-3 py-1.5 rounded-full font-medium transition-colors flex items-center gap-1.5 min-h-[32px]",
          mode === id
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Icon className="h-3 w-3" />
        {label}
      </button>
    ))}
  </div>
);

export default DailyBriefCard;
