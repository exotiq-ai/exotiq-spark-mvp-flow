import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Globe, Download, AlertTriangle, Shield } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/contexts/TeamContext";
import { useToast } from "@/hooks/use-toast";

interface SubProcessorRow {
  id: string;
  name: string;
  purpose: string;
  region: string;
  transfer_mechanism: string | null;
  dpa_url: string | null;
  privacy_policy_url: string | null;
  status: string;
}

interface InventoryRow {
  id: string;
  entity: string;
  field: string;
  category: string;
  description: string | null;
  lawful_basis: string;
  retention_days: number | null;
  sub_processor_names: string[];
  never_transfer: boolean;
}

const JURISDICTION_OPTIONS = [
  { value: "us", label: "United States" },
  { value: "eu", label: "European Union (EEA)" },
  { value: "uk", label: "United Kingdom" },
  { value: "uae", label: "United Arab Emirates" },
  { value: "other", label: "Other" },
];

function jurisdictionToRegion(j: string | null | undefined): "us" | "eu" {
  if (j === "eu" || j === "uk") return "eu";
  return "us";
}

export const ComplianceSection = () => {
  const { currentTeam, userRole, refreshTeam } = useTeam();
  const { toast } = useToast();
  const [subProcessors, setSubProcessors] = useState<SubProcessorRow[]>([]);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingJurisdiction, setSavingJurisdiction] = useState(false);
  const [jurisdiction, setJurisdiction] = useState<string>(
    currentTeam?.primary_jurisdiction ?? ""
  );

  const canEdit = userRole === "owner" || userRole === "admin";

  useEffect(() => {
    setJurisdiction((currentTeam as any)?.primary_jurisdiction ?? "");
  }, [currentTeam?.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [sp, inv] = await Promise.all([
        supabase
          .from("sub_processors")
          .select("id, name, purpose, region, transfer_mechanism, dpa_url, privacy_policy_url, status")
          .eq("status", "active")
          .order("name"),
        supabase
          .from("data_processing_inventory")
          .select("id, entity, field, category, description, lawful_basis, retention_days, sub_processor_names, never_transfer")
          .order("entity"),
      ]);
      if (cancelled) return;
      setSubProcessors((sp.data ?? []) as SubProcessorRow[]);
      setInventory((inv.data ?? []) as InventoryRow[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSaveJurisdiction = async () => {
    if (!canEdit || !currentTeam?.id || !jurisdiction) return;
    setSavingJurisdiction(true);
    try {
      const { error } = await supabase
        .from("teams")
        .update({
          primary_jurisdiction: jurisdiction,
          data_region: jurisdictionToRegion(jurisdiction),
          ai_data_minimization_level:
            jurisdictionToRegion(jurisdiction) === "eu" ? "strict" : "standard",
        } as any)
        .eq("id", currentTeam.id);
      if (error) throw error;
      toast({ title: "Jurisdiction saved", description: "Compliance posture updated." });
      await refreshTeam?.();
    } catch (e) {
      console.error(e);
      toast({ title: "Could not save jurisdiction", variant: "destructive" });
    } finally {
      setSavingJurisdiction(false);
    }
  };

  const handleExportRopa = () => {
    const payload = {
      exported_at: new Date().toISOString(),
      team_id: currentTeam?.id ?? null,
      team_name: currentTeam?.name ?? null,
      primary_jurisdiction: (currentTeam as any)?.primary_jurisdiction ?? null,
      data_region: (currentTeam as any)?.data_region ?? "us",
      sub_processors: subProcessors,
      data_inventory: inventory,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `exotiq-ropa-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const isEuUk = useMemo(
    () => ["eu", "uk"].includes((currentTeam as any)?.primary_jurisdiction ?? ""),
    [currentTeam]
  );

  return (
    <div className="space-y-6">
      {/* Jurisdiction */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            Operating jurisdiction
          </CardTitle>
          <CardDescription>
            Determines which privacy regime applies to your operation and which
            agreements we surface for execution.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {canEdit ? (
            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
              <Select value={jurisdiction} onValueChange={setJurisdiction}>
                <SelectTrigger className="sm:w-72">
                  <SelectValue placeholder="Select primary jurisdiction" />
                </SelectTrigger>
                <SelectContent>
                  {JURISDICTION_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handleSaveJurisdiction}
                disabled={
                  savingJurisdiction ||
                  !jurisdiction ||
                  jurisdiction === ((currentTeam as any)?.primary_jurisdiction ?? "")
                }
              >
                {savingJurisdiction && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Only an owner or admin can change the operating jurisdiction.
            </p>
          )}

          {isEuUk && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                EU/UK posture is active. Personal data sent to AI providers is
                automatically minimized; the Data Processing Agreement must be
                executed by an authorized representative; renter-facing privacy
                notices in this region are pending attorney review.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Sub-processors */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              Sub-processors
            </CardTitle>
            <CardDescription>
              Third parties that may process personal data on our behalf. This
              list is mirrored into the Data Processing Agreement.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleExportRopa} disabled={loading}>
            <Download className="h-4 w-4 mr-2" />
            Export ROPA
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {subProcessors.map((sp) => (
                <li key={sp.id} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{sp.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{sp.purpose}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {sp.region}
                        {sp.transfer_mechanism ? ` · ${sp.transfer_mechanism}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {sp.dpa_url && (
                        <a
                          href={sp.dpa_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs underline text-muted-foreground hover:text-foreground"
                        >
                          DPA
                        </a>
                      )}
                      {sp.privacy_policy_url && (
                        <a
                          href={sp.privacy_policy_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs underline text-muted-foreground hover:text-foreground"
                        >
                          Privacy
                        </a>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Data inventory */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Personal-data inventory</CardTitle>
          <CardDescription>
            Records of Processing Activity (GDPR Article 30). Use Export ROPA
            above to download the full machine-readable register.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : (
            <ul className="space-y-2 max-h-96 overflow-y-auto">
              {inventory.map((row) => (
                <li
                  key={row.id}
                  className="rounded-md border border-border/60 p-3 text-sm"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-medium">
                      {row.entity}.{row.field}
                    </span>
                    <div className="flex gap-1">
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {row.category.replace(/_/g, " ")}
                      </Badge>
                      {row.never_transfer && (
                        <Badge variant="destructive" className="text-[10px]">
                          never transfer
                        </Badge>
                      )}
                    </div>
                  </div>
                  {row.description && (
                    <p className="text-xs text-muted-foreground">{row.description}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Lawful basis: {row.lawful_basis.replace(/_/g, " ")}
                    {row.retention_days
                      ? ` · Retention ${row.retention_days} days`
                      : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ComplianceSection;
