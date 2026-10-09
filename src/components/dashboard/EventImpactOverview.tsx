import { useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Briefcase, CalendarCheck, ChevronDown, CircleDot, CircleHelp, ExternalLink, Gauge, Info, MapPin, PartyPopper, ShieldCheck,
  Sparkles, Star, Trophy, Users, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  AUDIENCE_GROUPS,
  AUDIENCE_LABELS,
  EVIDENCE_HELP,
  EVIDENCE_LABELS,
  SEGMENT_KEYS,
  SEGMENT_LABELS,
  SEGMENT_STYLE,
  buildHeadline,
  compactNumber,
  datesCheckNote,
  dayAttendance,
  dayUplifts,
  eventTier,
  eventsOnDay,
  evidenceOf,
  explainImpact,
  groupOf,
  maxUplift,
  pct,
  pctRange,
  windowPeaks,
  type Evidence,
  type ImpactEvent,
  type SegmentKey,
  type SegmentMap,
} from "@/lib/eventImpact";
import type { EventHistory } from "@/hooks/useEventHistory";
import type { LiftResult } from "@/lib/eventLift";

interface DayInfo {
  /** yyyy-MM-dd */
  date: string;
  /** typical demand 0-100 from the owner's own booking weekdays (kept as a tooltip detail) */
  demand: number;
}

interface BookingFacts {
  yoyChange: number | null;
  momChange: number | null;
  avgBookingDuration: string;
}

interface Props {
  events: ImpactEvent[];
  segmentMultipliers: SegmentMap | null;
  days: DayInfo[];
  loading: boolean;
  facts: BookingFacts;
  history?: EventHistory;
}

/** A calendar day, not UTC midnight. */
const dayDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
const fmtDay = (iso: string, f = "EEE, MMM d") => format(dayDate(iso), f);
const fmtRange = (e: { date: string; endDate?: string }) =>
  !e.endDate || e.endDate === e.date ? fmtDay(e.date) : `${fmtDay(e.date, "MMM d")} – ${fmtDay(e.endDate, "MMM d")}`;
const signed = (n: number) => `${n >= 0 ? "+" : ""}${n}%`;

const GROUP_ICONS: Record<string, typeof Users> = {
  business: Briefcase,
  groups: PartyPopper,
  families: Users,
  auto: Gauge,
  gameday: Trophy,
  peak: Star,
};

const EVIDENCE_ICON: Record<Evidence, typeof ShieldCheck> = {
  curated: CalendarCheck,
  verified: ShieldCheck,
  listed: CircleDot,
  unconfirmed: CircleHelp,
};
const EVIDENCE_TONE: Record<Evidence, string> = {
  curated: "text-primary",
  verified: "text-success",
  listed: "text-muted-foreground",
  unconfirmed: "text-warning",
};

/** Effect of one event on a class: what pricing uses, or the potential for unconfirmed events. */
const effectFor = (e: ImpactEvent, k: SegmentKey) => {
  const ev = evidenceOf(e);
  const src = ev === "unconfirmed" ? e.potentialImpact ?? e.segmentImpact : e.segmentImpact;
  return pct(src?.[k]);
};
const strongest = (e: ImpactEvent): { key: SegmentKey; pct: number } | null => {
  let best: SegmentKey | null = null;
  let top = 0;
  for (const k of SEGMENT_KEYS) { const p = effectFor(e, k); if (p > top) { top = p; best = k; } }
  return best ? { key: best, pct: top } : null;
};

// ---------------------------------------------------------------------------
// Small parts
// ---------------------------------------------------------------------------

