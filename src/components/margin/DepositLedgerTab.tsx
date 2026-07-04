import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/contexts/TeamContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/marginCsv";
import { useMarginFilters } from "./MarginFiltersContext";

interface DepositRow {
  booking_id: string;
  customer_name: string;
  deposit_held: number;
  security_deposit_status: string;
  start_date: string;
  end_date: string;
  booking_status: string;
}

export function DepositLedgerTab() {
  const { currentTeam } = useTeam();
  const { start, end } = useMarginFilters();
  const [rows, setRows] = useState<DepositRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentTeam?.id) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      // Overlap-based: any deposit whose booking window intersects the filter range
      const { data } = await supabase
        .from("deposit_ledger" as any)
        .select("*")
        .eq("team_id", currentTeam.id)
        .lte("start_date", end.toISOString())
        .gte("end_date", start.toISOString())
        .order("start_date", { ascending: false });
      if (cancelled) return;
      setRows((data || []) as any);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [currentTeam?.id, start, end]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Deposit Ledger</CardTitle>
        <p className="text-xs text-muted-foreground">Deposits are held funds — never counted as revenue. Returns to the customer do not affect margin. Withholdings flow to the operator only.</p>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Booking Status</TableHead>
                <TableHead>Deposit Status</TableHead>
                <TableHead className="text-right">Held Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No deposits tracked.</TableCell></TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.booking_id}>
                    <TableCell>{r.customer_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(r.start_date).toLocaleDateString()} – {new Date(r.end_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{r.booking_status}</Badge></TableCell>
                    <TableCell><Badge variant="secondary" className="capitalize">{r.security_deposit_status}</Badge></TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(r.deposit_held)}</TableCell>
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
