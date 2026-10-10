import { useMemo, useState } from "react";
import { Calendar, Check, Copy, Pencil, Sparkles, Tag, TrendingDown, TrendingUp, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMoney } from "@/hooks/useMoney";
import type { MotorIQState } from "@/hooks/useMotorIQ";
import { SEGMENT_LABELS } from "@/lib/eventImpact";
import { niceRange } from "@/lib/motoriq/format";
import type { EventRate, PriceRecommendation, VehicleFacts } from "@/lib/motoriq/types";
import { quoteState, type RateOverride } from "@/lib/motoriq/dateRates";
import { useRateOverrideActions } from "@/hooks/useRateOverrideActions";
import { cn } from "@/lib/utils";

type Filter = "all" | "changes" | "quotes" | "holds";

interface Props {
  state: MotorIQState;
  canApply: boolean;
  onApplyRates: (vehicleIds?: string[]) => void;
  onEditRate: (vehicleId: string) => void;
}

const pc = (x: number | null | undefined) => (x == null ? "n/a" : `${Math.round(x * 100)}%`);
const CONF = { high: "High confidence", medium: "Medium confidence", low: "Low confidence" } as const;

export const PricingEngineCard = ({ state, canApply, onApplyRates, onEditRate }: Props) => {
  const { money } = useMoney();
  const [filter, setFilter] = useState<Filter>("all");
  const { snapshot } = state;
  const { apply, revoke } = useRateOverrideActions();
  const [busy, setBusy] = useState<string | null>(null);

  const overridesByCar = useMemo(() => {
    const m = new Map<string, RateOverride[]>();
    for (const o of state.activeRateOverrides) m.set(o.vehicle_id, [...(m.get(o.vehicle_id) ?? []), o]);
    return m;
  }, [state.activeRateOverrides]);

  const run = async (key: string, work: () => Promise<void>, done: string) => {
    setBusy(key);
    try { await work(); toast.success(done); } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save the date rate."); } finally { setBusy(null); }
  };
  const applyQuote = (r: PriceRecommendation, e: EventRate) =>
    run(`${r.vehicleId}|${e.from}`, () => apply({
      vehicleId: r.vehicleId, from: e.from, to: e.to, rate: e.rate, source: "motoriq",
      reason: e.names.slice(0, 2).join(", "), eventRef: `${e.names[0] ?? "event"}|${e.from}`,
    }).then(() => undefined), `Applied for ${niceRange(e.from, e.to)}`);
  const revert = (id: string) => run(id, () => revoke(id), "Date rate removed");

  const rows = useMemo(() => {
    if (!snapshot) return [];
    const byId = new Map(snapshot.facts.vehicles.map((v) => [v.id, v]));
    return snapshot.recommendations
      .map((r) => ({ r, v: byId.get(r.vehicleId)! }))
      .filter((x) => x.v)
      .sort((a, b) => {
        const rank = (x: { r: PriceRecommendation }) => (x.r.action !== "hold" ? 0 : x.r.eventRates.length ? 1 : 2);
        return rank(a) - rank(b) || Math.abs(b.r.changePct) - Math.abs(a.r.changePct) || a.v.name.localeCompare(b.v.name);
      });
  }, [snapshot]);

  if (!snapshot) return null;

  const counts = {
    all: rows.length,
    changes: rows.filter((x) => x.r.action !== "hold").length,
    quotes: rows.filter((x) => x.r.eventRates.length > 0).length,
    holds: rows.filter((x) => x.r.action === "hold").length,
  };
  const shown = rows.filter((x) =>
    filter === "all" ? true : filter === "changes" ? x.r.action !== "hold" : filter === "quotes" ? x.r.eventRates.length > 0 : x.r.action === "hold",
  );

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast.success("Quote copied"); } catch { toast.error("Could not copy"); }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-xl border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4">
        <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-primary"><Sparkles className="h-3.5 w-3.5" /> Rates for the next 7 days</div>
        <p className="mt-1.5 text-base font-semibold leading-snug sm:text-lg">{snapshot.summary}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Every suggestion below shows what it rests on. Base-rate changes come from how fast the week is filling compared with your usual pace; event premiums are quotes for specific dates. Apply one and it prices only those dates; your base rate never changes.
        </p>
        {canApply && counts.changes > 0 && (
          <Button className="mt-3 min-h-10" onClick={() => onApplyRates(undefined)}><TrendingUp className="mr-1.5 h-4 w-4" />Review {counts.changes} rate {counts.changes === 1 ? "change" : "changes"}</Button>
        )}
      </section>

      <div role="tablist" aria-label="Filter cars" className="flex flex-wrap gap-2">
        {([
          ["all", "All cars"],
          ["changes", "Rate changes"],
          ["quotes", "Event quotes"],
          ["holds", "Keep as is"],
        ] as Array<[Filter, string]>).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={filter === id}
            onClick={() => setFilter(id)}
            className={cn("inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-medium transition-colors", filter === id ? "border-primary bg-primary/15" : "text-muted-foreground hover:bg-muted/40")}
          >
            {label}
            <span className="rounded-full bg-muted/60 px-1.5 text-[10px] tabular-nums">{counts[id]}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nothing in this view.</div>
      ) : (
        <ul className="space-y-2.5">
          {shown.map(({ r, v }) => (
            <Row
              key={r.vehicleId} r={r} v={v} money={money} canApply={canApply}
              overrides={overridesByCar.get(r.vehicleId) ?? []} busy={busy}
              onApply={() => onApplyRates([r.vehicleId])} onEdit={() => onEditRate(r.vehicleId)} onCopy={copy}
              onApplyQuote={(e) => applyQuote(r, e)} onRevert={revert}
            />
          ))}
        </ul>
      )}
    </div>
  );
};

