import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
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
import { Link } from "react-router-dom";
import { Save, Building2, Clock, Bell, Loader2, ShieldCheck } from "lucide-react";

interface TeamSettings {
  companyName: string;
  timezone: string;
  notifyOnNewMember: boolean;
  notifyOnRoleChange: boolean;
  requireTwoFactor: boolean;
  sessionTimeout: string;
}

const defaultSettings: TeamSettings = {
  companyName: "",
  timezone: "America/New_York",
  notifyOnNewMember: true,
  notifyOnRoleChange: true,
  requireTwoFactor: false,
  sessionTimeout: "30",
};

export const TeamSettingsSection = () => {
  const { toast } = useToast();
  const { currency } = useMoney();
  const { currentTeam, refreshTeam } = useTeam();

  // Team-scoped deposit policy — persisted directly on teams.default_deposit_cents
  const [depositDollars, setDepositDollars] = useState<string>("");
  const [savingDeposit, setSavingDeposit] = useState(false);

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

      {/* Pricing moved to Fleet → Pricing (next to the cars it prices) */}
      <Card className="p-6 border-dashed">
        <p className="font-medium">Pricing has moved to Fleet → Pricing</p>
        <p className="text-sm text-muted-foreground mt-1">
          The minimum rental rate, default deposit, gas / re-fuelling fee and mileage rules are now set next to the cars,
          for the whole team, in{" "}
          <Link to="/dashboard/fleet?tab=pricing" className="text-primary underline underline-offset-2">Fleet → Pricing</Link>.
        </p>
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
