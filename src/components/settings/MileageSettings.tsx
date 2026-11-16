import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Gauge, Loader2, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMoney } from "@/hooks/useMoney";
import { useTeam } from "@/contexts/TeamContext";
import { useFleet } from "@/contexts/FleetContext";
import { useFleetPricingAccess } from "@/hooks/useFleetPricingAccess";
import { supabase } from "@/integrations/supabase/client";
import { describeError } from "@/lib/describeError";
import { currencySymbol } from "@/lib/currencySymbol";
import { MileageRulesTable } from "@/components/settings/MileageRulesTable";

/**
 * Mileage rules: the team default (seeds new cars) and every car's own allowance, rate and unlimited flag.
 * Shown in Fleet → Pricing.
 */
export const MileageSettings = () => {
  const { toast } = useToast();
  const { currency } = useMoney();
  const { currentTeam, refreshTeam } = useTeam();
  const { refreshData: refreshFleet } = useFleet();
  const { canEditTeamDefaults } = useFleetPricingAccess();

  const [mileageLimit, setMileageLimit] = useState<string>("");
  const [mileageOverage, setMileageOverage] = useState<string>("");
  const [savingMileage, setSavingMileage] = useState(false);
  const [applyingMileage, setApplyingMileage] = useState(false);

  useEffect(() => {
    setMileageLimit(currentTeam?.default_mileage_limit == null ? "" : String(currentTeam.default_mileage_limit));
    setMileageOverage(
      currentTeam?.default_mileage_overage_rate == null ? "" : Number(currentTeam.default_mileage_overage_rate).toFixed(2),
    );
  }, [currentTeam?.id, currentTeam?.default_mileage_limit, currentTeam?.default_mileage_overage_rate]);

  const parseMileageInputs = (): { limit: number | null; rate: number | null } | null => {
    const l = mileageLimit.trim();
    const r = mileageOverage.trim();
    const limit = l === "" ? null : Number(l);
    const rate = r === "" ? null : Number(r);
    if (limit !== null && (!Number.isFinite(limit) || limit < 0)) return null;
    if (rate !== null && (!Number.isFinite(rate) || rate < 0)) return null;
    return { limit, rate };
  };

  const handleSaveMileage = async () => {
    if (!currentTeam?.id) return;
    const parsed = parseMileageInputs();
    if (!parsed) {
      toast({ title: "Invalid mileage values", description: "Use zero or a positive number", variant: "destructive" });
      return;
    }
    setSavingMileage(true);
    try {
      const { error } = await supabase
        .from("teams")
        .update({ default_mileage_limit: parsed.limit, default_mileage_overage_rate: parsed.rate })
        .eq("id", currentTeam.id);
      if (error) throw error;
      await refreshTeam();
      toast({ title: "Mileage defaults saved", description: "New vehicles will inherit these values" });
    } catch (err) {
      toast({ title: "Save failed", description: describeError(err, "Could not update mileage defaults"), variant: "destructive" });
    } finally {
      setSavingMileage(false);
    }
  };

  const handleApplyMileageToFleet = async () => {
    if (!currentTeam?.id) return;
    const parsed = parseMileageInputs();
    if (!parsed || (parsed.limit === null && parsed.rate === null)) {
      toast({ title: "Nothing to apply", description: "Enter a mileage limit and/or overage rate first", variant: "destructive" });
      return;
    }
    setApplyingMileage(true);
    try {
      const updates: { default_mileage_limit?: number; mileage_overage_rate?: number } = {};
      if (parsed.limit !== null) updates.default_mileage_limit = parsed.limit;
      if (parsed.rate !== null) updates.mileage_overage_rate = parsed.rate;

      const { data, error } = await supabase
        .from("vehicles")
        .update(updates)
        .eq("team_id", currentTeam.id)
        .neq("status", "retired")
        .select("id");
      if (error) throw error;
      await refreshFleet(true); // so the per-car table shows the new values
      toast({
        title: "Applied to fleet",
        description: `${data?.length ?? 0} vehicle${(data?.length ?? 0) === 1 ? "" : "s"} updated`,
      });
    } catch (err) {
      toast({ title: "Update failed", description: describeError(err, "Could not apply to fleet"), variant: "destructive" });
    } finally {
      setApplyingMileage(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Gauge className="w-4 h-4 text-muted-foreground" />
        <h4 className="text-sm font-semibold">Mileage allowance</h4>
      </div>
      <p className="text-sm text-muted-foreground">
        Rentals include the car's miles per day for every day kept; miles over that are charged at the car's rate when
        it is checked in. The team default below is given to new cars; set each car underneath.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="defaultMileageLimit">Team default: miles per day</Label>
          <Input
            id="defaultMileageLimit"
            type="number"
            min="0"
            step="1"
            placeholder="125"
            value={mileageLimit}
            onChange={(e) => setMileageLimit(e.target.value)}
            disabled={!canEditTeamDefaults}
            onWheel={(e) => e.currentTarget.blur()}
            className="w-full sm:w-[200px]"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="defaultMileageOverage">Team default: overage per mile ({currency})</Label>
          <Input
            id="defaultMileageOverage"
            type="number"
            min="0"
            step="0.01"
            placeholder="4.99"
            value={mileageOverage}
            onChange={(e) => setMileageOverage(e.target.value)}
            disabled={!canEditTeamDefaults}
            onWheel={(e) => e.currentTarget.blur()}
            className="w-full sm:w-[200px]"
          />
        </div>
      </div>

      {canEditTeamDefaults ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleSaveMileage} disabled={savingMileage}>
            {savingMileage ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save defaults
          </Button>
          <Button variant="outline" onClick={handleApplyMileageToFleet} disabled={applyingMileage}>
            {applyingMileage ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Gauge className="w-4 h-4 mr-2" />}
            Apply to every car
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Only the team owner can change the team default.</p>
      )}

      <div className="space-y-2 pt-2">
        <h5 className="text-sm font-semibold">Each car</h5>
        <p className="text-xs text-muted-foreground">
          Changes apply to bookings made after you save; existing bookings keep the rule they were made with.
          "Apply to every car" leaves unlimited cars unlimited.
        </p>
        <MileageRulesTable currencySymbol={currencySymbol(currency)} />
      </div>
    </div>
  );
};

export default MileageSettings;
