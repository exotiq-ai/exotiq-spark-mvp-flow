import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, Search, Undo2, Wand2 } from "lucide-react";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { useTeam } from "@/contexts/TeamContext";
import { useFleetPricingAccess } from "@/hooks/useFleetPricingAccess";
import { useToast } from "@/hooks/use-toast";
import { describeError } from "@/lib/describeError";
import { cn, formatCurrency } from "@/lib/utils";
import { applyTierRule, rateRowChanges, rateRowFrom, teamRateFloor, type RateRow, type RateTier } from "@/lib/rateRules";

const TIERS: { key: RateTier; label: string }[] = [
  { key: "h3", label: "3-hour" },
  { key: "h6", label: "6-hour" },
  { key: "multiday", label: "Multi-day (per day)" },
];

const FIELDS: { key: keyof Omit<RateRow, "id">; label: string; short: string }[] = [
  { key: "daily", label: "Daily (24 h)", short: "Daily" },
  { key: "h3", label: "3-hour", short: "3 h" },
  { key: "h6", label: "6-hour", short: "6 h" },
  { key: "multiday", label: "Multi-day / day", short: "Multi-day" },
  { key: "deposit", label: "Deposit hold", short: "Deposit" },
];

const GRID = "lg:grid-cols-[minmax(0,1fr)_repeat(4,104px)_128px]";

/**
 * Fleet → Pricing, Rates & deposit: every car's duration rates and pickup deposit hold in one place.
 * Replaces MotorIQ's Rate Tiers panel. Changes apply to bookings made after saving.
 */
