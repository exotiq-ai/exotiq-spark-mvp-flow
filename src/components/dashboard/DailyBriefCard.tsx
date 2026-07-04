import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
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
import { HeroKpiRail } from "./widgets/HeroKpiRail";

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
    <section className="space-y-5" aria-label="Daily brief">
      <BriefHeader
        greeting={greeting}
        name={facts.greetingName}
        company={facts.companyName}
        dateLabel={facts.dateLabel}
        mode={mode}
        onModeChange={setMode}
        showWeekToggle={showWeekToggle}
      />

      {/* KPI rail — large tabular numerals, delta chips, hairline dividers */}
      <HeroKpiRail
        onRent={facts.onRent}
        pickupsToday={facts.pickupsToday}
        returnsToday={facts.returnsToday}
        collectedToday={facts.collectedToday}
        utilization={facts.utilization}
      />

      {/* Punch list first — the reason the user opened the app */}
      {facts.isClear ? (
        <AllClear />
      ) : (
        <TieredPunchList
          issues={rankedIssues}
          visibleIssues={visibleIssues}
          showAllIssues={showAllIssues}
          onToggleShowAll={() => setShowAllIssues((s) => !s)}
          onIssueClick={handleIssueClick}
        />
      )}

      {/* Rari's read — single-sentence lede, quiet under the punch list */}
      {narrative && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="max-w-[68ch]"
        >
          <NarrativeLede text={narrative} />
        </motion.div>
      )}

      {/* Week-in-review glance — tap to expand the full digest */}
      {showWeekToggle && (
        <WeeklyDigestCard
          bookings={fleet.bookings}
          vehicles={fleet.vehicles}
          variant="strip"
          onExpand={() => setMode("week")}
        />
      )}
    </section>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

/** Editorial lede: first sentence only — the rail already covers the counts. */
const NarrativeLede = ({ text }: { text: string }) => {
  const splitAt = text.search(/[.!?]\s/);
  const lede = splitAt === -1 ? text : text.slice(0, splitAt + 1);
  return (
    <p className="text-[14.5px] leading-[1.6] text-foreground">{lede}</p>
  );
};

const TieredPunchList = ({
  issues,
  visibleIssues,
  showAllIssues,
  onToggleShowAll,
  onIssueClick,
}: {
  issues: DailyBriefIssue[];
  visibleIssues: DailyBriefIssue[];
  showAllIssues: boolean;
  onToggleShowAll: () => void;
  onIssueClick: (issue: DailyBriefIssue) => void;
}) => {
  const critical = visibleIssues.filter((i) => i.severity === "high");
  const headsUp = visibleIssues.filter((i) => i.severity !== "high");

  return (
    <div className="space-y-2">
      {critical.length > 0 && (
        <ul className="space-y-0.5">
          {critical.map((issue, i) => (
            <IssueRow
              key={issue.id}
              issue={issue}
              tier="critical"
              index={i}
              onClick={() => onIssueClick(issue)}
            />
          ))}
        </ul>
      )}

      {headsUp.length > 0 && (
        <ul className="divide-y divide-border/40">
          {headsUp.map((issue, i) => (
            <IssueRow
              key={issue.id}
              issue={issue}
              tier="headsup"
              index={critical.length + i}
              onClick={() => onIssueClick(issue)}
            />
          ))}
        </ul>
      )}

      {issues.length > 5 && (
        <button
          type="button"
          onClick={onToggleShowAll}
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors pt-1"
        >
          {showAllIssues ? "Show top 5" : `View all ${issues.length} →`}
        </button>
      )}
    </div>
  );
};

const IssueRow = ({
  issue,
  tier,
  index,
  onClick,
}: {
  issue: DailyBriefIssue;
  tier: "critical" | "headsup";
  index: number;
  onClick: () => void;
}) => {
  const clickable = Boolean(issue.module);
  const isCritical = tier === "critical";

  return (
    <motion.li
      initial={{ opacity: 0, y: 2 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: 0.04 + index * 0.03 }}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={!clickable}
        className={cn(
          "group w-full text-left flex items-center gap-3",
          "transition-colors hover:bg-muted/40 disabled:hover:bg-transparent disabled:cursor-default",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm",
          isCritical
            ? "min-h-[44px] py-2 pl-3 pr-2 border-l-2 border-destructive"
            : "min-h-[36px] py-1.5 px-2",
        )}
      >
        <div className="flex-1 min-w-0 flex items-baseline gap-2 flex-wrap">
          <p
            className={cn(
              "leading-snug truncate text-foreground",
              isCritical ? "text-[14px] font-semibold" : "text-[13.5px] font-medium",
            )}
          >
            {issue.title}
          </p>
          {issue.detail && (
            <p className="text-[12px] text-muted-foreground truncate">
              · {issue.detail}
            </p>
          )}
        </div>
        {clickable && (
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 flex-shrink-0 transition-all duration-150",
              "text-muted-foreground/40 group-hover:text-foreground group-hover:translate-x-0.5",
            )}
          />
        )}
      </button>
    </motion.li>
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
  <header className="flex items-center justify-between gap-3 flex-wrap">
    <h1 className="text-[18px] sm:text-[19px] font-semibold tracking-tight text-foreground leading-tight min-w-0 truncate">
      {greeting}, {name}.
      <span className="ml-2 font-normal text-muted-foreground tracking-normal">
        {dateLabel}
        {company ? ` · ${company}` : ""}
      </span>
    </h1>
    {showWeekToggle && <ModeToggle mode={mode} onChange={onModeChange} />}
  </header>
);


const AllClear = () => (
  <p className="flex items-center gap-2 py-1 text-sm text-foreground">
    <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
    All clear — nothing needs you right now.
  </p>
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
