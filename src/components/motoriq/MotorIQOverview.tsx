import { useMemo, useState } from "react";
import { ChevronDown, Info, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useMoney } from "@/hooks/useMoney";
import type { MotorIQState } from "@/hooks/useMotorIQ";
import { SEGMENT_LABELS } from "@/lib/eventImpact";
import { niceRange } from "@/lib/motoriq/format";
import { placeName } from "@/lib/motoriq/voice";
import type { InsightAction, PriceRecommendation, VehicleFacts } from "@/lib/motoriq/types";
import { cn } from "@/lib/utils";
import { InsightCard } from "./InsightCard";
import { UtilizationRateChart } from "./UtilizationRateChart";

interface Props {
  state: MotorIQState;
  canApply: boolean;
  onApplyRates: (vehicleIds?: string[]) => void;
  onOpenVehicle: (vehicleId: string) => void;
  onOpenTab: (tab: "pricing" | "forecast" | "calendar") => void;
}

const pc = (x: number | null | undefined) => (x == null ? "n/a" : `${Math.round(x * 100)}%`);

const Kpi = ({ label, value, sub, hint }: { label: string; value: string; sub: string; hint: string }) => (
  <div className="rounded-xl border bg-card p-3.5" title={hint}>
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className="mt-1 text-2xl font-bold tabular-nums leading-none">{value}</div>
    <div className="mt-1.5 text-xs text-muted-foreground">{sub}</div>
  </div>
);

export const MotorIQOverview = ({ state, canApply, onApplyRates, onOpenVehicle, onOpenTab }: Props) => {
  const { money } = useMoney();
  const { snapshot } = state;
  const [showAllCars, setShowAllCars] = useState(false);
  const [chartOpen, setChartOpen] = useState(false);

  const recById = useMemo(() => new Map((snapshot?.recommendations ?? []).map((r) => [r.vehicleId, r])), [snapshot]);

  const cars = useMemo(() => {
    if (!snapshot) return [];
    const rank = (v: VehicleFacts) => {
      const r = recById.get(v.id);
      if (!r) return 3;
      if (r.action !== "hold") return 0;
      if (r.eventRates.length) return 1;
      return 2;
    };
    return snapshot.facts.vehicles
      .filter((v) => !v.outOfService)
      .sort((a, b) => rank(a) - rank(b) || Math.abs(recById.get(b.id)?.changePct ?? 0) - Math.abs(recById.get(a.id)?.changePct ?? 0) || (a.forward7.share ?? 0) - (b.forward7.share ?? 0));
  }, [snapshot, recById]);

  if (!snapshot) return null;
  const f = snapshot.facts;
  const baseChanges = snapshot.recommendations.filter((r) => r.action !== "hold" && r.confidence !== "low").length;
  const eventQuotes = snapshot.recommendations.filter((r) => r.eventRates.length > 0).length;

  const handleAction = (a: InsightAction) => {
    if (a.kind === "apply-rates") onApplyRates(a.vehicleIds);
    else if (a.kind === "open-vehicle" && a.vehicleIds?.[0]) onOpenVehicle(a.vehicleIds[0]);
    else if (a.kind === "open-pricing") onOpenTab("pricing");
    else if (a.kind === "open-forecast") onOpenTab("forecast");
    else if (a.kind === "open-calendar") onOpenTab("calendar");
  };

  const shownCars = showAllCars ? cars : cars.slice(0, 8);

  return (
    <div className="space-y-5">
      {/* The read */}
      <section className="rounded-xl border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4" aria-label="MotorIQ summary">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-primary">
            <Sparkles className="h-3.5 w-3.5" /> MotorIQ read
          </div>
          <div className="text-[11px] text-muted-foreground">{snapshot.scope} · as of {niceRange(snapshot.asOf, snapshot.asOf)} ({placeName(snapshot.timeZone)} time)</div>
        </div>
        <p className="mt-1.5 text-base font-semibold leading-snug sm:text-lg">{snapshot.summary}</p>
        {(!state.eventsReady || state.blockedUnavailable) && (
          <p className="mt-1 text-xs text-muted-foreground">
            {!state.eventsReady ? "Checking events in your markets... " : ""}
            {state.blockedUnavailable ? "Blocked dates could not be read, so days you blocked count as available. " : ""}
          </p>
        )}
        <details className="mt-2 text-xs text-muted-foreground">
          <summary className="inline-flex min-h-8 cursor-pointer select-none items-center gap-1 py-1.5 hover:text-foreground"><Info className="h-3 w-3" /> How MotorIQ decides</summary>
          <ul className="mt-1.5 list-disc space-y-1 pl-4">
            <li>Everything here is computed from your own bookings, vehicles and blocked dates. Nothing comes from a stored "utilization" or "suggested rate" value.</li>
            <li><strong>Base rates</strong> move only when the next 7 days are filling clearly faster or slower than they normally do at this point in the week (your last 60 days), and never by more than +25% or -15% at once.</li>
            <li>A car is not raised when guests have recently booked it below its listed rate, or when it is hardly booked at all.</li>
            <li><strong>Events</strong> are shown as quotes for their specific dates, never as a silent change to your base rate. Only events we could confirm count, and we apply half of their modeled effect because that model is not yet calibrated on your results.</li>
            <li>When there is not enough data to be sure, MotorIQ says "hold" and tells you why.</li>
          </ul>
        </details>
      </section>

      {/* Key numbers */}
      <section className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]" aria-label="Key numbers">
        <Kpi label="Next 7 days booked" value={pc(f.fleet.forward7.share)} sub={`${f.fleet.forward7.booked} of ${f.fleet.forward7.available} car-days`} hint="Booked days divided by available days over the next 7 days (blocked days excluded)." />
        <Kpi label="Utilization, last 30 days" value={pc(f.fleet.trailing30.share)} sub="booked days ÷ available days" hint="Computed from your bookings, not from a stored value." />
        <Kpi label="Booked ahead, next 30 days" value={f.fleet.bookedRevenueNext30.value == null ? "n/a" : money(f.fleet.bookedRevenueNext30.value)} sub={f.fleet.earnedLast30.value == null ? "no booked days last 30" : `last 30 days earned ${money(f.fleet.earnedLast30.value)}`} hint="Booked days at their booked daily rates. More bookings will still arrive." />
        <Kpi label="Rate changes suggested" value={String(baseChanges)} sub={eventQuotes ? `+ event quotes for ${eventQuotes} cars` : "no event quotes"} hint="Base-rate changes MotorIQ is confident enough to suggest this week." />
      </section>

      {/* What deserves attention */}
      <section aria-label="What deserves attention">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium">What deserves your attention</h2>
          {canApply && baseChanges > 0 && (
            <Button size="sm" variant="outline" className="min-h-9" onClick={() => onApplyRates(undefined)}>Review all rate changes</Button>
          )}
        </div>
        {snapshot.insights.length === 0 ? (
          <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
            Nothing needs attention right now: bookings are filling at their usual pace and no confirmed event is about to change demand.
          </div>
        ) : (
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr))]">
            {snapshot.insights.map((i) => <InsightCard key={i.id} insight={i} onAction={handleAction} canApply={canApply} />)}
          </div>
        )}
      </section>

      {/* Cars */}
      <section aria-label="Your cars" className="rounded-xl border">
        <div className="flex items-center justify-between gap-2 px-4 pb-1 pt-3">
          <h2 className="text-sm font-medium">Your cars <span className="font-normal text-muted-foreground">· {cars.length}</span></h2>
          <span className="text-[11px] text-muted-foreground">needs a decision first</span>
        </div>
        <ul className="divide-y">
          {shownCars.map((v) => (
            <CarRow key={v.id} v={v} rec={recById.get(v.id)} money={money} onOpen={() => onOpenVehicle(v.id)} />
          ))}
        </ul>
        {cars.length > 8 && (
          <Button variant="ghost" className="h-10 w-full gap-1 rounded-t-none text-xs" onClick={() => setShowAllCars((s) => !s)}>
            {showAllCars ? "Show fewer" : `Show all ${cars.length} cars`}
            <ChevronDown className={cn("h-3 w-3 transition-transform", showAllCars && "rotate-180")} />
          </Button>
        )}
      </section>

      {/* The chart, kept but compact and collapsed */}
      <Collapsible open={chartOpen} onOpenChange={setChartOpen} className="rounded-xl border">
        <CollapsibleTrigger asChild>
          <button type="button" className="flex min-h-12 w-full items-center justify-between gap-2 px-4 py-3 text-left">
            <span>
              <span className="block text-sm font-medium">Price vs. utilization</span>
              <span className="block text-xs text-muted-foreground">Each car against similar cars in its market</span>
            </span>
            <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", chartOpen && "rotate-180")} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="px-4 pb-4">
          <UtilizationRateChart vehicles={f.vehicles} onSelect={onOpenVehicle} />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

