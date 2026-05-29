import { useEffect, useState } from "react";
import { useMarginFilters, SOURCE_OPTIONS, DateRangePreset } from "./MarginFiltersContext";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/contexts/TeamContext";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PRESETS: { value: DateRangePreset; label: string }[] = [
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "qtd", label: "Quarter to date" },
  { value: "ytd", label: "Year to date" },
  { value: "custom", label: "Custom range" },
];

export function MarginFilterBar({ vertical = false }: { vertical?: boolean } = {}) {
  const { currentTeam } = useTeam();
  const f = useMarginFilters();
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [vehicles, setVehicles] = useState<{ id: string; name: string; location_id: string | null }[]>([]);

  useEffect(() => {
    if (!currentTeam?.id) return;
    (async () => {
      const [{ data: locs }, { data: vehs }] = await Promise.all([
        supabase.from("locations").select("id, name").eq("team_id", currentTeam.id).eq("is_active", true).order("name"),
        supabase.from("vehicles").select("id, make, model, location_id").eq("team_id", currentTeam.id).is("trashed_at", null).is("archived_at", null).order("make"),
      ]);
      setLocations((locs || []) as any);
      setVehicles(((vehs || []) as any[]).map((v) => ({ id: v.id, name: `${v.make} ${v.model}`, location_id: v.location_id })));
    })();
  }, [currentTeam?.id]);

  const visibleVehicles = f.locationIds.length === 0
    ? vehicles
    : vehicles.filter((v) => v.location_id && f.locationIds.includes(v.location_id));

  const hasFilters = f.locationIds.length || f.vehicleIds.length || f.sources.length || f.preset !== "this_month";

  const containerClass = vertical
    ? "flex flex-col gap-3 [&>button]:w-full [&>button]:justify-between"
    : "flex flex-wrap items-center gap-2";

  return (
    <div className={containerClass}>
      <Select value={f.preset} onValueChange={(v) => f.setPreset(v as DateRangePreset)}>
        <SelectTrigger className={vertical ? "h-10 w-full" : "h-9 w-[160px]"}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PRESETS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
        </SelectContent>
      </Select>

      {f.preset === "custom" && (
        <>
          <DatePopover label="From" value={f.start} onChange={(d) => f.setRange(d, f.end, "custom")} />
          <DatePopover label="To" value={f.end} onChange={(d) => f.setRange(f.start, d, "custom")} />
        </>
      )}

      {f.preset !== "custom" && !vertical && (
        <span className="text-xs text-muted-foreground hidden md:inline">
          {format(f.start, "MMM d")} – {format(f.end, "MMM d, yyyy")}
        </span>
      )}

      <MultiSelectMenu
        label="Locations"
        selected={f.locationIds}
        options={locations.map((l) => ({ id: l.id, label: l.name }))}
        onChange={f.setLocationIds}
        vertical={vertical}
      />

      <MultiSelectMenu
        label="Vehicles"
        selected={f.vehicleIds}
        options={visibleVehicles.map((v) => ({ id: v.id, label: v.name }))}
        onChange={f.setVehicleIds}
        vertical={vertical}
      />

      <MultiSelectMenu
        label="Sources"
        selected={f.sources}
        options={dedupeSources()}
        onChange={f.setSources}
        vertical={vertical}
      />

      {hasFilters ? (
        <Button variant="ghost" size="sm" onClick={f.reset} className={vertical ? "h-10 w-full" : "h-9"}>
          <X className="h-3.5 w-3.5 mr-1" /> Reset
        </Button>
      ) : null}
    </div>
  );
}

export function useMarginActiveFilterCount() {
  const f = useMarginFilters();
  return (
    f.locationIds.length +
    f.vehicleIds.length +
    f.sources.length +
    (f.preset !== "this_month" ? 1 : 0)
  );
}

function dedupeSources(): { id: string; label: string }[] {
  const seen = new Set<string>();
  const out: { id: string; label: string }[] = [];
  for (const s of SOURCE_OPTIONS) {
    if (seen.has(s.label)) continue;
    seen.add(s.label);
    // Use the canonical value; for Drive Exotiq we'll match both via context comparison
    out.push({ id: s.value, label: s.label });
  }
  return out;
}

function DatePopover({ label, value, onChange }: { label: string; value: Date; onChange: (d: Date) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("h-9 font-normal")}>
          <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
          {label}: {format(value, "MMM d, yyyy")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 z-[60]" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(d) => d && onChange(d)}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}

function MultiSelectMenu({
function MultiSelectMenu({
  label, options, selected, onChange, vertical = false,
}: { label: string; options: { id: string; label: string }[]; selected: string[]; onChange: (v: string[]) => void; vertical?: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={vertical ? "h-10 font-normal" : "h-9 font-normal"}>
          {label}
          {selected.length > 0 && (
            <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-[10px]">{selected.length}</Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="z-[60] max-h-[320px] overflow-y-auto w-[220px]">
        <DropdownMenuLabel className="text-xs">{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.length === 0 ? (
          <div className="px-2 py-3 text-xs text-muted-foreground">No options</div>
        ) : (
          options.map((o) => (
            <DropdownMenuCheckboxItem
              key={o.id}
              checked={selected.includes(o.id)}
              onCheckedChange={() =>
                onChange(selected.includes(o.id) ? selected.filter((s) => s !== o.id) : [...selected, o.id])
              }
              onSelect={(e) => e.preventDefault()}
            >
              {o.label}
            </DropdownMenuCheckboxItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
