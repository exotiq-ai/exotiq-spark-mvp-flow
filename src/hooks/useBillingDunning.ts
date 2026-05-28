import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/contexts/TeamContext";

export type DunningStage = "reminder" | "notice" | "restriction";

export type AssumedPlanTier = "pro" | "business" | "enterprise";

export interface BillingDunningState {
  stage: DunningStage | null;
  message: string | null;
  setAt: string | null;
  assumedPlanTier: AssumedPlanTier | null;
  assumedPlanFleetSize: number | null;
  assumedPlanIsAnnual: boolean | null;
}

// Defensive normalizer for any grandfathered rows that still carry legacy tier names.
const normalizeTier = (raw: unknown): AssumedPlanTier | null => {
  if (raw === "pro" || raw === "business" || raw === "enterprise") return raw;
  if (raw === "starter") return "pro";
  if (raw === "professional") return "business";
  return null;
};

export const TIER_BOUNDS: Record<AssumedPlanTier, { min: number; max: number }> = {
  pro: { min: 1, max: 15 },
  business: { min: 16, max: 50 },
  enterprise: { min: 51, max: 9999 },
};

const EMPTY: BillingDunningState = {
  stage: null,
  message: null,
  setAt: null,
  assumedPlanTier: null,
  assumedPlanFleetSize: null,
  assumedPlanIsAnnual: null,
};

/**
 * Reads the current team's billing-dunning state.
 * Super-admin sets/clears the stage; this hook just observes.
 */
export const useBillingDunning = () => {
  const { currentTeam } = useTeam();
  const [state, setState] = useState<BillingDunningState>(EMPTY);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!currentTeam?.id) {
      setState(EMPTY);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("teams")
      .select(
        "billing_dunning_stage, billing_dunning_message, billing_dunning_set_at, assumed_plan_tier, assumed_plan_fleet_size, assumed_plan_is_annual"
      )
      .eq("id", currentTeam.id)
      .maybeSingle();
    const row = data as Record<string, unknown> | null;
    setState({
      stage: (row?.billing_dunning_stage as DunningStage) ?? null,
      message: (row?.billing_dunning_message as string) ?? null,
      setAt: (row?.billing_dunning_set_at as string) ?? null,
      assumedPlanTier: normalizeTier(row?.assumed_plan_tier),
      assumedPlanFleetSize: (row?.assumed_plan_fleet_size as number) ?? null,
      assumedPlanIsAnnual: (row?.assumed_plan_is_annual as boolean) ?? null,
    });
    setLoading(false);
  }, [currentTeam?.id]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, loading, refresh: load };
};

/** Convenience: true when the team is at the restriction stage. */
export const usePaymentRestricted = () => {
  const { stage } = useBillingDunning();
  return stage === "restriction";
};
