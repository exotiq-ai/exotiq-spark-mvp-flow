import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { invalidateRateOverrides } from "@/lib/rateOverridesStore";
import type { OverrideSource, RateOverride } from "@/lib/motoriq/dateRates";

export interface ApplyOverrideInput {
  vehicleId: string;
  /** local calendar days, yyyy-MM-dd, inclusive */
  from: string;
  to: string;
  rate: number;
  source?: OverrideSource;
  reason?: string;
  eventRef?: string;
}

/** Apply or revert a date-specific rate through the database functions (the rules live there). Managers and above. */
export function useRateOverrideActions() {
  const apply = useCallback(async (i: ApplyOverrideInput): Promise<RateOverride> => {
    const { data, error } = await (supabase as any).rpc("set_rate_override", {
      p_vehicle_id: i.vehicleId,
      p_start: i.from,
      p_end: i.to,
      p_rate: i.rate,
      p_source: i.source ?? "manual",
      p_reason: i.reason ?? null,
      p_event_ref: i.eventRef ?? null,
    });
    if (error) throw new Error(friendlyOverrideError(error.message));
    invalidateRateOverrides();
    return data as RateOverride;
  }, []);

  const revoke = useCallback(async (id: string): Promise<void> => {
    const { error } = await (supabase as any).rpc("revoke_rate_override", { p_id: id });
    if (error) throw new Error(friendlyOverrideError(error.message));
    invalidateRateOverrides();
  }, []);

  return { apply, revoke };
}

/** The database's messages are for engineers; say it plainly. */
export function friendlyOverrideError(message: string): string {
  if (/below the team minimum/i.test(message)) return "That rate is below your team's minimum rate.";
  if (/row-level security|permission|not allowed|42501/i.test(message)) return "Only managers and above can change date rates.";
  if (/already revoked|not found/i.test(message)) return "That rate was already removed.";
  if (/does not belong/i.test(message)) return "That car is not in your team.";
  return "Could not save the date rate. Please try again.";
}
