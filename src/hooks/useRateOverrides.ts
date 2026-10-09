import { useEffect, useMemo, useState } from "react";
import { useTeam } from "@/contexts/TeamContext";
import { useTenantTimeZone } from "@/hooks/useTenantTimeZone";
import { dayKey } from "@/lib/motoriq/facts";
import type { RateOverride } from "@/lib/motoriq/dateRates";
import { loadRateOverrides, subscribeRateOverrides } from "@/lib/rateOverridesStore";

/** The team's date-specific rates (read only, shared and refreshed after any apply or revert). */
export function useRateOverrides() {
  const { currentTeam } = useTeam();
  const timeZone = useTenantTimeZone();
  const today = dayKey(Date.now(), timeZone);
  const [rows, setRows] = useState<RateOverride[]>([]);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => subscribeRateOverrides(() => setVersion((v) => v + 1)), []);
  useEffect(() => {
    let alive = true;
    loadRateOverrides(currentTeam?.id ?? "none", today).then(({ rows: r }) => {
      if (!alive) return;
      setRows(r);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [currentTeam?.id, today, version]);

  /** in force now or later, not revoked */
  const active = useMemo(() => rows.filter((o) => !o.revoked_at && o.end_date >= today), [rows, today]);
  return { rows, active, loading, today, timeZone };
}
