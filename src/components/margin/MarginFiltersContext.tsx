import { createContext, useContext, useMemo, useState, ReactNode } from "react";
import { startOfMonth, startOfQuarter, startOfYear, endOfMonth, subMonths } from "date-fns";

export type DateRangePreset = "this_month" | "last_month" | "qtd" | "ytd" | "custom";

export interface MarginFilters {
  start: Date;
  end: Date;
  preset: DateRangePreset;
  locationIds: string[];
  vehicleIds: string[];
  sources: string[]; // empty = all
}

interface Ctx extends MarginFilters {
  setRange: (start: Date, end: Date, preset?: DateRangePreset) => void;
  setPreset: (p: DateRangePreset) => void;
  setLocationIds: (ids: string[]) => void;
  setVehicleIds: (ids: string[]) => void;
  setSources: (s: string[]) => void;
  reset: () => void;
}

const MarginFiltersCtx = createContext<Ctx | null>(null);

const presetRange = (p: DateRangePreset): { start: Date; end: Date } => {
  const now = new Date();
  switch (p) {
    case "last_month": {
      const lm = subMonths(now, 1);
      return { start: startOfMonth(lm), end: endOfMonth(lm) };
    }
    case "qtd":
      return { start: startOfQuarter(now), end: now };
    case "ytd":
      return { start: startOfYear(now), end: now };
    case "this_month":
    default:
      return { start: startOfMonth(now), end: now };
  }
};

export function MarginFiltersProvider({ children }: { children: ReactNode }) {
  const initial = presetRange("this_month");
  const [preset, setPresetState] = useState<DateRangePreset>("this_month");
  const [start, setStart] = useState<Date>(initial.start);
  const [end, setEnd] = useState<Date>(initial.end);
  const [locationIds, setLocationIds] = useState<string[]>([]);
  const [vehicleIds, setVehicleIds] = useState<string[]>([]);
  const [sources, setSources] = useState<string[]>([]);

  const value = useMemo<Ctx>(
    () => ({
      start,
      end,
      preset,
      locationIds,
      vehicleIds,
      sources,
      setRange: (s, e, p = "custom") => {
        setStart(s);
        setEnd(e);
        setPresetState(p);
      },
      setPreset: (p) => {
        if (p === "custom") {
          setPresetState("custom");
          return;
        }
        const r = presetRange(p);
        setStart(r.start);
        setEnd(r.end);
        setPresetState(p);
      },
      setLocationIds,
      setVehicleIds,
      setSources,
      reset: () => {
        const r = presetRange("this_month");
        setStart(r.start);
        setEnd(r.end);
        setPresetState("this_month");
        setLocationIds([]);
        setVehicleIds([]);
        setSources([]);
      },
    }),
    [start, end, preset, locationIds, vehicleIds, sources]
  );

  return <MarginFiltersCtx.Provider value={value}>{children}</MarginFiltersCtx.Provider>;
}

export function useMarginFilters() {
  const ctx = useContext(MarginFiltersCtx);
  if (!ctx) throw new Error("useMarginFilters must be used inside MarginFiltersProvider");
  return ctx;
}

export const SOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: "direct", label: "Direct" },
  { value: "marketplace", label: "Drive Exotiq" },
  { value: "drive_exotiq", label: "Drive Exotiq" },
  { value: "turo", label: "Turo" },
  { value: "getaround", label: "Getaround" },
  { value: "website", label: "Website" },
  { value: "referral", label: "Referral" },
  { value: "other", label: "Other" },
];

export const sourceLabel = (s: string | null | undefined) => {
  if (!s) return "Direct";
  if (s === "marketplace" || s === "drive_exotiq") return "Drive Exotiq";
  const opt = SOURCE_OPTIONS.find((o) => o.value === s);
  return opt?.label || s.replace("_", " ");
};
