import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { AlertCircle, CheckCircle2, Loader2, Search } from "lucide-react";

type Stage = "reminder" | "notice" | "restriction";
type Tier = "pro" | "business" | "enterprise";

const TIER_INFO: Record<Tier, { label: string; price: string; min: number; max: number }> = {
  pro: { label: "Pro — $39/vehicle/mo", price: "$39", min: 1, max: 15 },
  business: { label: "Business — $29/vehicle/mo", price: "$29", min: 16, max: 50 },
  enterprise: { label: "Enterprise — custom quote", price: "Custom", min: 51, max: 9999 },
};

const normalizeLegacyTier = (raw: string | null): Tier | "" => {
  if (raw === "pro" || raw === "business" || raw === "enterprise") return raw;
  if (raw === "starter") return "pro";
  if (raw === "professional") return "business";
  return "";
};

interface TenantRow {
  id: string;
  name: string;
  owner_email: string | null;
  billing_dunning_stage: Stage | null;
  billing_dunning_set_at: string | null;
  billing_dunning_message: string | null;
  billing_dunning_notes: string | null;
  assumed_plan_tier: Tier | null;
  assumed_plan_fleet_size: number | null;
  assumed_plan_is_annual: boolean | null;
  is_demo_account: boolean | null;
}

const STAGE_LABEL: Record<Stage, string> = {
  reminder: "Reminder",
  notice: "Notice",
  restriction: "Restriction",
};

const STAGE_BADGE: Record<Stage, string> = {
  reminder: "bg-primary/10 text-primary border-primary/30",
  notice: "bg-warning/10 text-warning border-warning/30",
  restriction: "bg-destructive/10 text-destructive border-destructive/30",
};

export const SuperAdminBillingTab = () => {
  const { toast } = useToast();
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<TenantRow | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).rpc("get_super_admin_billing_tenants");
    if (error) {
      toast({
        title: "Failed to load tenants",
        description: error.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }
    const rows = (data || []) as Array<Record<string, unknown>>;
    setTenants(
      rows.map((r) => ({
        id: r.id as string,
        name: (r.name as string) || "Unnamed",
        owner_email: (r.owner_email as string) ?? null,
        billing_dunning_stage: (r.billing_dunning_stage as Stage) ?? null,
        billing_dunning_set_at: (r.billing_dunning_set_at as string) ?? null,
        billing_dunning_message: (r.billing_dunning_message as string) ?? null,
        billing_dunning_notes: (r.billing_dunning_notes as string) ?? null,
        assumed_plan_tier: (r.assumed_plan_tier as Tier) ?? null,
        assumed_plan_fleet_size: (r.assumed_plan_fleet_size as number) ?? null,
        assumed_plan_is_annual: (r.assumed_plan_is_annual as boolean) ?? null,
        is_demo_account: (r.is_demo_account as boolean) ?? null,
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.owner_email || "").toLowerCase().includes(q)
    );
  }, [tenants, search]);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Tenant billing status</CardTitle>
          <CardDescription>
            Flag tenants with a payment-due banner. Manual control only —
            nothing escalates automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by company or owner email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading tenants…
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No tenants match your search.
                </div>
              ) : (
                filtered.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelected(t)}
                    className="w-full text-left flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/40 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium truncate">{t.name}</p>
                        {t.is_demo_account && (
                          <Badge variant="outline" className="text-[10px]">
                            Demo
                          </Badge>
                        )}
                        {t.billing_dunning_stage ? (
                          <Badge
                            variant="outline"
                            className={STAGE_BADGE[t.billing_dunning_stage]}
                          >
                            <AlertCircle className="w-3 h-3 mr-1" />
                            {STAGE_LABEL[t.billing_dunning_stage]}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Clear
                          </Badge>
                        )}
                      </div>
                      {t.owner_email && (
                        <p className="text-sm text-muted-foreground truncate">
                          {t.owner_email}
                        </p>
                      )}
                      {t.assumed_plan_tier && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Assumed plan: {t.assumed_plan_tier} ·{" "}
                          {t.assumed_plan_fleet_size ?? "?"} vehicles ·{" "}
                          {t.assumed_plan_is_annual ? "Annual" : "Monthly"}
                        </p>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {selected && (
        <TenantBillingDrawer
          tenant={selected}
          onClose={() => setSelected(null)}
          onSaved={() => {
            setSelected(null);
            load();
          }}
        />
      )}
    </>
  );
};

