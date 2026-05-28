import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/contexts/TeamContext";
import { useMarginData } from "./useMarginData";
import { useMarginFilters } from "./MarginFiltersContext";
import { formatCurrency, formatPercent } from "@/lib/marginCsv";
import { TrendingUp, TrendingDown } from "lucide-react";

interface Row {
  vehicle_id: string;
  vehicle_name: string;
  gross: number;
  net: number;
  marginPct: number;
}

export function TopBottomMarginVehicles() {
  const { currentTeam } = useTeam();
  const f = useMarginFilters();
  const { bookings, expenses, payouts } = useMarginData();
  const [vehicleNames, setVehicleNames] = useState<Record<string, string>>({});

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
        const r = map.get(id) || { vehicle_id: id, vehicle_name: vehicleNames[id] || "Vehicle", gross: 0, net: 0, marginPct: 0 };
        r.gross += Number(b.total_value || 0);
        r.net += Number(b.total_value || 0) - Number(b.platform_fee_amount || 0);
        map.set(id, r);
      });
    expenses
      .filter((e) => e.vehicle_id)
      .forEach((e) => {
        const r = map.get(e.vehicle_id!);
        if (r) r.net -= Number(e.amount || 0) - Number(e.reimbursed_amount || 0);
      });
    payouts
      .filter((p) => p.vehicle_id && (p.status === "pending" || p.status === "scheduled" || p.status === "paid"))
      .forEach((p) => {
        const r = map.get(p.vehicle_id!);
        if (r) r.net -= Number(p.net_to_partner || 0);
      });
    return Array.from(map.values())
      .map((r) => ({ ...r, marginPct: r.gross > 0 ? (r.net / r.gross) * 100 : 0 }))
      .filter((r) => r.gross > 0)
      .sort((a, b) => b.marginPct - a.marginPct);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings, expenses, payouts, vehicleNames, f.start, f.end]);

  const top = rows.slice(0, 5);
  const bottom = rows.slice(-5).reverse();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-500" /> Top 5 by Margin
          </CardTitle>
        </CardHeader>
        <CardContent>
          {top.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">No vehicle activity.</div>
          ) : (
            <RankList rows={top} />
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-destructive" /> Bottom 5 by Margin
          </CardTitle>
        </CardHeader>
        <CardContent>
          {bottom.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">No vehicle activity.</div>
          ) : (
            <RankList rows={bottom} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RankList({ rows }: { rows: Row[] }) {
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.vehicle_id} className="flex items-center justify-between text-sm border-b border-border/50 last:border-0 pb-2 last:pb-0">
          <div className="truncate flex-1 pr-2">{r.vehicle_name}</div>
          <div className="text-right tabular-nums">
            <div className={`font-semibold ${r.marginPct < 0 ? "text-destructive" : ""}`}>{formatPercent(r.marginPct)}</div>
            <div className="text-[10px] text-muted-foreground">{formatCurrency(r.gross)} gross</div>
          </div>
        </div>
      ))}
    </div>
  );
}
