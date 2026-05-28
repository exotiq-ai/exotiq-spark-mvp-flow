import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/contexts/TeamContext";

export interface VehiclePartner {
  id: string;
  team_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  payout_method: string | null;
  notes: string | null;
  is_active: boolean;
  stripe_connect_account_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PartnerInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  payout_method?: string | null;
  notes?: string | null;
  is_active?: boolean;
}

export function usePartners() {
  const { currentTeam } = useTeam();
  const [partners, setPartners] = useState<VehiclePartner[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!currentTeam?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("vehicle_partners")
      .select("*")
      .eq("team_id", currentTeam.id)
      .order("name");
    if (!error) setPartners((data as VehiclePartner[]) || []);
    setLoading(false);
  }, [currentTeam?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = async (input: PartnerInput) => {
    if (!currentTeam?.id) throw new Error("No team");
    const { data, error } = await supabase
      .from("vehicle_partners")
      .insert({ ...input, team_id: currentTeam.id })
      .select()
      .single();
    if (error) throw error;
    await refresh();
    return data as VehiclePartner;
  };

  const update = async (id: string, input: Partial<PartnerInput>) => {
    const { error } = await supabase.from("vehicle_partners").update(input).eq("id", id);
    if (error) throw error;
    await refresh();
  };

  const deactivate = (id: string) => update(id, { is_active: false });

  return { partners, loading, refresh, create, update, deactivate };
}
