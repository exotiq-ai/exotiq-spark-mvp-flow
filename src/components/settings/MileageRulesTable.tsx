import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Search, Undo2 } from "lucide-react";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { useTeam } from "@/contexts/TeamContext";
import { useFleetPricingAccess } from "@/hooks/useFleetPricingAccess";
import { useToast } from "@/hooks/use-toast";
import { describeError } from "@/lib/describeError";
import { cn } from "@/lib/utils";
import {
  mileageRowChanges,
  mileageRowFrom,
  mileageRuleSource,
  type MileageRow,
} from "@/lib/mileageRules";

const SOURCE_LABEL = {
  team: { text: "Team default", className: "border-border text-muted-foreground" },
  custom: { text: "Custom", className: "border-primary/40 text-primary" },
  unlimited: { text: "Unlimited", className: "border-success/40 text-success" },
  none: { text: "No rule", className: "border-warning/40 text-warning" },
} as const;

/**
 * Settings → Mileage: every active car's allowance, rate and unlimited flag in one place.
 * Changes apply to bookings made after saving; existing bookings keep the rule they were made with.
 */
export const MileageRulesTable = ({ currencySymbol = "$" }: { currencySymbol?: string }) => {
  const { vehicles, updateVehicle } = useLocationFilteredFleet();
  const { currentTeam } = useTeam();
  const { canEditCars } = useFleetPricingAccess();
  const { toast } = useToast();
  const canEdit = canEditCars;

  const fleet = useMemo(
    () =>
      vehicles
        .filter((v) => v.status !== "retired")
        .sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [vehicles],
  );

  const [rows, setRows] = useState<Record<string, MileageRow>>({});
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Start every row from the saved vehicle; keep what the operator has typed in rows that changed.
  useEffect(() => {
    setRows((prev) => {
      const next: Record<string, MileageRow> = {};
      for (const v of fleet) {
        const saved = mileageRowFrom(v);
        const typed = prev[v.id];
        const typedChanged = typed && JSON.stringify(typed) !== JSON.stringify(saved);
        next[v.id] = typedChanged ? typed : saved;
      }
      return next;
    });
  }, [fleet]);

  const changed = fleet.filter((v) => {
    const row = rows[v.id];
    if (!row) return false;
    const result = mileageRowChanges(row, v);
    return !result.ok || Object.keys(result.updates).length > 0;
  });

  const visible = query.trim()
    ? fleet.filter((v) => `${v.name} ${v.make ?? ""} ${v.model ?? ""} ${v.license_plate ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()))
    : fleet;

  const setRow = (id: string, patch: Partial<MileageRow>) => {
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
    setErrors((prev) => {
      if (!prev[id]) return prev;
      const { [id]: _drop, ...rest } = prev;
      return rest;
    });
  };

  const discard = () => {
    setRows(Object.fromEntries(fleet.map((v) => [v.id, mileageRowFrom(v)])));
    setErrors({});
  };

  const save = async () => {
    const problems: Record<string, string> = {};
    const work: Array<{ id: string; name: string; updates: Record<string, unknown> }> = [];
    for (const v of changed) {
      const result = mileageRowChanges(rows[v.id], v);
      if (result.ok === false) problems[v.id] = result.error;
      else work.push({ id: v.id, name: v.name, updates: result.updates });
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
        const ok = await updateVehicle(w.id, w.updates, { silent: true, source: "mileage_rules" });
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
      toast({ title: "Mileage rules saved", description: `${saved} car${saved === 1 ? "" : "s"} updated. Existing bookings keep their rule.` });
    }
  };

  if (fleet.length === 0) {
    return <p className="text-sm text-muted-foreground">Add a vehicle to set its mileage rule here.</p>;
  }

  const team = {
    default_mileage_limit: currentTeam?.default_mileage_limit ?? null,
    default_mileage_overage_rate: currentTeam?.default_mileage_overage_rate ?? null,
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
        <div className="relative sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${fleet.length} cars`}
            aria-label="Search cars"
            className="pl-9"
          />
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

      {/* Column headings (table layout from md up) */}
      <div className="hidden md:grid grid-cols-[minmax(0,1fr)_120px_140px_110px_110px] gap-3 px-3 text-xs font-medium text-muted-foreground">
        <span>Car</span>
        <span>Miles per day</span>
        <span>Overage per mile</span>
        <span>Unlimited</span>
        <span>Rule</span>
      </div>

      <ul className="space-y-2" aria-label="Mileage rule per car">
        {visible.map((v) => {
          const row = rows[v.id];
          if (!row) return null;
          const source = mileageRuleSource(
            {
              id: v.id,
              default_mileage_limit: row.miles.trim() === "" ? null : Number(row.miles),
              mileage_overage_rate: row.rate.trim() === "" ? null : Number(row.rate.replace(/^\$/, "")),
              unlimited_mileage: row.unlimited,
            },
            team,
          );
          const label = SOURCE_LABEL[source];
          const isChanged = changed.some((c) => c.id === v.id);
          const error = errors[v.id];
          return (
            <li
              key={v.id}
              className={cn(
                "rounded-lg border p-3 grid gap-3 items-center",
                "grid-cols-2 md:grid-cols-[minmax(0,1fr)_120px_140px_110px_110px]",
                isChanged && "border-primary/50 bg-primary/5",
                error && "border-destructive bg-destructive/5",
              )}
            >
              <div className="col-span-2 md:col-span-1 min-w-0">
                <p className="font-medium truncate">{v.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {[v.year, v.make, v.model].filter(Boolean).join(" ")}
                  {v.license_plate ? ` · ${v.license_plate}` : ""}
                </p>
                {error && <p className="text-xs text-destructive mt-1">{error}</p>}
              </div>

              <label className="space-y-1 md:space-y-0">
                <span className="md:sr-only text-xs text-muted-foreground">Miles per day</span>
                <Input
                  inputMode="numeric"
                  value={row.unlimited ? "" : row.miles}
                  placeholder={row.unlimited ? "Unlimited" : "None"}
                  disabled={!canEdit || row.unlimited}
                  onChange={(e) => setRow(v.id, { miles: e.target.value })}
                  aria-label={`Miles per day for ${v.name}`}
                />
              </label>

              <label className="space-y-1 md:space-y-0">
                <span className="md:sr-only text-xs text-muted-foreground">Overage per mile</span>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    {currencySymbol}
                  </span>
                  <Input
                    inputMode="decimal"
                    value={row.unlimited ? "" : row.rate}
                    placeholder={row.unlimited ? "—" : "0.00"}
                    disabled={!canEdit || row.unlimited}
                    onChange={(e) => setRow(v.id, { rate: e.target.value })}
                    aria-label={`Overage rate per mile for ${v.name}`}
                    className="pl-7"
                  />
                </div>
              </label>

              <div className="flex items-center gap-2">
                <Switch
                  checked={row.unlimited}
                  disabled={!canEdit}
                  onCheckedChange={(checked) => setRow(v.id, { unlimited: checked })}
                  aria-label={`Unlimited miles for ${v.name}`}
                />
                <span className="text-xs text-muted-foreground md:hidden">Unlimited miles</span>
              </div>

              <div className="flex justify-end md:justify-start">
                <Badge variant="outline" className={cn("whitespace-nowrap", label.className)}>
                  {label.text}
                </Badge>
              </div>
            </li>
          );
        })}
        {visible.length === 0 && <li className="text-sm text-muted-foreground px-3">No car matches “{query}”.</li>}
      </ul>
    </div>
  );
};

export default MileageRulesTable;
