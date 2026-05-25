import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/contexts/TeamContext";
import { formatCurrency, formatPercent } from "@/lib/marginCsv";
import { TrendingUp, Receipt, Users, Percent, DollarSign, Wallet } from "lucide-react";

interface Totals {
  gross: number;
  fees: number;
  net: number;
  expenses: number;
  payouts: number;
  operatorNet: number;
  marginPct: number;
}

export function MarginOverview({ start, end }: { start: Date; end: Date }) {
  const { currentTeam } = useTeam();
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentTeam?.id) return;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase.rpc("fn_vehicle_pnl", {
        p_team_id: currentTeam.id,
        p_start: start.toISOString().slice(0, 10),
        p_end: end.toISOString().slice(0, 10),
      });
      if (error || !data) {
        setTotals({ gross: 0, fees: 0, net: 0, expenses: 0, payouts: 0, operatorNet: 0, marginPct: 0 });
        setLoading(false);
        return;
      }
      const t = (data as any[]).reduce(
        (acc, r) => {
          acc.gross += Number(r.gross_revenue || 0);
          acc.fees += Number(r.platform_fees || 0);
          acc.expenses += Number(r.total_expenses || 0);
          acc.payouts += Number(r.partner_payouts || 0);
          return acc;
        },
        { gross: 0, fees: 0, expenses: 0, payouts: 0 }
      );
      const net = t.gross - t.fees;
      const operatorNet = net - t.expenses - t.payouts;
      const marginPct = t.gross > 0 ? (operatorNet / t.gross) * 100 : 0;
      setTotals({ ...t, net, operatorNet, marginPct });
      setLoading(false);
    })();
  }, [currentTeam?.id, start, end]);

  const cards = [
    { label: "Gross Revenue", value: formatCurrency(totals?.gross), icon: DollarSign },
    { label: "Platform Fees", value: formatCurrency(totals?.fees), icon: Receipt, muted: true },
    { label: "Net Revenue", value: formatCurrency(totals?.net), icon: TrendingUp },
    { label: "Expenses", value: formatCurrency(totals?.expenses), icon: Wallet, muted: true },
    { label: "Partner Payouts", value: formatCurrency(totals?.payouts), icon: Users, muted: true },
    { label: "Operator Net", value: formatCurrency(totals?.operatorNet), icon: DollarSign, highlight: true },
    { label: "Margin %", value: formatPercent(totals?.marginPct), icon: Percent, highlight: true },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
      {cards.map((c) => (
        <Card key={c.label} className={c.highlight ? "border-primary/40" : ""}>
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{c.label}</span>
              <c.icon className="h-3.5 w-3.5" />
            </div>
            <div className={`text-lg font-semibold ${c.muted ? "text-muted-foreground" : ""}`}>
              {loading ? "…" : c.value}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
