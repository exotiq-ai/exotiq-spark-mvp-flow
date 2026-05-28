import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { useMarginData } from "./useMarginData";
import { useMarginFilters } from "./MarginFiltersContext";
import { differenceInDays, format, startOfWeek, startOfDay } from "date-fns";
import { formatCurrency } from "@/lib/marginCsv";

export function RevenueExpenseTrendChart() {
  const { bookings, expenses, loading } = useMarginData();
  const { start, end } = useMarginFilters();

  const data = useMemo(() => {
    const days = differenceInDays(end, start);
    const useWeekly = days > 45;
    const bucket = (d: Date) =>
      useWeekly ? startOfWeek(d, { weekStartsOn: 1 }).toISOString().slice(0, 10) : startOfDay(d).toISOString().slice(0, 10);

    const map = new Map<string, { period: string; revenue: number; expenses: number }>();
    bookings
      .filter((b) => b.status !== "cancelled")
      .forEach((b) => {
        const key = bucket(new Date(b.start_date));
        const row = map.get(key) || { period: key, revenue: 0, expenses: 0 };
        row.revenue += Number(b.total_value || 0);
        map.set(key, row);
      });
    expenses
      .filter((e) => e.vehicle_id != null)
      .forEach((e) => {
        const key = bucket(new Date(e.expense_date));
        const row = map.get(key) || { period: key, revenue: 0, expenses: 0 };
        row.expenses += Number(e.amount || 0) - Number(e.reimbursed_amount || 0);
        map.set(key, row);
      });
    return Array.from(map.values())
      .sort((a, b) => a.period.localeCompare(b.period))
      .map((r) => ({ ...r, label: format(new Date(r.period), useWeekly ? "MMM d" : "MMM d") }));
  }, [bookings, expenses, start, end]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Revenue vs Expenses</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground">Loading…</div>
        ) : data.length === 0 ? (
          <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground">No activity in range.</div>
        ) : (
          <div className="h-[240px] w-full">
            <ResponsiveContainer>
              <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="exp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => formatCurrency(v)}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="hsl(var(--primary))" fill="url(#rev)" strokeWidth={2} />
                <Area type="monotone" dataKey="expenses" name="Expenses" stroke="hsl(var(--destructive))" fill="url(#exp)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
