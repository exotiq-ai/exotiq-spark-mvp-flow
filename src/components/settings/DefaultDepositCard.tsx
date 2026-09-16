import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useMoney } from "@/hooks/useMoney";
import { useTeam } from "@/contexts/TeamContext";
import { PermissionGuard } from "@/components/common/PermissionGuard";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Save, ShieldCheck } from "lucide-react";

interface DefaultDepositCardProps {
  /** 'card' wraps in its own Card (Settings → Business); 'inline' renders bare (Team → Settings). */
  variant?: "card" | "inline";
  /** Optional extra line, e.g. pointing at the other place this setting appears. */
  footnote?: string;
}

/**
 * Single source of truth UI for teams.default_deposit_cents.
 * Rendered in both Settings → Business and Settings → Team → Settings so the two
 * surfaces can never drift apart.
 */
export const DefaultDepositCard = ({ variant = "card", footnote }: DefaultDepositCardProps) => {
  const { toast } = useToast();
  const { currency } = useMoney();
  const { currentTeam, refreshTeam } = useTeam();

  const [depositDollars, setDepositDollars] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const cents = currentTeam?.default_deposit_cents;
    setDepositDollars(cents == null ? "" : String(Math.round(cents / 100)));
  }, [currentTeam?.id, currentTeam?.default_deposit_cents]);

  const handleSave = async () => {
    if (!currentTeam?.id) return;
    const trimmed = depositDollars.trim();
    let cents: number | null = null;
    if (trimmed !== "") {
      const dollars = Number(trimmed);
      if (!Number.isFinite(dollars) || dollars < 0) {
        toast({ title: "Invalid amount", description: "Deposit must be zero or greater", variant: "destructive" });
        return;
      }
      cents = Math.round(dollars * 100);
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("teams")
        .update({ default_deposit_cents: cents })
        .eq("id", currentTeam.id);
      if (error) throw error;
      await refreshTeam();
      toast({ title: "Deposit updated", description: "Pickup deposit reference amount saved" });
    } catch (err: any) {
      toast({
        title: "Save failed",
        description: err?.message || "Could not update deposit",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const body = (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-muted-foreground" />
        <h4 className={variant === "card" ? "text-lg font-semibold" : "text-sm font-semibold"}>
          Deposit you collect at pickup
        </h4>
      </div>

      <div className="space-y-2">
        <Label htmlFor="defaultDeposit">Default deposit amount ({currency})</Label>
        <p className="text-sm text-muted-foreground">
          Reference only — Exotiq does not collect this. You settle the deposit directly with the
          renter at pickup (card, cash, or your own terminal). Overridable per vehicle on the rate
          card. Leave blank for no default.
        </p>
        <div className="flex items-center gap-2">
          <Input
            id="defaultDeposit"
            type="number"
            min="0"
            step="1"
            placeholder="1000"
            value={depositDollars}
            onChange={(e) => setDepositDollars(e.target.value)}
            onWheel={(e) => e.currentTarget.blur()}
            className="w-[200px]"
          />
          <PermissionGuard minRole="admin" fallback={null}>
            <Button variant="outline" onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save deposit
            </Button>
          </PermissionGuard>
        </div>
        {footnote && <p className="text-xs text-muted-foreground">{footnote}</p>}
      </div>
    </div>
  );

  if (variant === "inline") return body;

  return <Card className="p-6">{body}</Card>;
};
