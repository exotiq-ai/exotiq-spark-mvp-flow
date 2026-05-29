import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/contexts/TeamContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AddExpenseDialog } from "@/components/margin/AddExpenseDialog";
import { RecurringTemplatesTab } from "@/components/margin/RecurringTemplatesTab";
import { formatCurrency } from "@/lib/marginCsv";
import { useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";

interface Expense {
  id: string;
  expense_type: string;
  amount: number;
  expense_date: string;
  vendor: string | null;
  notes: string | null;
  vehicle_id: string | null;
  source_module: string;
}

import { useMarginFilters } from "./MarginFiltersContext";

export function ExpensesTab() {
  const { start, end } = useMarginFilters();
  const { currentTeam } = useTeam();
  const [rows, setRows] = useState<Expense[]>([]);
  const [vehicleMap, setVehicleMap] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const highlight = searchParams.get("highlight");
  const highlightRowRef = useRef<HTMLTableRowElement | null>(null);

  const refresh = async () => {
    if (!currentTeam?.id) return;
    setLoading(true);
    const [{ data: exps }, { data: vehs }] = await Promise.all([
      supabase
        .from("vehicle_expenses")
        .select("id, expense_type, amount, expense_date, vendor, notes, vehicle_id, source_module")
        .eq("team_id", currentTeam.id)
        .gte("expense_date", start.toISOString().slice(0, 10))
        .lte("expense_date", end.toISOString().slice(0, 10))
        .order("expense_date", { ascending: false }),
      supabase.from("vehicles").select("id, make, model").eq("team_id", currentTeam.id),
    ]);
    setRows((exps || []) as any);
    const map: Record<string, string> = {};
    (vehs || []).forEach((v: any) => (map[v.id] = `${v.make} ${v.model}`));
    setVehicleMap(map);
    setLoading(false);
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [currentTeam?.id, start, end]);

  // Scroll highlighted row into view + clear param after a moment
  useEffect(() => {
    if (!highlight || loading) return;
    const t = setTimeout(() => {
      highlightRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
    const clearT = setTimeout(() => {
      setSearchParams((sp) => { sp.delete("highlight"); return sp; }, { replace: true });
    }, 4000);
    return () => { clearTimeout(t); clearTimeout(clearT); };
  }, [highlight, loading, setSearchParams]);

  const tab = searchParams.get("subtab") || "expenses";

  return (
    <Tabs value={tab} onValueChange={(v) => setSearchParams((sp) => { sp.set("subtab", v); return sp; }, { replace: true })}>
      <TabsList>
        <TabsTrigger value="expenses">Expenses</TabsTrigger>
        <TabsTrigger value="recurring">Recurring</TabsTrigger>
      </TabsList>

      <TabsContent value="expenses" className="mt-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Expenses</CardTitle>
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Add Expense
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No expenses in this period.</TableCell></TableRow>
                  ) : (
                    rows.map((r) => {
                      const isHighlight = r.id === highlight;
                      return (
                        <TableRow
                          key={r.id}
                          ref={isHighlight ? highlightRowRef : undefined}
                          className={cn(isHighlight && "bg-primary/10 ring-2 ring-primary/40 transition-all")}
                        >
                          <TableCell>{new Date(r.expense_date).toLocaleDateString()}</TableCell>
                          <TableCell><Badge variant="outline" className="capitalize">{r.expense_type.replace("_", " ")}</Badge></TableCell>
                          <TableCell>{r.vehicle_id ? vehicleMap[r.vehicle_id] || "—" : <span className="text-muted-foreground">Overhead</span>}</TableCell>
                          <TableCell>{r.vendor || "—"}</TableCell>
                          <TableCell><Badge variant="secondary" className="text-xs">{r.source_module}</Badge></TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(r.amount)}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
          <AddExpenseDialog open={open} onOpenChange={setOpen} onCreated={refresh} />
        </Card>
      </TabsContent>

      <TabsContent value="recurring" className="mt-3">
        <RecurringTemplatesTab />
      </TabsContent>
    </Tabs>
  );
}
