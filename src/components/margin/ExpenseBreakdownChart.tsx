import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMarginData } from "./useMarginData";
import { formatCurrency } from "@/lib/marginCsv";

export function ExpenseBreakdownChart() {
  const { expenses, loading } = useMarginData();

  const data = useMemo(() => {
    const map = new Map<string, number>();
    expenses
      .filter((e) => e.vehicle_id != null)
      .forEach((e) => {
        const net = Number(e.amount || 0) - Number(e.reimbursed_amount || 0);
        map.set(e.expense_type, (map.get(e.expense_type) || 0) + net);
      });
    const total = Array.from(map.values()).reduce((s, v) => s + v, 0);
    return {
      total,
      rows: Array.from(map.entries())
        .map(([type, amount]) => ({ type, amount, pct: total > 0 ? (amount / total) * 100 : 0 }))
        .sort((a, b) => b.amount - a.amount),
    };
  }, [expenses]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Expense Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-20 md:h-[240px] flex items-center justify-center text-sm text-muted-foreground">Loading…</div>
        ) : data.rows.length === 0 ? (
          <div className="h-20 md:h-[240px] flex items-center justify-center text-sm text-muted-foreground">No vehicle expenses in range.</div>
        ) : (
          <div className="space-y-2">
            {data.rows.slice(0, 8).map((r) => (
              <div key={r.type}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="capitalize">{r.type.replace("_", " ")}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {formatCurrency(r.amount)} · {r.pct.toFixed(0)}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${Math.min(r.pct, 100)}%` }} />
                </div>
              </div>
            ))}
            <div className="pt-2 mt-2 border-t flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Total</span>
              <span className="font-semibold">{formatCurrency(data.total)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
