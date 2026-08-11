import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { useTeam } from "@/contexts/TeamContext";
import { PermissionGuard } from "@/components/common/PermissionGuard";
import { VehicleThumbnail } from "@/components/common/VehicleThumbnail";
import { EmptyState } from "@/components/common/EmptyState";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Save, DollarSign, Car, Loader2, Info, AlertCircle, Percent, Wand2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatCurrency } from "@/lib/utils";

interface VehicleRates {
  id: string;
  name: string;
  make: string;
  model: string;
  year: number;
  image_url?: string | null;
  current_rate: number;
  rate_3hr: number | null;
  rate_6hr: number | null;
  rate_multiday: number | null;
  deposit_override_cents: number | null;
}

interface EditingRates {
  rate_3hr: string;
  rate_6hr: string;
  current_rate: string;
  rate_multiday: string;
  deposit_override: string;
}

export const RateTiersPanel = () => {
  const { vehicles, updateVehicle } = useLocationFilteredFleet();
  const { currentTeam } = useTeam();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingRates, setEditingRates] = useState<EditingRates>({
    rate_3hr: "",
    rate_6hr: "",
    current_rate: "",
    rate_multiday: "",
    deposit_override: "",
  });
  const [saving, setSaving] = useState(false);

  // Bulk rate rule — derive a duration tier from each vehicle's daily rate
  const [ruleTier, setRuleTier] = useState<'rate_3hr' | 'rate_6hr' | 'rate_multiday'>('rate_multiday');
  const [rulePercent, setRulePercent] = useState('85');
  const [applyingRule, setApplyingRule] = useState(false);

  const minRate = (currentTeam as any)?.min_rate ?? 100;
  const defaultDepositCents = currentTeam?.default_deposit_cents ?? null;
  const defaultDepositDollars = defaultDepositCents != null ? defaultDepositCents / 100 : null;

  const vehicleRates: VehicleRates[] = useMemo(
    () =>
      vehicles.map((v: any) => ({
        id: v.id,
        name: v.name,
        make: v.make,
        model: v.model,
        year: v.year,
        image_url: v.image_url,
        current_rate: v.current_rate,
        rate_3hr: v.rate_3hr ?? null,
        rate_6hr: v.rate_6hr ?? null,
        rate_multiday: v.rate_multiday ?? null,
        deposit_override_cents: v.deposit_override_cents ?? null,
      })),
    [vehicles]
  );

  const startEditing = (vehicle: VehicleRates) => {
    setEditingId(vehicle.id);
    setEditingRates({
      rate_3hr: vehicle.rate_3hr?.toString() || "",
      rate_6hr: vehicle.rate_6hr?.toString() || "",
      current_rate: vehicle.current_rate.toString(),
      rate_multiday: vehicle.rate_multiday?.toString() || "",
      deposit_override:
        vehicle.deposit_override_cents != null
          ? String(Math.round(vehicle.deposit_override_cents / 100))
          : "",
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  const validateRate = (value: string, label: string): string | null => {
    if (!value) return null; // empty = clear the tier
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) return `${label} must be a positive number`;
    if (num < minRate) return `${label} must be at least $${minRate}`;
    return null;
  };

  const handleSave = async (vehicleId: string) => {
    // Validate all non-empty rates
    const errors: string[] = [];
    const check = (val: string, label: string) => {
      const err = validateRate(val, label);
      if (err) errors.push(err);
    };

    check(editingRates.current_rate, "Daily (24hr) rate");
    check(editingRates.rate_3hr, "3-Hour rate");
    check(editingRates.rate_6hr, "6-Hour rate");
    check(editingRates.rate_multiday, "Multi-day rate");

    // Daily rate is required
    if (!editingRates.current_rate) {
      errors.push("Daily (24hr) rate is required");
    }

    // Deposit override — non-negative if provided
    let depositOverrideCents: number | null = null;
    if (editingRates.deposit_override.trim() !== "") {
      const dep = parseFloat(editingRates.deposit_override);
      if (!isFinite(dep) || dep < 0) {
        errors.push("Deposit hold must be zero or greater");
      } else {
        depositOverrideCents = Math.round(dep * 100);
      }
    }

    if (errors.length > 0) {
      toast({
        title: "Validation Error",
        description: errors[0],
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const updates: Record<string, any> = {
        current_rate: parseFloat(editingRates.current_rate),
        rate_3hr: editingRates.rate_3hr ? parseFloat(editingRates.rate_3hr) : null,
        rate_6hr: editingRates.rate_6hr ? parseFloat(editingRates.rate_6hr) : null,
        rate_multiday: editingRates.rate_multiday ? parseFloat(editingRates.rate_multiday) : null,
        deposit_override_cents: depositOverrideCents,
      };

      const success = await updateVehicle(vehicleId, updates);
      if (success) {
        toast({ title: "Rates updated", description: "Vehicle rates saved successfully" });
        setEditingId(null);
      }
    } catch {
      toast({ title: "Error", description: "Failed to update rates", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const TIER_LABELS: Record<string, string> = {
    rate_3hr: '3-Hour',
    rate_6hr: '6-Hour',
    rate_multiday: 'Multi-Day (per day)',
  };

  const applyRateRule = async () => {
    const pct = parseFloat(rulePercent);
    if (!Number.isFinite(pct) || pct <= 0 || pct > 300) {
      toast({ title: 'Invalid percentage', description: 'Enter a percentage between 1 and 300', variant: 'destructive' });
      return;
    }

    setApplyingRule(true);
    try {
      let updated = 0;
      let skipped = 0;
      for (const vehicle of vehicleRates) {
        const daily = Number(vehicle.current_rate);
        if (!Number.isFinite(daily) || daily <= 0) { skipped++; continue; }
        const next = Math.round((daily * pct) / 100);
        // Never write a tier below the tenant's rate floor
        if (next < minRate) { skipped++; continue; }
        const ok = await updateVehicle(vehicle.id, { [ruleTier]: next } as any);
        if (ok) updated++; else skipped++;
      }
      toast({
        title: 'Rate rule applied',
        description: `${TIER_LABELS[ruleTier]} set on ${updated} vehicle${updated === 1 ? '' : 's'}` +
          (skipped > 0 ? ` · ${skipped} skipped (below the $${minRate} floor or missing a daily rate)` : ''),
      });
    } catch {
      toast({ title: 'Error', description: 'Could not apply the rate rule', variant: 'destructive' });
    } finally {
      setApplyingRule(false);
    }
  };

  const formatRate = (rate: number | null) => {
    if (rate == null) return "—";
    return formatCurrency(rate);
  };

  if (vehicles.length === 0) {
    return (
      <EmptyState
        icon={<Car className="h-16 w-16" />}
        title="No vehicles to configure"
        description="Add vehicles to your fleet to set up rate tiers."
      />
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary" />
              Rate Tiers
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Set pricing per duration tier for each vehicle. Leave blank to disable a tier.
            </p>
          </div>
          <Badge variant="outline" className="hidden sm:flex">
            Min rate: ${minRate}
          </Badge>
        </div>

        <Alert className="mb-4">
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Daily (24hr)</strong> is the primary rate used across the system.
            3-Hour and 6-Hour are flat rates. Multi-day is a per-day rate for 2+ day rentals.
            <strong> Pickup deposit</strong> overrides the tenant default
            {defaultDepositDollars != null ? ` (${formatCurrency(defaultDepositDollars)})` : " ($1,000 fallback)"}
            for this vehicle. Reference only — Exotiq does not collect this; you settle it with the renter at pickup. Leave blank to use the default.
          </AlertDescription>
        </Alert>

        {/* Bulk rate rule */}
        <PermissionGuard minRole="manager" fallback={null}>
          <div className="mb-4 rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Wand2 className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-semibold">Set a tier across the whole fleet</h4>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Each vehicle's tier is calculated from its own daily rate — no need to price them one by one.
              Anything landing below your ${minRate} floor is skipped.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="space-y-1 flex-1 min-w-0">
                <Label className="text-xs">Tier</Label>
                <Select value={ruleTier} onValueChange={(v) => setRuleTier(v as typeof ruleTier)}>
                  <SelectTrigger data-testid="rate-rule-tier"><SelectValue /></SelectTrigger>
                  <SelectContent className="z-[60] bg-popover">
                    <SelectItem value="rate_3hr">3-Hour</SelectItem>
                    <SelectItem value="rate_6hr">6-Hour</SelectItem>
                    <SelectItem value="rate_multiday">Multi-Day (per day)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 sm:w-40">
                <Label className="text-xs">% of daily rate</Label>
                <div className="relative">
                  <Input
                    type="number"
                    min="1"
                    max="300"
                    value={rulePercent}
                    onChange={(e) => setRulePercent(e.target.value)}
                    onWheel={(e) => e.currentTarget.blur()}
                    className="pr-8"
                    data-testid="rate-rule-percent"
                  />
                  <Percent className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
              <Button
                variant="outline"
                onClick={applyRateRule}
                disabled={applyingRule}
                className="w-full sm:w-auto"
                data-testid="rate-rule-apply"
              >
                {applyingRule ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
                Apply to {vehicleRates.length} vehicle{vehicleRates.length === 1 ? '' : 's'}
              </Button>
            </div>
          </div>
        </PermissionGuard>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">Vehicle</TableHead>
                <TableHead className="text-right min-w-[100px]">3-Hour</TableHead>
                <TableHead className="text-right min-w-[100px]">6-Hour</TableHead>
                <TableHead className="text-right min-w-[100px]">Daily (24hr)</TableHead>
                <TableHead className="text-right min-w-[100px]">Multi-Day</TableHead>
                <TableHead className="text-right min-w-[120px]">Pickup Deposit</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vehicleRates.map((vehicle) => {
                const isEditing = editingId === vehicle.id;

                return (
                  <TableRow key={vehicle.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <VehicleThumbnail
                          vehicleName={vehicle.name}
                          imageUrl={vehicle.image_url}
                          size="sm"
                        />
                        <div>
                          <p className="font-medium text-sm">{vehicle.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {vehicle.year} {vehicle.make} {vehicle.model}
                          </p>
                        </div>
                      </div>
                    </TableCell>

                    {isEditing ? (
                      <>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            value={editingRates.rate_3hr}
                            onChange={(e) =>
                              setEditingRates((prev) => ({
                                ...prev,
                                rate_3hr: e.target.value,
                              }))
                            }
                            placeholder="—"
                            className="w-24 ml-auto text-right"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            value={editingRates.rate_6hr}
                            onChange={(e) =>
                              setEditingRates((prev) => ({
                                ...prev,
                                rate_6hr: e.target.value,
                              }))
                            }
                            placeholder="—"
                            className="w-24 ml-auto text-right"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            value={editingRates.current_rate}
                            onChange={(e) =>
                              setEditingRates((prev) => ({
                                ...prev,
                                current_rate: e.target.value,
                              }))
                            }
                            className="w-24 ml-auto text-right"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            value={editingRates.rate_multiday}
                            onChange={(e) =>
                              setEditingRates((prev) => ({
                                ...prev,
                                rate_multiday: e.target.value,
                              }))
                            }
                            placeholder="—"
                            className="w-24 ml-auto text-right"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            value={editingRates.deposit_override}
                            onChange={(e) =>
                              setEditingRates((prev) => ({
                                ...prev,
                                deposit_override: e.target.value,
                              }))
                            }
                            placeholder={
                              defaultDepositDollars != null
                                ? `Default ${Math.round(defaultDepositDollars)}`
                                : "Default"
                            }
                            className="w-28 ml-auto text-right"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              onClick={() => handleSave(vehicle.id)}
                              disabled={saving}
                            >
                              {saving ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Save className="w-3 h-3" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={cancelEditing}
                            >
                              ✕
                            </Button>
                          </div>
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className="text-right font-mono text-sm">
                          {formatRate(vehicle.rate_3hr)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatRate(vehicle.rate_6hr)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm font-semibold">
                          {formatRate(vehicle.current_rate)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatRate(vehicle.rate_multiday)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {vehicle.deposit_override_cents != null ? (
                            formatCurrency(vehicle.deposit_override_cents / 100)
                          ) : (
                            <span className="text-muted-foreground">
                              {defaultDepositDollars != null
                                ? `Default (${formatCurrency(defaultDepositDollars)})`
                                : "Default"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <PermissionGuard minRole="manager" fallback={null}>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => startEditing(vehicle)}
                            >
                              Edit
                            </Button>
                          </PermissionGuard>
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
};
