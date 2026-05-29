import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/contexts/TeamContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pause, Play, Pencil, Trash2, Repeat } from "lucide-react";
import { formatCurrency } from "@/lib/marginCsv";
import { RecurringTemplateDialog } from "./RecurringTemplateDialog";
import { toast } from "sonner";

type Template = {
  id: string;
  name: string;
  expense_type: string;
  amount: number;
  vendor: string | null;
  notes: string | null;
  cadence: "monthly" | "quarterly" | "annual";
  day_of_month: number;
  next_run_at: string;
  last_run_at: string | null;
  vehicle_id: string | null;
  is_active: boolean;
};

export function RecurringTemplatesTab() {
  const { currentTeam } = useTeam();
  const [rows, setRows] = useState<Template[]>([]);
  const [vehicleMap, setVehicleMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);

  const refresh = useCallback(async () => {
    if (!currentTeam?.id) return;
    setLoading(true);
    const [{ data: tpls }, { data: vehs }] = await Promise.all([
      supabase
        .from("recurring_expense_templates")
        .select("*")
        .eq("team_id", currentTeam.id)
        .order("created_at", { ascending: false }),
      supabase.from("vehicles").select("id, make, model").eq("team_id", currentTeam.id),
    ]);
    setRows((tpls || []) as any);
    const m: Record<string, string> = {};
    (vehs || []).forEach((v: any) => (m[v.id] = `${v.make} ${v.model}`));
    setVehicleMap(m);
    setLoading(false);
  }, [currentTeam?.id]);

  useEffect(() => { refresh(); }, [refresh]);

  const togglePause = async (t: Template) => {
    const { error } = await supabase
      .from("recurring_expense_templates")
      .update({ is_active: !t.is_active })
      .eq("id", t.id);
    if (error) return toast.error(error.message);
    toast.success(t.is_active ? "Paused" : "Resumed");
    refresh();
  };

  const remove = async (t: Template) => {
    if (!confirm(`Delete "${t.name}"? This won't remove past expenses, only stop future ones.`)) return;
    const { error } = await supabase.from("recurring_expense_templates").delete().eq("id", t.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    refresh();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Repeat className="h-4 w-4" /> Recurring Expenses
          </CardTitle>
          <CardDescription className="text-xs">
            Templates that auto-create a pending expense on schedule (insurance, garage, subscriptions). You always confirm before they hit P&amp;L.
          </CardDescription>
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> New Template
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Cadence</TableHead>
                <TableHead>Next run</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  No recurring templates yet. Create one for insurance, storage, subscriptions, etc.
                </TableCell></TableRow>
              ) : (
                rows.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{t.expense_type.replace("_", " ")}</Badge></TableCell>
                    <TableCell>{t.vehicle_id ? vehicleMap[t.vehicle_id] || "—" : <span className="text-muted-foreground">Overhead</span>}</TableCell>
                    <TableCell className="capitalize">{t.cadence}</TableCell>
                    <TableCell>{new Date(t.next_run_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(t.amount)}</TableCell>
                    <TableCell>
                      {t.is_active
                        ? <Badge variant="secondary" className="text-xs">Active</Badge>
                        : <Badge variant="outline" className="text-xs">Paused</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => togglePause(t)} title={t.is_active ? "Pause" : "Resume"}>
                          {t.is_active ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => { setEditing(t); setOpen(true); }} title="Edit">
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => remove(t)} title="Delete">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      <RecurringTemplateDialog open={open} onOpenChange={setOpen} onSaved={refresh} initial={editing as any} />
    </Card>
  );
}