const EvidenceBadge = ({ evidence, compact = false, note }: { evidence: Evidence; compact?: boolean; note?: string | null }) => {
  const Icon = EVIDENCE_ICON[evidence];
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
              evidence === "verified" && "border-success/30 bg-success/10",
              evidence === "curated" && "border-primary/30 bg-primary/10",
              evidence === "listed" && "bg-muted/40",
              evidence === "unconfirmed" && "border-dashed border-warning/40 bg-warning/5",
              EVIDENCE_TONE[evidence],
            )}
          >
            <Icon className="h-3 w-3" />
            {!compact && EVIDENCE_LABELS[evidence]}
            {compact && <span className="sr-only">{EVIDENCE_LABELS[evidence]}</span>}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-[240px]">
          <p className="text-xs font-medium">{EVIDENCE_LABELS[evidence]}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{EVIDENCE_HELP[evidence]}</p>
          {note && <p className="mt-1 text-xs">{note}</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const ATTENDANCE_NOTE = "Estimated from the venue, organizer or news pages. Not a ticket count.";

/** "76K expected", or "up to 19.6K" when the number is the venue's capacity. */
const Attendance = ({ e, className }: { e: ImpactEvent; className?: string }) => {
  const n = e.attendance;
  if (!n || n <= 0) return null;
  const cap = e.attendanceBasis === "capacity";
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn("inline-flex items-center gap-1 tabular-nums", className)}>
            <Users className="h-3 w-3 shrink-0" />
            {cap ? `up to ${compactNumber(n)}` : `${compactNumber(n)} expected`}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-[240px]">
          <p className="text-xs">
            {n.toLocaleString()} {cap ? "(venue capacity, approximate; actual turnout may be lower)" : `attendees (estimate). ${ATTENDANCE_NOTE}`}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

/** Four meters: how much the window's events lift each vehicle class, as 5-point ranges. */
const SegmentMeters = ({ segments }: { segments: SegmentMap | null }) => {
  const scale = 35; // a +35% lift fills the bar (it is also the ceiling)
  return (
    <div className="grid gap-x-6 gap-y-3 [grid-template-columns:repeat(auto-fit,minmax(118px,1fr))]">
      {SEGMENT_KEYS.map((k) => {
        const p = pct(segments?.[k]);
        const style = SEGMENT_STYLE[k];
        return (
          <div key={k} className="min-w-0">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-xs text-muted-foreground">{SEGMENT_LABELS[k]}</span>
              <span className={cn("text-lg font-semibold tabular-nums", p > 0 ? style.text : "text-muted-foreground")}>
                {p > 0 ? `+${pctRange(p)}` : "0%"}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted/50">
              <div className={cn("h-full rounded-full transition-all duration-700", style.bar)} style={{ width: `${Math.min(100, (Math.max(p, 0) / scale) * 100)}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

const SegmentPills = ({ e }: { e: ImpactEvent }) => {
  const top = strongest(e);
  const unconfirmed = evidenceOf(e) === "unconfirmed";
  return (
    <div className="flex flex-wrap gap-1">
      {SEGMENT_KEYS.map((k) => {
        const p = effectFor(e, k);
        if (p <= 0) return null;
        const isTop = top?.key === k;
        return (
          <span
            key={k}
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums",
              unconfirmed ? "border border-dashed bg-transparent text-muted-foreground" : isTop ? cn(SEGMENT_STYLE[k].soft, SEGMENT_STYLE[k].text) : "bg-muted/40 text-muted-foreground",
            )}
          >
            {SEGMENT_LABELS[k]} {unconfirmed ? "if confirmed " : ""}+{pctRange(p)}
          </span>
        );
      })}
    </div>
  );
};

const SourceLink = ({ e }: { e: ImpactEvent }) => {
  const url = e.sourceUrls?.[0];
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-8 items-center gap-0.5 px-1 text-[11px] text-muted-foreground hover:text-foreground"
      aria-label={`Source page for ${e.name}`}
    >
      source <ExternalLink className="h-3 w-3" />
    </a>
  );
};

const MajorCard = ({ e }: { e: ImpactEvent }) => {
  const top = strongest(e);
  const ev = evidenceOf(e);
  return (
    <div className={cn("rounded-xl border p-3.5", ev === "unconfirmed" ? "border-dashed bg-muted/10" : "bg-gradient-to-br from-primary/5 via-transparent to-transparent")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="break-words font-semibold leading-tight">{e.name}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <span>{fmtRange(e)}</span>
            {e.venue && (
              <span className="inline-flex min-w-0 items-center gap-0.5">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{e.venue}</span>
              </span>
            )}
            {e.audience && <span>{AUDIENCE_LABELS[e.audience] ?? e.audience}</span>}
          </div>
          <Attendance e={e} className="mt-1.5 text-sm font-semibold text-foreground" />
        </div>
        {top && (
          <div className="shrink-0 text-right">
            <div className={cn("text-xl font-bold leading-none tabular-nums", ev === "unconfirmed" ? "text-muted-foreground" : SEGMENT_STYLE[top.key].text)}>
              +{pctRange(top.pct)}
            </div>
            <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{SEGMENT_LABELS[top.key]}{ev === "unconfirmed" ? " if confirmed" : ""}</div>
          </div>
        )}
      </div>
      {top && (
        <details className="mt-2 text-xs text-muted-foreground">
          <summary className="min-h-8 cursor-pointer select-none py-1.5 hover:text-foreground">How is this calculated?</summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {explainImpact(e, top.key).map((line, i) => <li key={i}>{line}</li>)}
          </ul>
        </details>
      )}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <SegmentPills e={e} />
        <div className="flex items-center gap-1.5">
          <EvidenceBadge evidence={ev} note={datesCheckNote(e)} />
          <SourceLink e={e} />
        </div>
      </div>
    </div>
  );
};

const NotableRow = ({ e }: { e: ImpactEvent }) => {
  const top = strongest(e);
  const ev = evidenceOf(e);
  return (
    <div className="flex flex-col gap-1.5 rounded-lg px-2.5 py-2 hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <div className="min-w-0">
        <div className="line-clamp-2 break-words text-sm font-medium sm:truncate">{e.name}</div>
        <div className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
          <span className="sm:truncate">{fmtRange(e)}{e.venue ? ` · ${e.venue}` : ""}</span>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
        <Attendance e={e} className="text-xs text-muted-foreground" />
        <EvidenceBadge evidence={ev} compact note={datesCheckNote(e)} />
        {top && (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
              ev === "unconfirmed" ? "border border-dashed text-muted-foreground" : cn(SEGMENT_STYLE[top.key].soft, SEGMENT_STYLE[top.key].text),
            )}
          >
            {SEGMENT_LABELS[top.key]} +{pctRange(top.pct)}
          </span>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Your results: what happened last time, measured on the tenant's own bookings
// ---------------------------------------------------------------------------

const VERDICT_LABEL: Record<LiftResult["verdict"], { text: string; cls: string }> = {
  "clear-lift": { text: "Clear lift", cls: "bg-success/15 text-success" },
  "no-clear-lift": { text: "No clear lift", cls: "bg-muted/50 text-muted-foreground" },
  lower: { text: "Lower than usual", cls: "bg-destructive/10 text-destructive" },
  "not-enough-data": { text: "Not enough bookings yet", cls: "border border-dashed text-muted-foreground" },
};

const est = (e: { pct: number; lo: number; hi: number } | null) =>
  e ? `${signed(Math.round(e.pct))} (${Math.round(e.lo)} to ${Math.round(e.hi)})` : "n/a";

const YourResults = ({ history }: { history?: EventHistory }) => {
  const [open, setOpen] = useState(false);
  if (!history || history.status === "idle") return null;

  const measurable = history.results.filter((r) => r.verdict !== "not-enough-data");
  const ordered = [...history.results].sort((a, b) => Number(a.verdict === "not-enough-data") - Number(b.verdict === "not-enough-data") || b.end.localeCompare(a.end));
  const shown = open ? ordered : ordered.slice(0, 3);

  let body: JSX.Element;
  if (history.status === "loading") {
    body = <div className="h-12 animate-pulse rounded-lg bg-muted/20" />;
  } else if (history.status === "no-fleet") {
    body = <p className="text-sm text-muted-foreground">Add cars located in this market and their bookings will be measured around each event.</p>;
  } else if (history.status === "no-bookings") {
    body = <p className="text-sm text-muted-foreground">No bookings yet for your cars in this market. Once you have a few weeks of bookings, this shows how each event actually moved your rates and demand.</p>;
  } else if (history.status === "error") {
    body = <p className="text-sm text-muted-foreground">Could not load past events right now.</p>;
  } else if (history.results.length === 0) {
    body = <p className="text-sm text-muted-foreground">No past events with enough cars in a class to measure yet (needs 3 or more cars of a type).</p>;
  } else {
    body = (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          {measurable.length > 0
            ? `${measurable.length} of ${history.results.length} past event results have enough bookings to read.`
            : "No past event has enough bookings yet to read a result. Small fleets give wide ranges, so we say so."}
        </p>
        {shown.map((r) => {
          const v = VERDICT_LABEL[r.verdict];
          return (
            <div key={`${r.event}-${r.start}-${r.segment}`} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium leading-tight">{r.event} <span className="font-normal text-muted-foreground">· last held {fmtRange({ date: r.start, endDate: r.end })}</span></div>
                  <div className="text-xs text-muted-foreground">{SEGMENT_LABELS[r.segment]} · {r.vehicles} cars · {r.bookingsInWindow} bookings around it</div>
                </div>
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", v.cls)}>{v.text}</span>
              </div>
              {r.verdict !== "not-enough-data" && (
                <div className="mt-2 grid gap-x-4 gap-y-1 text-xs [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
                  <div><span className="text-muted-foreground">Rates charged </span><span className="font-medium tabular-nums">{est(r.rate)}</span></div>
                  <div><span className="text-muted-foreground">Bookings started </span><span className="font-medium tabular-nums">{est(r.demand)}</span></div>
                  {r.predictedPct != null && <div><span className="text-muted-foreground">Model said </span><span className="font-medium tabular-nums">+{r.predictedPct}%</span></div>}
                </div>
              )}
            </div>
          );
        })}
        {ordered.length > 3 && (
          <Button variant="ghost" size="sm" className="h-9 w-full gap-1 text-xs" onClick={() => setOpen((v) => !v)}>
            {open ? "Show fewer" : `Show all ${ordered.length}`}
            <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
          </Button>
        )}
        <details className="text-xs text-muted-foreground">
          <summary className="min-h-8 cursor-pointer select-none py-1.5 hover:text-foreground">How this is measured</summary>
          <p className="mt-1">
            For each past event we compare your bookings during it with your bookings in the 28 days before and after (leaving out other events). Rates are compared to what each car normally charges, so a mix of cheap and expensive cars does not distort it. The brackets are a 90% range: we only say "clear lift" when the whole range is above zero, and we need at least 3 cars of a type and 8 bookings around the event.
          </p>
        </details>
      </div>
    );
  }

  return (
    <div className="rounded-xl border p-3.5">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-primary">
        <Sparkles className="h-3.5 w-3.5" /> Your results, last time
      </div>
      {body}
    </div>
  );
};

// ---------------------------------------------------------------------------
// The overview
// ---------------------------------------------------------------------------

export const EventImpactOverview = ({ events: allEvents, segmentMultipliers: serverSegments, days, loading, facts, history }: Props) => {
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showAllNotable, setShowAllNotable] = useState(false);
  const [showRoutine, setShowRoutine] = useState(false);
  const [showUnconfirmed, setShowUnconfirmed] = useState(false);
  const [confirmedOnly, setConfirmedOnly] = useState(false);
  // Audience filter: empty = everyone.
  const [activeGroups, setActiveGroups] = useState<string[]>([]);

  const evidenceCounts = useMemo(() => {
    const c: Record<Evidence, number> = { curated: 0, verified: 0, listed: 0, unconfirmed: 0 };
    for (const e of allEvents) c[evidenceOf(e)]++;
    return c;
  }, [allEvents]);

  const groupCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of allEvents) { const g = groupOf(e); if (g) c[g] = (c[g] ?? 0) + 1; }
    return c;
  }, [allEvents]);

  const events = useMemo(() => {
    let list = allEvents;
    if (confirmedOnly) list = list.filter((e) => { const ev = evidenceOf(e); return ev === "curated" || ev === "verified"; });
    if (activeGroups.length) list = list.filter((e) => { const g = groupOf(e); return g !== null && activeGroups.includes(g); });
    return list;
  }, [allEvents, activeGroups, confirmedOnly]);

  const toggleGroup = (id: string) => {
    setSelectedDay(null);
    setActiveGroups((cur) => (cur.includes(id) ? cur.filter((g) => g !== id) : [...cur, id]));
  };

  // Meters use the same rule pricing uses (confirmed weights, caps); the server's numbers are the fallback.
  const segmentMultipliers: SegmentMap | null = useMemo(() => {
    if (!events.some((e) => e.segmentImpact)) return serverSegments;
    const peaks = windowPeaks(events, days.map((d) => d.date));
    return { exotic: 1 + peaks.exotic, sports: 1 + peaks.sports, luxury: 1 + peaks.luxury, suv: 1 + peaks.suv };
  }, [events, days, serverSegments]);
  const totalAttendance = useMemo(() => events.reduce((n, e) => n + (e.attendance || 0), 0), [events]);

  const timeline = useMemo(
    () =>
      days.map((d) => {
        const u = dayUplifts(events, d.date);
        return { ...d, uplifts: u, peak: maxUplift(u), events: eventsOnDay(events, d.date), people: dayAttendance(events, d.date) };
      }),
    [days, events],
  );

  const peakDay = useMemo(() => {
    const best = timeline.reduce((b, d) => (d.peak > b.peak ? d : b), timeline[0]);
    return best && best.peak > 0 ? best : null;
  }, [timeline]);

  const headline = buildHeadline(segmentMultipliers, events, peakDay ? fmtDay(peakDay.date) : null);

  const scoped = selectedDay ? eventsOnDay(events, selectedDay) : events;
  const byDate = (a: ImpactEvent, b: ImpactEvent) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name);
  const trusted = scoped.filter((e) => evidenceOf(e) !== "unconfirmed");
  const unconfirmed = scoped.filter((e) => evidenceOf(e) === "unconfirmed").sort(byDate);
  const major = trusted.filter((e) => eventTier(e) === "major").sort(byDate);
  const notable = trusted.filter((e) => eventTier(e) === "notable").sort(byDate);
  const routine = trusted.filter((e) => eventTier(e) === "routine").sort(byDate);
  const notableShown = showAllNotable ? notable : notable.slice(0, 6);

  const today = format(new Date(), "yyyy-MM-dd");
  const scrollTimeline = timeline.length > 14;

  if (loading && allEvents.length === 0) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-24 animate-pulse rounded-xl bg-muted/30" />
        <div className="h-16 animate-pulse rounded-xl bg-muted/20" />
        <div className="h-40 animate-pulse rounded-xl bg-muted/20" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Rate outlook */}
      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4">
        <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-primary">
          <Sparkles className="h-3.5 w-3.5" />
          MotorIQ read
        </div>
        <p className="text-base font-semibold leading-snug sm:text-lg">{headline.text}</p>
        {headline.detail && <p className="mt-0.5 text-sm text-muted-foreground">{headline.detail}</p>}
        <div className="mt-4">
          <SegmentMeters segments={segmentMultipliers} />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="mt-2 inline-flex min-h-8 items-center gap-1 text-left text-[11px] text-muted-foreground hover:text-foreground">
                  <Info className="h-3 w-3 shrink-0" /> Modeled ranges: event size, who attends, how long, how well confirmed
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-[270px]">
                <p className="text-xs">These premiums are modeled and capped at +35%. They are not yet calibrated on your results (see "Your results" below). Verified and curated events count in full, listed events at half, unconfirmed events not at all.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-2 border-t border-primary/10 pt-3">
          <div>
            <div className="flex items-center gap-1.5 text-3xl font-bold leading-none tabular-nums">
              <Users className="h-6 w-6 text-primary" />
              {compactNumber(totalAttendance)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">expected attendees across {events.length} events</div>
          </div>
          {events.some((e) => e.attendance > 0) && (() => {
            const biggest = [...events].sort((a, b) => b.attendance - a.attendance)[0];
            return (
              <div className="min-w-0 text-xs text-muted-foreground">
                Biggest draw
                <div className="truncate text-sm font-medium text-foreground">{biggest.name}</div>
                <div className="tabular-nums">{biggest.attendance.toLocaleString()} {biggest.attendanceBasis === "capacity" ? "venue capacity" : "expected"} · {fmtRange(biggest)}</div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* How sure are we */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {(["curated", "verified", "listed", "unconfirmed"] as Evidence[]).map((k) => {
            const Icon = EVIDENCE_ICON[k];
            return evidenceCounts[k] > 0 ? (
              <span key={k} className={cn("inline-flex items-center gap-1", EVIDENCE_TONE[k])}>
                <Icon className="h-3.5 w-3.5" />
                <span className="tabular-nums font-medium">{evidenceCounts[k]}</span> {EVIDENCE_LABELS[k].toLowerCase()}
              </span>
            ) : null;
          })}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={confirmedOnly}
          onClick={() => { setConfirmedOnly((v) => !v); setSelectedDay(null); }}
          className="inline-flex min-h-9 items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <span className={cn("relative inline-block h-5 w-9 rounded-full border transition-colors", confirmedOnly ? "border-primary bg-primary/30" : "bg-muted/40")}>
            <span className={cn("absolute top-0.5 h-3.5 w-3.5 rounded-full bg-foreground transition-all", confirmedOnly ? "left-[18px]" : "left-0.5")} />
          </span>
          Confirmed only
        </button>
      </div>

      {/* Who is coming: audience filter */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium">Who is coming to town</span>
          {activeGroups.length > 0 && (
            <Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs" onClick={() => { setActiveGroups([]); setSelectedDay(null); }}>
              <X className="h-3 w-3" /> Everyone
            </Button>
          )}
        </div>
        <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
          {AUDIENCE_GROUPS.map((g) => {
            const count = groupCounts[g.id] ?? 0;
            if (count === 0) return null;
            const Icon = GROUP_ICONS[g.id] ?? Users;
            const on = activeGroups.includes(g.id);
            return (
              <TooltipProvider key={g.id} delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => toggleGroup(g.id)}
                      aria-pressed={on}
                      className={cn(
                        "inline-flex min-h-10 shrink-0 snap-start items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary",
                        on ? "border-primary bg-primary/15 text-foreground" : "bg-background/40 text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {g.label}
                      <span className="rounded-full bg-muted/60 px-1.5 text-[10px] tabular-nums">{count}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[240px]"><p className="text-xs">{g.hint}</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>
      </div>

      {/* Timeline */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium">Day by day</span>
          <span className="text-xs text-muted-foreground">{selectedDay ? "Showing one day" : scrollTimeline ? "Swipe, then tap a day" : "Tap a day to see what is on"}</span>
        </div>
        <div className={cn(scrollTimeline && "-mx-1 overflow-x-auto px-1 pb-1")}>
          <div
            className="grid items-end gap-1"
            style={{
              gridTemplateColumns: `repeat(${timeline.length}, minmax(32px, 1fr))`,
              minWidth: `${timeline.length * 34}px`,
            }}
          >
            {timeline.map((d) => {
              const height = d.peak > 0 ? Math.max(14, Math.min(100, (d.peak / 0.3) * 100)) : 0;
              const tone = d.peak >= 0.15 ? "bg-primary" : d.peak >= 0.07 ? "bg-primary/65" : "bg-primary/35";
              const date = dayDate(d.date);
              const weekend = date.getDay() === 0 || date.getDay() === 6;
              const selected = selectedDay === d.date;
              const unpriced = d.peak === 0 && d.events.length > 0;
              return (
                <TooltipProvider key={d.date} delayDuration={80}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => setSelectedDay(selected ? null : d.date)}
                        aria-pressed={selected}
                        aria-label={`${fmtDay(d.date)}: ${d.events.length} events`}
                        className={cn(
                          "group flex min-h-[88px] flex-col items-center gap-1 rounded-md px-0.5 pb-1.5 pt-0.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary",
                          selected ? "bg-primary/10" : "hover:bg-muted/30",
                        )}
                      >
                        <div className="flex h-14 w-full items-end justify-center">
                          {d.peak > 0 ? (
                            <div className={cn("w-full max-w-[22px] rounded-t-md transition-all", tone)} style={{ height: `${height}%` }} />
                          ) : (
                            <div className={cn("w-full max-w-[22px] rounded-full", unpriced ? "h-1.5 bg-muted-foreground/40" : "h-0.5 bg-muted/60")} />
                          )}
                        </div>
                        <span className={cn("text-[11px] leading-none tabular-nums", d.date === today ? "font-semibold text-primary" : weekend ? "text-foreground/80" : "text-muted-foreground")}>
                          {format(date, "d")}
                        </span>
                        <span className="text-[10px] leading-none text-muted-foreground">{format(date, "EEEEE")}</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-sm font-medium">{fmtDay(d.date)}</p>
                      {d.events.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No events</p>
                      ) : (
                        <ul className="mt-1 space-y-0.5">
                          {d.events.slice(0, 4).map((e) => (
                            <li key={e.id} className="truncate text-xs text-muted-foreground">• {e.name}{evidenceOf(e) === "unconfirmed" ? " (unconfirmed)" : ""}</li>
                          ))}
                          {d.events.length > 4 && <li className="text-xs text-muted-foreground">+{d.events.length - 4} more</li>}
                        </ul>
                      )}
                      {d.peak > 0 && (
                        <p className="mt-1 text-xs">
                          {SEGMENT_KEYS.filter((k) => d.uplifts[k] > 0.005).map((k) => `${SEGMENT_LABELS[k]} +${pctRange(Math.round(d.uplifts[k] * 100))}`).join(" · ")}
                        </p>
                      )}
                      {d.people > 0 && <p className="mt-1 text-xs">About {compactNumber(d.people)} people at events (estimate)</p>}
                      <p className="mt-1 text-[11px] text-muted-foreground">Typical weekday demand {d.demand}%</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </div>
        </div>
      </div>

      {/* What is driving it */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">{selectedDay ? `On ${fmtDay(selectedDay)}` : "What is driving it"}</span>
          {selectedDay && (
            <Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs" onClick={() => setSelectedDay(null)}>
              <X className="h-3 w-3" /> All days
            </Button>
          )}
        </div>

        {scoped.length === 0 && (
          <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            {selectedDay ? "Nothing on this day." : confirmedOnly ? "No curated or verified events in this window. Turn off \"Confirmed only\" to see the rest." : "No events found for this market and window."}
          </div>
        )}

        {major.length > 0 && <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">{major.map((e) => <MajorCard key={e.id} e={e} />)}</div>}

        {notable.length > 0 && (
          <div className="rounded-xl border p-1.5">
            <div className="px-2.5 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Notable · {notable.length}</div>
            {notableShown.map((e) => <NotableRow key={e.id} e={e} />)}
            {notable.length > 6 && (
              <Button variant="ghost" size="sm" className="mt-1 h-9 w-full gap-1 text-xs" onClick={() => setShowAllNotable((v) => !v)}>
                {showAllNotable ? "Show fewer" : `Show all ${notable.length}`}
                <ChevronDown className={cn("h-3 w-3 transition-transform", showAllNotable && "rotate-180")} />
              </Button>
            )}
          </div>
        )}

        {routine.length > 0 && (
          <div className="rounded-xl border border-dashed p-1.5">
            <Button variant="ghost" size="sm" className="h-10 w-full justify-between px-2.5 text-left text-xs text-muted-foreground" onClick={() => setShowRoutine((v) => !v)}>
              <span>Routine events · {routine.length} <span className="hidden sm:inline">(regular games, ordinary concerts; small effect)</span></span>
              <ChevronDown className={cn("h-3 w-3 shrink-0 transition-transform", showRoutine && "rotate-180")} />
            </Button>
            {showRoutine && routine.map((e) => <NotableRow key={e.id} e={e} />)}
          </div>
        )}

        {unconfirmed.length > 0 && !confirmedOnly && (
          <div className="rounded-xl border border-dashed border-warning/40 p-1.5">
            <Button variant="ghost" size="sm" className="h-10 w-full justify-between px-2.5 text-left text-xs text-muted-foreground" onClick={() => setShowUnconfirmed((v) => !v)}>
              <span>Unconfirmed · {unconfirmed.length} <span className="hidden sm:inline">(shown for context, never used for pricing)</span></span>
              <ChevronDown className={cn("h-3 w-3 shrink-0 transition-transform", showUnconfirmed && "rotate-180")} />
            </Button>
            {showUnconfirmed && unconfirmed.map((e) => <NotableRow key={e.id} e={e} />)}
          </div>
        )}
      </div>

      <YourResults history={history} />

      {/* Booking facts, kept small */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
        <span>
          Revenue vs last year{" "}
          <strong className={cn("tabular-nums", facts.yoyChange !== null && facts.yoyChange >= 0 ? "text-success" : "text-foreground")}>
            {facts.yoyChange !== null ? signed(facts.yoyChange) : "--"}
          </strong>
        </span>
        <span>
          vs last month{" "}
          <strong className={cn("tabular-nums", facts.momChange !== null && facts.momChange >= 0 ? "text-success" : "text-foreground")}>
            {facts.momChange !== null ? signed(facts.momChange) : "--"}
          </strong>
        </span>
        <span>Average booking <strong className="text-foreground">{facts.avgBookingDuration}</strong></span>
      </div>
    </div>
  );
};

export default EventImpactOverview;