const Row = ({ r, v, money, canApply, overrides, busy, onApply, onEdit, onCopy, onApplyQuote, onRevert }: {
  r: PriceRecommendation; v: VehicleFacts; money: (n: number) => string; canApply: boolean;
  overrides: RateOverride[]; busy: string | null;
  onApply: () => void; onEdit: () => void; onCopy: (t: string) => void;
  onApplyQuote: (e: EventRate) => void; onRevert: (id: string) => void;
}) => {
  const change = r.action !== "hold";
  // Which of this car's active date rates are an exact applied quote (shown on the quote itself); the rest are listed below.
  const shownIds = new Set(r.eventRates.map((e) => quoteState(overrides, e).applied?.id).filter(Boolean));
  const others = overrides.filter((o) => !shownIds.has(o.id));
  return (
    <li className="rounded-xl border bg-card p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <div className="truncate font-medium">{r.name}</div>
          <div className="text-xs text-muted-foreground">
            {SEGMENT_LABELS[v.segment]} · next 7 days {pc(v.forward7.share)} booked · last 30 days {pc(v.trailing30.share)}
          </div>
        </div>
        <div className="text-right">
          {change ? (
            <div className={cn("flex items-center justify-end gap-1 text-base font-semibold tabular-nums", r.action === "raise" ? "text-success" : "text-warning")}>
              {r.action === "raise" ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {money(r.currentRate)} to {money(r.recommendedRate)} <span className="text-xs font-normal">({r.changePct > 0 ? "+" : ""}{Math.round(r.changePct * 100)}%)</span>
            </div>
          ) : (
            <div className="text-base font-semibold tabular-nums">Keep {money(r.currentRate)}</div>
          )}
          <div className="text-[11px] text-muted-foreground">{CONF[r.confidence]}</div>
        </div>
      </div>

      {(r.eventRates.length > 0 || others.length > 0) && (
        <ul className="mt-2.5 space-y-1.5">
          {r.eventRates.map((e) => {
            const { applied, manual, stale } = quoteState(overrides, e);
            const key = `${r.vehicleId}|${e.from}`;
            return (
              <li key={`${e.from}-${e.to}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-accent/10 px-3 py-2 text-sm">
                <span className="min-w-0">
                  <Calendar className="mr-1.5 inline h-3.5 w-3.5 text-accent" />
                  <strong>{niceRange(e.from, e.to)}</strong>: quote {money(e.rate)} <span className="text-xs text-muted-foreground">(+{e.premiumPct}% · {e.names.slice(0, 2).join(", ")})</span>
                  {applied && !stale && <span className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-success"><Check className="h-3 w-3" />Applied</span>}
                  {stale && <span className="ml-2 text-xs text-warning">Applied at {money(Number(applied!.daily_rate))}; the quote has moved</span>}
                  {manual && <span className="ml-2 text-xs text-muted-foreground">You set {money(Number(manual.daily_rate))} by hand for these dates, which takes priority.</span>}
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  {canApply && applied && (
                    <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" disabled={busy === applied.id} onClick={() => onRevert(applied.id)}><Undo2 className="mr-1 h-3.5 w-3.5" />Revert</Button>
                  )}
                  {canApply && (!applied || stale) && !manual && (
                    <Button size="sm" variant="outline" className="h-8 px-2.5 text-xs" disabled={busy === key} onClick={() => onApplyQuote(e)}>{stale ? "Update" : "Apply quote"}</Button>
                  )}
                  <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => onCopy(`${niceRange(e.from, e.to)}: ${money(e.rate)}/day`)} aria-label={`Copy quote for ${niceRange(e.from, e.to)}`}><Copy className="h-3.5 w-3.5" /></Button>
                </span>
              </li>
            );
          })}
          {others.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
              <span className="min-w-0">
                <Tag className="mr-1.5 inline h-3.5 w-3.5 text-warning" />
                <strong>{niceRange(o.start_date, o.end_date)}</strong>: {money(Number(o.daily_rate))}/day <span className="text-xs text-muted-foreground">({o.source === "manual" ? "set by hand" : "MotorIQ quote"}{o.reason ? ` · ${o.reason}` : ""})</span>
              </span>
              {canApply && <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" disabled={busy === o.id} onClick={() => onRevert(o.id)}><Undo2 className="mr-1 h-3.5 w-3.5" />Revert</Button>}
            </li>
          ))}
        </ul>
      )}

      <details className="mt-2 text-xs text-muted-foreground">
        <summary className="min-h-8 cursor-pointer select-none py-1.5 hover:text-foreground">Why {change ? "this change" : "keep it"}?</summary>
        <div className="space-y-2 pt-1">
          {r.drivers.filter((d) => d.effectPct !== 0 || d.id === "realization").map((d) => (
            <p key={d.id}><span className="font-medium text-foreground">{d.label}.</span> {d.detail} <span className="opacity-70">Based on {d.provenance.source} ({d.provenance.n}), as of {d.provenance.asOf}.</span></p>
          ))}
          {r.holdReasons.map((h, i) => <p key={i}>{h}</p>)}
          {r.estimate && <p><span className="font-medium text-foreground">If it works:</span> about +{money(r.estimate.extraRevenue)} this week. {r.estimate.assumption}</p>}
          {r.drivers.every((d) => d.effectPct === 0) && r.holdReasons.length === 0 && <p>No signal in your recent bookings points clearly up or down.</p>}
        </div>
      </details>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {change && canApply && <Button size="sm" className="min-h-9" onClick={onApply}>Apply {money(r.recommendedRate)}</Button>}
        <Button size="sm" variant="outline" className="min-h-9" onClick={onEdit}><Pencil className="mr-1.5 h-3.5 w-3.5" />Edit rate</Button>
        {!change && <Badge variant="outline" className="text-[11px] font-normal">No change suggested</Badge>}
      </div>
    </li>
  );
};

export default PricingEngineCard;
