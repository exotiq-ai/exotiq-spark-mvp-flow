import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/contexts/TeamContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, ArrowUpDown } from "lucide-react";
import { toCsv, downloadCsv, formatCurrency, formatPercent } from "@/lib/marginCsv";
import { useMarginData } from "./useMarginData";

interface Row {
  vehicle_id: string;
  vehicle_name: string;
  bookings: number;
  gross: number;
  fees: number;
  net: number;
  expenses: number;
  payouts: number;
  operator_net: number;
  margin_pct: number;
}

type SortKey = keyof Row;

export function VehiclePnLTable() {
  const { currentTeam } = useTeam();
  const navigate = useNavigate();
  const { bookings, expenses, payouts, loading } = useMarginData();
  const [vehicleNames, setVehicleNames] = useState<Record<string, string>>({});
  const [sortKey, setSortKey] = useState<SortKey>("operator_net");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    if (!currentTeam?.id) return;
    supabase.from("vehicles").select("id, make, model").eq("team_id", currentTeam.id).then(({ data }) => {
      const m: Record<string, string> = {};
      (data || []).forEach((v: any) => { m[v.id] = `${v.make} ${v.model}`; });
      setVehicleNames(m);
    });
  }, [currentTeam?.id]);

  const rows = useMemo<Row[]>(() => {
    const map = new Map<string, Row>();
    bookings
      .filter((b) => b.status !== "cancelled" && b.vehicle_id)
      .forEach((b) => {
        const id = b.vehicle_id!;
        const r =
          map.get(id) ||
          { vehicle_id: id, vehicle_name: vehicleNames[id] || "Vehicle", bookings: 0, gross: 0, fees: 0, net: 0, expenses: 0, payouts: 0, operator_net: 0, margin_pct: 0 };
        r.bookings += 1;
        r.gross += Number(b.total_value || 0);
        r.fees += Number(b.platform_fee_amount || 0);
        map.set(id, r);
      });
    expenses
      .filter((e) => e.vehicle_id)
      .forEach((e) => {
        const r = map.get(e.vehicle_id!);
        if (r) r.expenses += Number(e.amount || 0) - Number(e.reimbursed_amount || 0);
      });
    payouts
      .filter((p) => p.vehicle_id && p.status !== "voided" && p.status !== "cancelled")
      .forEach((p) => {
        const r = map.get(p.vehicle_id!);
        if (r) r.payouts += Number(p.net_to_partner || 0);
      });
    const out = Array.from(map.values()).map((r) => {
      r.net = r.gross - r.fees;
      r.operator_net = r.net - r.expenses - r.payouts;
      r.margin_pct = r.gross > 0 ? (r.operator_net / r.gross) * 100 : 0;
      return r;
    });
    const dir = sortDir === "asc" ? 1 : -1;
    out.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv) * dir;
      return (Number(av) - Number(bv)) * dir;
    });
    return out;
  }, [bookings, expenses, payouts, vehicleNames, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("desc"); }
  };

  const handleExport = () => {
    const csv = toCsv(rows as any, [
      { key: "vehicle_name", label: "Vehicle" },
      { key: "bookings", label: "Bookings" },
      { key: "gross", label: "Gross" },
      { key: "fees", label: "Platform Fees" },
      { key: "net", label: "Net" },
      { key: "expenses", label: "Expenses" },
      { key: "payouts", label: "Partner Payouts" },
      { key: "operator_net", label: "Operator Net" },
      { key: "margin_pct", label: "Margin %" },
    ]);
    downloadCsv(`vehicle-pnl-${Date.now()}.csv`, csv);
  };

  const SortHead = ({ k, children, align = "right" }: { k: SortKey; children: React.ReactNode; align?: "left" | "right" }) => (
    <TableHead className={align === "right" ? "text-right" : ""}>
      <button onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-foreground text-muted-foreground">
        {children} <ArrowUpDown className="h-3 w-3" />
      </button>
    </TableHead>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Per-Vehicle P&L</CardTitle>
        <Button size="sm" variant="outline" onClick={handleExport} disabled={!rows.length}>
          <Download className="h-4 w-4 mr-2" /> CSV
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortHead k="vehicle_name" align="left">Vehicle</SortHead>
                <SortHead k="bookings">Bookings</SortHead>
                <SortHead k="gross">Gross</SortHead>
                <SortHead k="fees">Fees</SortHead>
                <SortHead k="net">Net</SortHead>
                <SortHead k="expenses">Expenses</SortHead>
                <SortHead k="payouts">Payouts</SortHead>
                <SortHead k="operator_net">Operator Net</SortHead>
                <SortHead k="margin_pct">Margin %</SortHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No vehicle activity in this period.</TableCell></TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow
                    key={r.vehicle_id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/dashboard?module=fleet&vehicle=${r.vehicle_id}`)}
                  >
                    <TableCell className="font-medium">{r.vehicle_name}</TableCell>
                    <TableCell className="text-right">{r.bookings}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.gross)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatCurrency(r.fees)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.net)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatCurrency(r.expenses)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatCurrency(r.payouts)}</TableCell>
                    <TableCell className={`text-right font-semibold ${r.operator_net < 0 ? "text-destructive" : ""}`}>{formatCurrency(r.operator_net)}</TableCell>
                    <TableCell className={`text-right ${r.margin_pct < 0 ? "text-destructive" : ""}`}>{formatPercent(r.margin_pct)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