const TenantBillingDrawer = ({
  tenant,
  onClose,
  onSaved,
}: {
  tenant: TenantRow;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [stage, setStage] = useState<Stage | "">(tenant.billing_dunning_stage ?? "");
  const [tier, setTier] = useState<Tier | "">(normalizeLegacyTier(tenant.assumed_plan_tier as string | null));
  const [fleetSize, setFleetSize] = useState<string>(
    String(tenant.assumed_plan_fleet_size ?? 10)
  );
  const [annual, setAnnual] = useState<boolean>(tenant.assumed_plan_is_annual ?? false);
  const [message, setMessage] = useState<string>(tenant.billing_dunning_message ?? "");
  const [notes, setNotes] = useState<string>(tenant.billing_dunning_notes ?? "");

  const applyStage = async () => {
    if (!stage) {
      toast({
        title: "Pick a stage",
        description: "Choose Reminder, Notice, or Restriction.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc("set_billing_dunning_stage", {
      p_team_id: tenant.id,
      p_stage: stage,
      p_assumed_plan_tier: tier || null,
      p_assumed_plan_fleet_size: fleetSize ? Number(fleetSize) : null,
      p_assumed_plan_is_annual: annual,
      p_message: message || null,
      p_notes: notes || null,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Stage applied", description: `${tenant.name} is now at ${stage}.` });
    onSaved();
  };

  const clearStage = async () => {
    setSaving(true);
    const { error } = await supabase.rpc("clear_billing_dunning", {
      p_team_id: tenant.id,
      p_note: notes || null,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Cleared", description: `Banner removed for ${tenant.name}.` });
    onSaved();
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{tenant.name}</SheetTitle>
          <SheetDescription>
            {tenant.owner_email || "No owner email on file"}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          <div className="space-y-2">
            <Label>Dunning stage</Label>
            <Select value={stage} onValueChange={(v) => setStage(v as Stage)}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a stage…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="reminder">Reminder — soft, dismissible</SelectItem>
                <SelectItem value="notice">Notice — persistent</SelectItem>
                <SelectItem value="restriction">
                  Restriction — read-only mode
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Assumed plan (used for one-click checkout)</Label>
            <Select value={tier} onValueChange={(v) => setTier(v as Tier)}>
              <SelectTrigger>
                <SelectValue placeholder="None — tenant picks their own" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="starter">Starter</SelectItem>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="business">Business</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="fleet">Fleet size</Label>
              <Input
                id="fleet"
                type="number"
                min="1"
                value={fleetSize}
                onChange={(e) => setFleetSize(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="block">Billing cadence</Label>
              <div className="flex items-center gap-2 h-10">
                <Switch checked={annual} onCheckedChange={setAnnual} id="annual" />
                <Label htmlFor="annual" className="text-sm font-normal cursor-pointer">
                  {annual ? "Annual" : "Monthly"}
                </Label>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="msg">Banner message override (optional)</Label>
            <Textarea
              id="msg"
              placeholder="Leave blank to use the default copy for this stage."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Internal notes (not shown to tenant)</Label>
            <Textarea
              id="notes"
              placeholder="e.g. Texted Ed 5/20, said paying Friday."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <Button onClick={applyStage} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Apply stage
            </Button>
            {tenant.billing_dunning_stage && (
              <Button variant="outline" onClick={clearStage} disabled={saving}>
                Clear banner
              </Button>
            )}
          </div>

          {tenant.billing_dunning_set_at && (
            <p className="text-xs text-muted-foreground">
              Current stage set {new Date(tenant.billing_dunning_set_at).toLocaleString()}
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
