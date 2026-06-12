import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
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
import { Save, DollarSign, Car, Loader2, Info, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
}

interface EditingRates {
  rate_3hr: string;
  rate_6hr: string;
  current_rate: string;
  rate_multiday: string;
}

export const RateTiersPanel = () => {
  const { vehicles, updateVehicle } = useLocationFilteredFleet();
  const { currentTeam } = useTeam();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingRates, setEditingRates] = useState<EditingRates>({
    rate_3hr: "",
    rate_6hr: "",
    current_rate: "",
    rate_multiday: "",
  });
  const [saving, setSaving] = useState(false);

  const minRate = (currentTeam as any)?.min_rate ?? 100;

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

    if (errors.length > 0) {
      toast.error("Validation Error", { description: errors[0] });
      return;
    }

    setSaving(true);
    try {
      const updates: Record<string, any> = {
        current_rate: parseFloat(editingRates.current_rate),
        rate_3hr: editingRates.rate_3hr ? parseFloat(editingRates.rate_3hr) : null,
        rate_6hr: editingRates.rate_6hr ? parseFloat(editingRates.rate_6hr) : null,
        rate_multiday: editingRates.rate_multiday ? parseFloat(editingRates.rate_multiday) : null,
      };

      const success = await updateVehicle(vehicleId, updates);
      if (success) {
        toast("Rates updated", { description: "Vehicle rates saved successfully" });
        setEditingId(null);
      }
    } catch {
      toast.error("Error", { description: "Failed to update rates" });
    } finally {
      setSaving(false);
    }
  };

  const formatRate = (rate: number | null) => {
    if (rate == null) return "—";
    return `$${rate.toLocaleString()}`;
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
          </AlertDescription>
        </Alert>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">Vehicle</TableHead>
                <TableHead className="text-right min-w-[100px]">3-Hour</TableHead>
                <TableHead className="text-right min-w-[100px]">6-Hour</TableHead>
                <TableHead className="text-right min-w-[100px]">Daily (24hr)</TableHead>
                <TableHead className="text-right min-w-[100px]">Multi-Day</TableHead>
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
