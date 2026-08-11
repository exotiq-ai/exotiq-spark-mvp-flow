import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useUserSettings } from "@/hooks/useUserSettings";
import { useMoney } from "@/hooks/useMoney";
import { useTeam } from "@/contexts/TeamContext";
import { PermissionGuard } from "@/components/common/PermissionGuard";
import { supabase } from "@/integrations/supabase/client";
import { Save, Building2, Clock, Bell, Loader2, DollarSign, Fuel, ShieldCheck, Gauge } from "lucide-react";

interface TeamSettings {
  companyName: string;
  timezone: string;
  notifyOnNewMember: boolean;
  notifyOnRoleChange: boolean;
  requireTwoFactor: boolean;
  sessionTimeout: string;
  minRate: string;
  gasFeeEnabled: boolean;
  gasFeeAmount: string;
  gasFeeDefaultOn: boolean;
}

const defaultSettings: TeamSettings = {
  companyName: "",
  timezone: "America/New_York",
  notifyOnNewMember: true,
  notifyOnRoleChange: true,
  requireTwoFactor: false,
  sessionTimeout: "30",
  minRate: "100",
  gasFeeEnabled: true,
  gasFeeAmount: "20",
  gasFeeDefaultOn: true,
};

export const TeamSettingsSection = () => {
  const { toast } = useToast();
  const { currency } = useMoney();
  const { currentTeam, refreshTeam } = useTeam();

  // Team-scoped deposit policy — persisted directly on teams.default_deposit_cents
  const [depositDollars, setDepositDollars] = useState<string>("");
  const [savingDeposit, setSavingDeposit] = useState(false);

  // Team-wide mileage defaults — persisted on teams, inherited by new vehicles
  const [mileageLimit, setMileageLimit] = useState<string>("");
  const [mileageOverage, setMileageOverage] = useState<string>("");
  const [savingMileage, setSavingMileage] = useState(false);
  const [applyingMileage, setApplyingMileage] = useState(false);

  useEffect(() => {
    setMileageLimit(currentTeam?.default_mileage_limit == null ? "" : String(currentTeam.default_mileage_limit));
    setMileageOverage(
      currentTeam?.default_mileage_overage_rate == null ? "" : String(currentTeam.default_mileage_overage_rate),
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
        .from('teams')
        .update({
          default_mileage_limit: parsed.limit,
          default_mileage_overage_rate: parsed.rate,
        })
        .eq('id', currentTeam.id);
      if (error) throw error;
      await refreshTeam();
      toast({ title: "Mileage defaults saved", description: "New vehicles will inherit these values" });
    } catch (err: any) {
      toast({ title: "Save failed", description: err?.message || "Could not update mileage defaults", variant: "destructive" });
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
      const updates: Record<string, number | null> = {};
      if (parsed.limit !== null) updates.default_mileage_limit = parsed.limit;
      if (parsed.rate !== null) updates.mileage_overage_rate = parsed.rate;

      const { data, error } = await supabase
        .from('vehicles')
        .update(updates)
        .eq('team_id', currentTeam.id)
        .neq('status', 'retired')
        .select('id');
      if (error) throw error;
      toast({
        title: "Applied to fleet",
        description: `${data?.length ?? 0} vehicle${(data?.length ?? 0) === 1 ? '' : 's'} updated`,
      });
    } catch (err: any) {
      toast({ title: "Update failed", description: err?.message || "Could not apply to fleet", variant: "destructive" });
    } finally {
      setApplyingMileage(false);
    }
  };

  useEffect(() => {
    const cents = currentTeam?.default_deposit_cents;
    setDepositDollars(cents == null ? "" : String(Math.round(cents / 100)));
  }, [currentTeam?.id, currentTeam?.default_deposit_cents]);

  const {
    settings,
    updateSetting,
    saveSettings,
    isLoading,
    isSaving
  } = useUserSettings<TeamSettings>({
    category: 'team',
    defaultSettings,
  });

  const handleSave = async () => {
    const success = await saveSettings();
    if (success) {
      toast({
        title: "Settings saved",
        description: "Team settings have been updated successfully",
      });
    }
  };

  const handleSaveDeposit = async () => {
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
    setSavingDeposit(true);
    try {
      const { error } = await supabase
        .from('teams')
        .update({
          default_deposit_cents: cents,
        })
        .eq('id', currentTeam.id);
      if (error) throw error;
      await refreshTeam();
      toast({ title: "Deposit updated", description: "Pickup deposit reference amount saved" });
    } catch (err: any) {
      toast({ title: "Save failed", description: err?.message || "Could not update deposit", variant: "destructive" });
    } finally {
      setSavingDeposit(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-6">
            <Skeleton className="h-6 w-48 mb-4" />
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Company Info */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Company Information</h3>
        </div>
        
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="companyName">Company Name</Label>
            <Input
              id="companyName"
              placeholder="Your company name"
              value={settings.companyName}
              onChange={(e) => updateSetting('companyName', e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Select 
              value={settings.timezone} 
              onValueChange={(value) => updateSetting('timezone', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                <SelectItem value="Europe/London">London (GMT)</SelectItem>
                <SelectItem value="Europe/Paris">Paris (CET)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Notifications */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Team Notifications</h3>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>New member joins</Label>
              <p className="text-sm text-muted-foreground">Get notified when someone joins the team</p>
            </div>
            <Switch
              checked={settings.notifyOnNewMember}
              onCheckedChange={(checked) => updateSetting('notifyOnNewMember', checked)}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <Label>Role changes</Label>
              <p className="text-sm text-muted-foreground">Get notified when roles are updated</p>
            </div>
            <Switch
              checked={settings.notifyOnRoleChange}
              onCheckedChange={(checked) => updateSetting('notifyOnRoleChange', checked)}
            />
          </div>
        </div>
      </Card>

      {/* Security */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Security</h3>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Require two-factor authentication</Label>
              <p className="text-sm text-muted-foreground">All team members must use 2FA</p>
            </div>
            <Switch
              checked={settings.requireTwoFactor}
              onCheckedChange={(checked) => updateSetting('requireTwoFactor', checked)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="sessionTimeout">Session timeout (minutes)</Label>
            <Select 
              value={settings.sessionTimeout} 
              onValueChange={(value) => updateSetting('sessionTimeout', value)}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 minutes</SelectItem>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="60">1 hour</SelectItem>
                <SelectItem value="120">2 hours</SelectItem>
                <SelectItem value="480">8 hours</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Rate Floor */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Pricing</h3>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="minRate">Minimum Rental Rate ({currency})</Label>
          <p className="text-sm text-muted-foreground">
            The minimum allowed rate across all tiers (3hr, 6hr, daily, multi-day). 
            Rates below this will be rejected when setting vehicle prices.
          </p>
          <Input
            id="minRate"
            type="number"
            min="0"
            step="1"
            placeholder="100"
            value={settings.minRate}
            onChange={(e) => updateSetting('minRate', e.target.value)}
            className="w-[200px]"
          />
        </div>

        <Separator className="my-4" />

        {/* Gas Fee Settings */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Fuel className="w-4 h-4 text-muted-foreground" />
            <h4 className="text-sm font-semibold">Gas / Re-fueling Fee</h4>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Enable Gas/Re-fueling Fee</Label>
              <p className="text-sm text-muted-foreground">Show the gas fee line item on bookings and payments</p>
            </div>
            <Switch
              checked={settings.gasFeeEnabled}
              onCheckedChange={(checked) => updateSetting('gasFeeEnabled', checked)}
            />
          </div>

          {settings.gasFeeEnabled && (
            <>
              <div className="space-y-2">
                <Label htmlFor="gasFeeAmount">Gas Fee Amount ({currency})</Label>
                <Input
                  id="gasFeeAmount"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="20"
                  value={settings.gasFeeAmount}
                  onChange={(e) => updateSetting('gasFeeAmount', e.target.value)}
                  onWheel={(e) => e.currentTarget.blur()}
                  className="w-[200px]"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Default to ON for new bookings</Label>
                  <p className="text-sm text-muted-foreground">When off, the fee toggle starts disabled on new bookings (opt-in per booking)</p>
                </div>
                <Switch
                  checked={settings.gasFeeDefaultOn}
                  onCheckedChange={(checked) => updateSetting('gasFeeDefaultOn', checked)}
                />
              </div>
            </>
          )}
        </div>

        <Separator className="my-4" />

        {/* Pickup Deposit (operator reference only) */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-muted-foreground" />
            <h4 className="text-sm font-semibold">Deposit you collect at pickup</h4>
          </div>

          <div className="space-y-2">
            <Label htmlFor="defaultDeposit">Default deposit amount ({currency})</Label>
            <p className="text-sm text-muted-foreground">
              Reference only — Exotiq does not collect this. You settle the deposit directly
              with the renter at pickup (card, cash, or your own terminal). Overridable per
              vehicle on the rate card. Leave blank for no default.
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
                <Button
                  variant="outline"
                  onClick={handleSaveDeposit}
                  disabled={savingDeposit}
                >
                  {savingDeposit ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save deposit
                </Button>
              </PermissionGuard>
            </div>
          </div>
        </div>

        <Separator className="my-4" />

        {/* Mileage defaults */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-muted-foreground" />
            <h4 className="text-sm font-semibold">Mileage allowance</h4>
          </div>
          <p className="text-sm text-muted-foreground">
            Applied to new vehicles automatically. Each vehicle can still be overridden on its rate card.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="defaultMileageLimit">Included miles per day</Label>
              <Input
                id="defaultMileageLimit"
                type="number"
                min="0"
                step="1"
                placeholder="125"
                value={mileageLimit}
                onChange={(e) => setMileageLimit(e.target.value)}
                onWheel={(e) => e.currentTarget.blur()}
                className="w-full sm:w-[200px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="defaultMileageOverage">Overage rate ({currency}/mi)</Label>
              <Input
                id="defaultMileageOverage"
                type="number"
                min="0"
                step="0.01"
                placeholder="4.99"
                value={mileageOverage}
                onChange={(e) => setMileageOverage(e.target.value)}
                onWheel={(e) => e.currentTarget.blur()}
                className="w-full sm:w-[200px]"
              />
            </div>
          </div>

          <PermissionGuard minRole="admin" fallback={null}>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleSaveMileage} disabled={savingMileage}>
                {savingMileage ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save defaults
              </Button>
              <Button variant="outline" onClick={handleApplyMileageToFleet} disabled={applyingMileage}>
                {applyingMileage ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Gauge className="w-4 h-4 mr-2" />}
                Apply to every vehicle
              </Button>
            </div>
          </PermissionGuard>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          {isSaving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
};
