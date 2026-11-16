import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Fuel, Loader2, Save, Undo2 } from "lucide-react";
import { useTeam } from "@/contexts/TeamContext";
import { useToast } from "@/hooks/use-toast";
import { useFleetPricingAccess } from "@/hooks/useFleetPricingAccess";
import { supabase } from "@/integrations/supabase/client";
import { describeError } from "@/lib/describeError";
import { teamDefaultsChanges, teamDefaultsFormFrom, type TeamDefaultsForm } from "@/lib/teamPricingDefaults";

const MoneyInput = ({
  id,
  value,
  onChange,
  disabled,
  placeholder,
  symbol,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  placeholder: string;
  symbol: string;
}) => (
  <div className="relative">
    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{symbol}</span>
    <Input id={id} inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} placeholder={placeholder} className="pl-7" />
  </div>
);

/**
 * Fleet → Pricing → Team defaults: minimum rental rate, default deposit and the gas / re-fuelling fee, stored on the
 * team row so every staff member and booking uses the same values. Only the team owner can change them (the
 * database allows team-row updates by the owner only).
 */
export const TeamPricingDefaults = ({ currencySymbol = "$" }: { currencySymbol?: string }) => {
  const { currentTeam, refreshTeam } = useTeam();
  const { canEditTeamDefaults: canEdit } = useFleetPricingAccess();
  const { toast } = useToast();
  const [form, setForm] = useState<TeamDefaultsForm>(() => teamDefaultsFormFrom(currentTeam));
  const [saving, setSaving] = useState(false);

  // Reset only when a saved value changes, not on every team object refresh (that would wipe typing).
  useEffect(() => {
    setForm(teamDefaultsFormFrom(currentTeam));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentTeam?.id,
    currentTeam?.min_rate,
    currentTeam?.default_deposit_cents,
    currentTeam?.gas_fee_enabled,
    currentTeam?.gas_fee_amount,
    currentTeam?.gas_fee_default_on,
  ]);

  const result = teamDefaultsChanges(form, currentTeam);
  const dirty = result.ok === false || Object.keys(result.updates).length > 0;
  const set = (patch: Partial<TeamDefaultsForm>) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    if (!currentTeam?.id) return;
    if (result.ok === false) {
      toast({ title: "Check the team defaults", description: result.error, variant: "destructive" });
      return;
    }
    if (Object.keys(result.updates).length === 0) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("teams").update(result.updates).eq("id", currentTeam.id);
      if (error) throw error;
      await refreshTeam();
      toast({ title: "Team defaults saved", description: "Every staff member and new booking now uses these values." });
    } catch (err) {
      toast({ title: "Save failed", description: describeError(err, "Could not save the team defaults"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-4" aria-labelledby="team-defaults-heading">
      <div>
        <h3 id="team-defaults-heading" className="text-sm font-semibold">Team defaults</h3>
        <p className="text-xs text-muted-foreground">
          {canEdit
            ? "The same for everyone on the team."
            : "The same for everyone on the team. Only the team owner can change them."}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="team-min-rate">Minimum rental rate</Label>
          <MoneyInput id="team-min-rate" value={form.minRate} onChange={(v) => set({ minRate: v })} disabled={!canEdit} placeholder="No minimum" symbol={currencySymbol} />
          <p className="text-xs text-muted-foreground">No car's daily, 3-hour, 6-hour, multi-day or date rate can be set below this.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="team-deposit">Default deposit</Label>
          <MoneyInput id="team-deposit" value={form.deposit} onChange={(v) => set({ deposit: v })} disabled={!canEdit} placeholder="None" symbol={currencySymbol} />
          <p className="text-xs text-muted-foreground">
            Quoted to renters for cars without their own deposit. You collect it at pickup; Exotiq doesn't charge it.
          </p>
        </div>
      </div>

      <div className="rounded-lg border p-3 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Fuel className="h-4 w-4 text-muted-foreground" />
            <div>
              <Label htmlFor="team-gas-enabled">Gas / re-fuelling fee</Label>
              <p className="text-xs text-muted-foreground">A fee line on operator bookings and payments.</p>
            </div>
          </div>
          <Switch id="team-gas-enabled" checked={form.gasEnabled} onCheckedChange={(v) => set({ gasEnabled: v })} disabled={!canEdit} />
        </div>
        {form.gasEnabled && (
          <div className="grid gap-4 sm:grid-cols-2 items-end">
            <div className="space-y-1.5">
              <Label htmlFor="team-gas-amount">Fee per booking</Label>
              <MoneyInput id="team-gas-amount" value={form.gasAmount} onChange={(v) => set({ gasAmount: v })} disabled={!canEdit} placeholder="20" symbol={currencySymbol} />
            </div>
            <div className="flex items-center justify-between gap-3 sm:pb-2">
              <Label htmlFor="team-gas-default">Applied to new bookings by default</Label>
              <Switch id="team-gas-default" checked={form.gasDefaultOn} onCheckedChange={(v) => set({ gasDefaultOn: v })} disabled={!canEdit} />
            </div>
          </div>
        )}
      </div>

      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={save} disabled={saving || !dirty}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save team defaults
          </Button>
          <Button variant="ghost" onClick={() => setForm(teamDefaultsFormFrom(currentTeam))} disabled={saving || !dirty}>
            <Undo2 className="h-4 w-4 mr-2" /> Discard
          </Button>
          {result.ok === false && <p className="text-xs text-destructive self-center">{result.error}</p>}
        </div>
      )}
    </section>
  );
};

export default TeamPricingDefaults;
