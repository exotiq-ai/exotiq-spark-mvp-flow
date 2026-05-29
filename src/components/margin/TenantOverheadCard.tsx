import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMarginData } from "./useMarginData";
import { formatCurrency } from "@/lib/marginCsv";
import { Building2 } from "lucide-react";

export function TenantOverheadCard() {
  const { expenses, loading } = useMarginData();

  const data = useMemo(() => {
    const overhead = expenses.filter((e) => e.vehicle_id == null);
    const total = overhead.reduce((s, e) => s + Number(e.amount || 0) - Number(e.reimbursed_amount || 0), 0);
    const byType = new Map<string, number>();
    overhead.forEach((e) => {
      const net = Number(e.amount || 0) - Number(e.reimbursed_amount || 0);
      byType.set(e.expense_type, (byType.get(e.expense_type) || 0) + net);
    });
    return {
      total,
      rows: Array.from(byType.entries()).map(([type, amount]) => ({ type, amount })).sort((a, b) => b.amount - a.amount),
    };
  }, [expenses]);

  if (!loading && data.rows.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" /> Tenant Overhead
        </CardTitle>
        <p className="text-xs text-muted-foreground hidden md:block">Not allocated to vehicles — shown separately to keep per-vehicle P&L clean.</p>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline justify-between gap-2 mb-3 min-w-0">
          <span className="text-xs text-muted-foreground shrink-0">Total in range</span>
          <span className="text-xl md:text-2xl font-semibold tabular-nums truncate">{formatCurrency(data.total)}</span>
        </div>
        <div className="space-y-1.5">
          {data.rows.map((r) => (
            <div key={r.type} className="flex items-center justify-between gap-2 text-xs min-w-0">
              <span className="capitalize text-muted-foreground truncate">{r.type.replace("_", " ")}</span>
              <span className="tabular-nums shrink-0">{formatCurrency(r.amount)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
