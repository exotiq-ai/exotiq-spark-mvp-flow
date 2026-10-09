import { useState } from "react";
import { toast } from "sonner";
import { Calendar, Check, Copy, Tag, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTeam } from "@/contexts/TeamContext";
import { useMoney } from "@/hooks/useMoney";
import { useRateOverrideActions } from "@/hooks/useRateOverrideActions";
import { useRateOverrides } from "@/hooks/useRateOverrides";
import { useUserRole } from "@/hooks/useUserRole";
import { quoteState } from "@/lib/motoriq/dateRates";
import { niceRange } from "@/lib/motoriq/format";
import type { EventRate } from "@/lib/motoriq/types";

interface Props {
  vehicleId: string;
  /** MotorIQ's event quotes for this car, when there are any */
  quotes?: EventRate[];
}

/**
 * Rates for specific dates: apply or revert MotorIQ's event quotes, see the date rates in force for this car, and set
 * one by hand. A date rate prices only those days; the base rate and every existing booking stay as they are.
 */
export const DateRatesSection = ({ vehicleId, quotes = [] }: Props) => {
  const { money } = useMoney();
  const { active, today } = useRateOverrides();
  const { apply, revoke } = useRateOverrideActions();
  const { hasRoleOrHigher } = useUserRole();
  const { currentTeam } = useTeam();
  const canEdit = hasRoleOrHigher("manager");
  const teamMin = Number((currentTeam as any)?.min_rate) || 0;

  const mine = active.filter((o) => o.vehicle_id === vehicleId);
  const [busy, setBusy] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rate, setRate] = useState("");
  const [reason, setReason] = useState("");

  const run = async (key: string, work: () => Promise<unknown>, done: string) => {
    setBusy(key);
    try { await work(); toast.success(done); return true; } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save the date rate."); return false; } finally { setBusy(null); }
  };
  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast.success("Quote copied"); } catch { toast.error("Could not copy"); }
  };

  const shownIds = new Set(quotes.map((q) => quoteState(mine, q).applied?.id).filter(Boolean));
  const others = mine.filter((o) => !shownIds.has(o.id));
  const rateNum = Number(rate);
  const formOk = !!from && !!to && to >= from && rateNum > 0 && rateNum >= teamMin;

  if (quotes.length === 0 && mine.length === 0 && !canEdit) return null;

  return (
    <div className="space-y-3">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Rates for specific dates</div>

      {quotes.map((q) => {
        const { applied, stale, manual } = quoteState(mine, q);
        const key = `${vehicleId}|${q.from}`;
        return (
          <div key={`${q.from}-${q.to}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-sm font-medium"><Calendar className="h-3.5 w-3.5 text-accent" />{niceRange(q.from, q.to)}: {money(q.rate)}/day <span className="text-xs font-normal text-muted-foreground">(+{q.premiumPct}%)</span></div>
              <div className="truncate text-xs text-muted-foreground">{q.names.slice(0, 3).join(", ")}</div>
              {applied && !stale && <div className="mt-0.5 flex items-center gap-1 text-xs font-medium text-success"><Check className="h-3 w-3" />Applied</div>}
              {stale && <div className="mt-0.5 text-xs text-warning">Applied at {money(Number(applied!.daily_rate))}; the quote has moved.</div>}
              {manual && <div className="mt-0.5 text-xs text-muted-foreground">You set {money(Number(manual.daily_rate))} by hand for these dates, which takes priority.</div>}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {canEdit && applied && <Button size="sm" variant="ghost" className="min-h-9" disabled={busy === applied.id} onClick={() => run(applied.id, () => revoke(applied.id), "Date rate removed")}><Undo2 className="mr-1 h-3.5 w-3.5" />Revert</Button>}
              {canEdit && (!applied || stale) && !manual && (
                <Button size="sm" variant="outline" className="min-h-9" disabled={busy === key} onClick={() => run(key, () => apply({ vehicleId, from: q.from, to: q.to, rate: q.rate, source: "motoriq", reason: q.names.slice(0, 2).join(", "), eventRef: `${q.names[0] ?? "event"}|${q.from}` }), `Applied for ${niceRange(q.from, q.to)}`)}>{stale ? "Update" : "Apply quote"}</Button>
              )}
              <Button size="sm" variant="ghost" className="min-h-9" onClick={() => copy(`${niceRange(q.from, q.to)}: ${money(q.rate)}/day`)} aria-label="Copy quote"><Copy className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        );
      })}

      {others.map((o) => (
        <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 font-medium"><Tag className="h-3.5 w-3.5 text-warning" />{niceRange(o.start_date, o.end_date)}: {money(Number(o.daily_rate))}/day</div>
            <div className="truncate text-xs text-muted-foreground">{o.source === "manual" ? "Set by hand" : "From a MotorIQ quote"}{o.reason ? ` · ${o.reason}` : ""}</div>
          </div>
          {canEdit && <Button size="sm" variant="ghost" className="min-h-9" disabled={busy === o.id} onClick={() => run(o.id, () => revoke(o.id), "Date rate removed")}><Undo2 className="mr-1 h-3.5 w-3.5" />Revert</Button>}
        </div>
      ))}

      {canEdit && (
        <details className="rounded-lg border p-3">
          <summary className="min-h-9 cursor-pointer select-none py-1.5 text-sm font-medium">Set a rate for specific dates</summary>
          <form
            className="mt-2 space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!formOk) return;
              const ok = await run("form", () => apply({ vehicleId, from, to, rate: rateNum, source: "manual", reason: reason.trim() || undefined }), `Rate set for ${niceRange(from, to)}`);
              if (ok) { setFrom(""); setTo(""); setRate(""); setReason(""); }
            }}
          >
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1 text-xs text-muted-foreground">First day
                <Input type="date" value={from} min={today} onChange={(e) => { setFrom(e.target.value); if (!to || to < e.target.value) setTo(e.target.value); }} className="h-11 text-foreground" />
              </label>
              <label className="space-y-1 text-xs text-muted-foreground">Last day
                <Input type="date" value={to} min={from || today} onChange={(e) => setTo(e.target.value)} className="h-11 text-foreground" />
              </label>
            </div>
            <label className="block space-y-1 text-xs text-muted-foreground">Daily rate for those days
              <Input type="number" inputMode="decimal" value={rate} min={teamMin || undefined} onChange={(e) => setRate(e.target.value)} placeholder={teamMin ? `at least ${money(teamMin)}` : "rate"} className="h-11 text-foreground" />
            </label>
            <label className="block space-y-1 text-xs text-muted-foreground">Note (optional)
              <Input value={reason} maxLength={80} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Race weekend" className="h-11 text-foreground" />
            </label>
            <p className="text-xs text-muted-foreground">Prices only these days. Your base rate and guests who already booked are not changed. A rate you set by hand takes priority over MotorIQ's quotes.</p>
            <Button type="submit" className="min-h-11 w-full" disabled={!formOk || busy === "form"}>{busy === "form" ? "Saving..." : "Set rate for these dates"}</Button>
          </form>
        </details>
      )}
    </div>
  );
};

export default DateRatesSection;
