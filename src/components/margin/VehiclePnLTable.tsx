import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/contexts/TeamContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download } from "lucide-react";
import { toCsv, downloadCsv, formatCurrency, formatPercent } from "@/lib/marginCsv";

interface Row {
  vehicle_id: string;
  vehicle_name: string;
  gross_revenue: number;
  platform_fees: number;
  net_revenue: number;
  total_expenses: number;
  partner_payouts: number;
  operator_net: number;
  margin_pct: number;
  booking_count: number;
}

export function VehiclePnLTable({ start, end }: { start: Date; end: Date }) {
  const { currentTeam } = useTeam();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentTeam?.id) return;
    setLoading(true);
    (async () => {
      const { data } = await supabase.rpc("fn_vehicle_pnl", {
        p_team_id: currentTeam.id,
        p_start: start.toISOString().slice(0, 10),
        p_end: end.toISOString().slice(0, 10),
      });
      setRows(((data as any[]) || []).map((r) => ({
        ...r,
        gross_revenue: Number(r.gross_revenue),
        platform_fees: Number(r.platform_fees),
        net_revenue: Number(r.net_revenue),
        total_expenses: Number(r.total_expenses),
        partner_payouts: Number(r.partner_payouts),
        operator_net: Number(r.operator_net),
        margin_pct: Number(r.margin_pct),
      })));
      setLoading(false);
    })();
  }, [currentTeam?.id, start, end]);

  const handleExport = () => {
    const csv = toCsv(rows as any, [
      { key: "vehicle_name", label: "Vehicle" },
      { key: "booking_count", label: "Bookings" },
      { key: "gross_revenue", label: "Gross Revenue" },
      { key: "platform_fees", label: "Platform Fees" },
      { key: "net_revenue", label: "Net Revenue" },
      { key: "total_expenses", label: "Expenses" },
      { key: "partner_payouts", label: "Partner Payouts" },
      { key: "operator_net", label: "Operator Net" },
      { key: "margin_pct", label: "Margin %" },
    ]);
    downloadCsv(`vehicle-pnl-${Date.now()}.csv`, csv);
  };

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
                <TableHead>Vehicle</TableHead>
                <TableHead className="text-right">Bookings</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">Fees</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead className="text-right">Expenses</TableHead>
                <TableHead className="text-right">Payouts</TableHead>
                <TableHead className="text-right">Operator Net</TableHead>
                <TableHead className="text-right">Margin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No vehicle activity in this period.</TableCell></TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.vehicle_id}>
                    <TableCell className="font-medium">{r.vehicle_name}</TableCell>
                    <TableCell className="text-right">{r.booking_count}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.gross_revenue)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatCurrency(r.platform_fees)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.net_revenue)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatCurrency(r.total_expenses)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatCurrency(r.partner_payouts)}</TableCell>
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