export const RateRulesTable = ({ currencySymbol = "$" }: { currencySymbol?: string }) => {
  const { vehicles, updateVehicle } = useLocationFilteredFleet();
  const { currentTeam } = useTeam();
  const { canEditCars: canEdit } = useFleetPricingAccess();
  const { toast } = useToast();

  const floor = teamRateFloor(currentTeam);
  const teamDeposit = currentTeam?.default_deposit_cents != null ? currentTeam.default_deposit_cents / 100 : null;

  const fleet = useMemo(
    () => vehicles.filter((v) => v.status !== "retired").sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [vehicles],
  );

  const [rows, setRows] = useState<Record<string, RateRow>>({});
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [ruleTier, setRuleTier] = useState<RateTier>("multiday");
  const [rulePercent, setRulePercent] = useState("85");

  // Start each row from the saved car; keep what the operator typed in rows that changed.
  useEffect(() => {
    setRows((prev) => {
      const next: Record<string, RateRow> = {};
      for (const v of fleet) {
        const saved = rateRowFrom(v);
        const typed = prev[v.id];
        next[v.id] = typed && JSON.stringify(typed) !== JSON.stringify(saved) ? typed : saved;
      }
      return next;
    });
  }, [fleet]);

  const changed = fleet.filter((v) => {
    const row = rows[v.id];
    if (!row) return false;
    const r = rateRowChanges(row, v, floor);
    return r.ok === false || Object.keys(r.updates).length > 0;
  });

  const visible = query.trim()
    ? fleet.filter((v) =>
        `${v.name} ${v.make ?? ""} ${v.model ?? ""} ${v.license_plate ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : fleet;

  const setField = (id: string, key: keyof Omit<RateRow, "id">, value: string) => {
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], [key]: value } }));
    setErrors((prev) => {
      if (!prev[id]) return prev;
      const { [id]: _drop, ...rest } = prev;
      return rest;
    });
  };

  const fillTier = () => {
    const pct = Number(rulePercent);
    if (!Number.isFinite(pct) || pct <= 0 || pct > 300) {
      toast({ title: "Check the percentage", description: "Enter a percentage between 1 and 300", variant: "destructive" });
      return;
    }
    const { rows: next, filled, skipped } = applyTierRule(rows, ruleTier, pct, floor);
    setRows(next);
    const label = TIERS.find((t) => t.key === ruleTier)?.label ?? ruleTier;
    toast({
      title: `${label} filled on ${filled} car${filled === 1 ? "" : "s"}`,
      description:
        (skipped.length ? `${skipped.length} skipped (no daily rate${floor !== null ? " or under the minimum" : ""}). ` : "") +
        "Review the rows, then Save.",
    });
  };

  const discard = () => {
    setRows(Object.fromEntries(fleet.map((v) => [v.id, rateRowFrom(v)])));
    setErrors({});
  };

  const save = async () => {
    const problems: Record<string, string> = {};
    const work: Array<{ id: string; name: string; updates: Record<string, unknown> }> = [];
    for (const v of changed) {
      const r = rateRowChanges(rows[v.id], v, floor);
      if (r.ok === false) problems[v.id] = r.error;
      else work.push({ id: v.id, name: v.name, updates: r.updates });
    }
    if (Object.keys(problems).length) {
      setErrors(problems);
      toast({ title: "Check the highlighted cars", description: `${Object.keys(problems).length} row(s) need fixing before saving`, variant: "destructive" });
      return;
    }
    setSaving(true);
    let saved = 0;
    const failed: string[] = [];
    try {
      for (const w of work) {
        const ok = await updateVehicle(w.id, w.updates, { silent: true, source: "fleet_pricing" });
        if (ok) saved++;
        else failed.push(w.name);
      }
    } catch (err) {
      toast({ title: "Save failed", description: describeError(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
    if (failed.length) {
      toast({ title: `Saved ${saved}, ${failed.length} failed`, description: failed.slice(0, 3).join(", "), variant: "destructive" });
    } else if (saved) {
      toast({ title: "Rates saved", description: `${saved} car${saved === 1 ? "" : "s"} updated. Existing bookings keep their price.` });
    }
  };

  if (fleet.length === 0) {
    return <p className="text-sm text-muted-foreground">Add a vehicle to set its rates here.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Leave a tier empty to stop offering it. An empty deposit uses the team default
        {teamDeposit != null ? ` (${formatCurrency(teamDeposit)})` : ""}.
        {floor !== null ? ` Rates can't go under the team minimum of ${formatCurrency(floor)}.` : ""}
      </p>

      {canEdit && (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border bg-muted/30 p-3">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Fill for every car</span>
            <Select value={ruleTier} onValueChange={(v) => setRuleTier(v as RateTier)}>
              <SelectTrigger className="w-[190px]" aria-label="Tier to fill">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIERS.map((t) => (
                  <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">% of daily</span>
            <div className="relative">
              <Input
                inputMode="decimal"
                value={rulePercent}
                onChange={(e) => setRulePercent(e.target.value)}
                className="w-[96px] pr-7"
                aria-label="Percent of the daily rate"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
            </div>
          </div>
          <Button variant="outline" onClick={fillTier}>
            <Wand2 className="h-4 w-4 mr-2" /> Fill
          </Button>
          <span className="text-xs text-muted-foreground basis-full sm:basis-auto">Fills the rows below; nothing is saved until you press Save.</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
        <div className="relative sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${fleet.length} cars`} aria-label="Search cars" className="pl-9" />
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="ghost" onClick={discard} disabled={saving || changed.length === 0}>
              <Undo2 className="h-4 w-4 mr-2" /> Discard
            </Button>
            <Button onClick={save} disabled={saving || changed.length === 0}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save {changed.length > 0 ? `${changed.length} change${changed.length === 1 ? "" : "s"}` : "changes"}
            </Button>
          </div>
        )}
      </div>

      <div className={cn("hidden lg:grid gap-3 px-3 text-xs font-medium text-muted-foreground", GRID)}>
        <span>Car</span>
        {FIELDS.map((f) => (
          <span key={f.key}>{f.label}</span>
        ))}
      </div>

      <ul className="space-y-2" aria-label="Rates and deposit per car">
        {visible.map((v) => {
          const row = rows[v.id];
          if (!row) return null;
          const isChanged = changed.some((c) => c.id === v.id);
          const error = errors[v.id];
          return (
            <li
              key={v.id}
              className={cn(
                "rounded-lg border p-3 grid gap-3 items-center grid-cols-2 sm:grid-cols-3",
                GRID,
                isChanged && "border-primary/50 bg-primary/5",
                error && "border-destructive bg-destructive/5",
              )}
            >
              <div className="col-span-2 sm:col-span-3 lg:col-span-1 min-w-0">
                <p className="font-medium truncate">{v.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {[v.year, v.make, v.model].filter(Boolean).join(" ")}
                  {v.license_plate ? ` · ${v.license_plate}` : ""}
                </p>
                {error && <p className="text-xs text-destructive mt-1">{error}</p>}
              </div>
              {FIELDS.map((f) => (
                <label key={f.key} className="space-y-1 lg:space-y-0">
                  <span className="lg:sr-only text-xs text-muted-foreground">{f.short}</span>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      {currencySymbol}
                    </span>
                    <Input
                      inputMode="decimal"
                      value={row[f.key]}
                      placeholder={f.key === "deposit" ? "Team default" : f.key === "daily" ? "Required" : "Off"}
                      disabled={!canEdit}
                      onChange={(e) => setField(v.id, f.key, e.target.value)}
                      aria-label={`${f.label} for ${v.name}`}
                      className="pl-7"
                    />
                  </div>
                </label>
              ))}
            </li>
          );
        })}
        {visible.length === 0 && <li className="text-sm text-muted-foreground px-3">No car matches “{query}”.</li>}
      </ul>
    </div>
  );
};

export default RateRulesTable;