const CarRow = ({ v, rec, money, onOpen }: { v: VehicleFacts; rec?: PriceRecommendation; money: (n: number) => string; onOpen: () => void }) => {
  const fwd = v.forward7.share;
  return (
    <li>
      <button type="button" onClick={onOpen} className="flex min-h-14 w-full flex-col gap-2 px-4 py-3 text-left hover:bg-muted/30 sm:grid sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_minmax(0,1.3fr)] sm:items-center sm:gap-3" aria-label={`${v.name}: open rate editor`}>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{v.name}</span>
          <span className="block text-[11px] text-muted-foreground">{SEGMENT_LABELS[v.segment]}</span>
        </span>
        <span className="min-w-0">
          <span className="block text-[11px] text-muted-foreground">Next 7 days</span>
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-full max-w-[90px] overflow-hidden rounded-full bg-muted/60"><span className="block h-full rounded-full bg-primary" style={{ width: `${Math.round((fwd ?? 0) * 100)}%` }} /></span>
            <span className="text-xs tabular-nums">{pc(fwd)}</span>
          </span>
        </span>
        <span>
          <span className="block text-[11px] text-muted-foreground">Last 30 days</span>
          <span className="text-sm tabular-nums">{pc(v.trailing30.share)}</span>
        </span>
        <span>
          <span className="block text-[11px] text-muted-foreground">Listed rate</span>
          <span className="text-sm tabular-nums">{money(v.currentRate)}</span>
        </span>
        <span className="min-w-0"><Suggestion rec={rec} money={money} /></span>
      </button>
    </li>
  );
};

const Suggestion = ({ rec, money }: { rec?: PriceRecommendation; money: (n: number) => string }) => {
  if (!rec) return <span className="text-xs text-muted-foreground">No suggestion</span>;
  const quote = rec.eventRates[0];
  return (
    <span className="flex flex-col gap-0.5">
      {rec.action === "hold" ? (
        <span className="text-xs text-muted-foreground">Keep rate</span>
      ) : (
        <span className={cn("text-xs font-medium tabular-nums", rec.action === "raise" ? "text-success" : "text-warning")}>
          {rec.action === "raise" ? "Raise" : "Lower"} to {money(rec.recommendedRate)} ({rec.changePct > 0 ? "+" : ""}{Math.round(rec.changePct * 100)}%)
        </span>
      )}
      {quote && <span className="text-[11px] text-muted-foreground">{niceRange(quote.from, quote.to)}: quote {money(quote.rate)}</span>}
    </span>
  );
};

export default MotorIQOverview;
