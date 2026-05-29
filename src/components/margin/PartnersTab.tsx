import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/contexts/TeamContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, PowerOff } from "lucide-react";
import { usePartners, type VehiclePartner } from "@/hooks/usePartners";
import { PartnerDialog } from "./PartnerDialog";
import { PartnerStatementDrawer } from "./PartnerStatementDrawer";
import { formatCurrency } from "@/lib/marginCsv";
import { toast } from "sonner";

interface PartnerStats {
  activeVehicles: number;
  lifetimePaid: number;
  outstanding: number;
}

export function PartnersTab() {
  const { partners, loading, deactivate } = usePartners();
  const { currentTeam } = useTeam();
  const [stats, setStats] = useState<Record<string, PartnerStats>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<VehiclePartner | null>(null);
  const [statementOpen, setStatementOpen] = useState(false);
  const [statementPartner, setStatementPartner] = useState<VehiclePartner | null>(null);

  useEffect(() => {
    if (!currentTeam?.id) return;
    (async () => {
      const [{ data: vehs }, { data: payouts }] = await Promise.all([
        supabase.from("vehicles").select("id, partner_id").eq("team_id", currentTeam.id),
        supabase
          .from("partner_payouts")
          .select("partner_id, net_to_partner, status")
          .eq("team_id", currentTeam.id),
      ]);
      const m: Record<string, PartnerStats> = {};
      (vehs || []).forEach((v: any) => {
        if (!v.partner_id) return;
        m[v.partner_id] = m[v.partner_id] || { activeVehicles: 0, lifetimePaid: 0, outstanding: 0 };
        m[v.partner_id].activeVehicles += 1;
      });
      (payouts || []).forEach((p: any) => {
        m[p.partner_id] = m[p.partner_id] || { activeVehicles: 0, lifetimePaid: 0, outstanding: 0 };
        const amt = Number(p.net_to_partner) || 0;
        if (p.status === "paid") m[p.partner_id].lifetimePaid += amt;
        else if (p.status === "pending" || p.status === "scheduled") m[p.partner_id].outstanding += amt;
      });
      setStats(m);
    })();
  }, [currentTeam?.id, partners]);

  const sorted = useMemo(
    () => [...partners].sort((a, b) => Number(b.is_active) - Number(a.is_active) || a.name.localeCompare(b.name)),
    [partners]
  );

  const handleDeactivate = async (p: VehiclePartner) => {
    if (!confirm(`Deactivate ${p.name}? Vehicles assigned to them will keep their assignment but future payouts won't be auto-generated.`)) return;
    try {
      await deactivate(p.id);
      toast.success("Partner deactivated");
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Vehicle Partners</CardTitle>
          <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> New Partner
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Payout Method</TableHead>
                  <TableHead className="text-right">Vehicles</TableHead>
                  <TableHead className="text-right">Lifetime Paid</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
                ) : sorted.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No partners yet. Add one to start tracking vehicle splits.</TableCell></TableRow>
                ) : (
                  sorted.map((p) => {
                    const s = stats[p.id] || { activeVehicles: 0, lifetimePaid: 0, outstanding: 0 };
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {p.email || p.phone || "—"}
                        </TableCell>
                        <TableCell className="text-sm capitalize">{p.payout_method?.replace("_", " ") || "—"}</TableCell>
                        <TableCell className="text-right">{s.activeVehicles}</TableCell>
                        <TableCell className="text-right">{formatCurrency(s.lifetimePaid)}</TableCell>
                        <TableCell className="text-right text-amber-700 dark:text-amber-400">{formatCurrency(s.outstanding)}</TableCell>
                        <TableCell>
                          {p.is_active ? (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">Active</Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button size="sm" variant="ghost" onClick={() => { setEditing(p); setDialogOpen(true); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {p.is_active && (
                            <Button size="sm" variant="ghost" onClick={() => handleDeactivate(p)}>
                              <PowerOff className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <PartnerDialog open={dialogOpen} onOpenChange={setDialogOpen} partner={editing} />
    </>
  );
}
