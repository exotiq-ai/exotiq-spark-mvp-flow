import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/contexts/TeamContext";
import { useMarginData } from "./useMarginData";
import { useMarginFilters } from "./MarginFiltersContext";
import { formatCurrency, formatPercent } from "@/lib/marginCsv";
import { TrendingUp, TrendingDown } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

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
  const isMobile = useIsMobile();
  const [view, setView] = useState<"top" | "bottom">("top");

  useEffect(() => {
    if (!currentTeam?.id) return;
    supabase.from("vehicles").select("id, make, model").eq("team_id", currentTeam.id).then(({ data }) => {
      const m: Record<string, string> = {};
      (data || []).forEach((v: any) => { m[v.id] = `${v.make} ${v.model}`; });
      setVehicleNames(m);
    });
  }, [currentTeam?.id]);

  const { rows, allTied } = useMemo(() => {
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
    const list = Array.from(map.values())
      .map((r) => ({ ...r, marginPct: r.gross > 0 ? (r.net / r.gross) * 100 : 0 }))
      .filter((r) => r.gross > 0)
      // Sort by margin, then gross $ as a tiebreak so ties don't yield arbitrary order
      .sort((a, b) => (b.marginPct - a.marginPct) || (b.gross - a.gross));
    const tied = list.length > 1 && list.every((r) => Math.abs(r.marginPct - list[0].marginPct) < 0.01);
    return { rows: list, allTied: tied };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings, expenses, payouts, vehicleNames, f.start, f.end]);


  // When every vehicle ties (typically because no costs are recorded), rank by gross $ instead
  const displayRows = allTied ? [...rows].sort((a, b) => b.gross - a.gross) : rows;
  const rankLabel = allTied ? "by Gross" : "by Margin";
  const top = displayRows.slice(0, 5);
  const bottom = displayRows.slice(-5).reverse();


  const helperText = allTied
    ? "Log vehicle expenses to see true margin ranking."
    : null;

  if (isMobile) {
    const active = view === "top" ? top : bottom;
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">{rankLabel === "by Gross" ? "By Gross Revenue" : "By Margin"}</CardTitle>
            <div className="inline-flex rounded-lg bg-muted p-0.5">
              <button
                onClick={() => setView("top")}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-md transition-colors inline-flex items-center gap-1",
                  view === "top" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
                )}
              >
                <TrendingUp className="h-3 w-3" /> Top
              </button>
              <button
                onClick={() => setView("bottom")}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-md transition-colors inline-flex items-center gap-1",
                  view === "bottom" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
                )}
              >
                <TrendingDown className="h-3 w-3" /> Bottom
              </button>
            </div>
          </div>
          {helperText && <p className="text-[11px] text-muted-foreground">{helperText}</p>}
        </CardHeader>
        <CardContent>
          {active.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">No vehicle activity.</div>
          ) : (
            <RankList rows={active} />
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-500" /> Top 5 {rankLabel}
          </CardTitle>
          {helperText && <p className="text-[11px] text-muted-foreground">{helperText}</p>}
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
            <TrendingDown className="h-4 w-4 text-destructive" /> Bottom 5 {rankLabel}
          </CardTitle>
          {helperText
            ? <p className="text-[11px] text-muted-foreground">{helperText}</p>
            : <p className="text-[11px] text-muted-foreground">Negative margin = expenses and payouts exceed net revenue.</p>}
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
        <div key={r.vehicle_id} className="flex items-center justify-between gap-3 text-sm border-b border-border/50 last:border-0 pb-2 last:pb-0 min-w-0">
          <div className="truncate flex-1 min-w-0">{r.vehicle_name}</div>
          <div className="text-right tabular-nums shrink-0">
            <div className={`font-semibold ${r.marginPct < 0 ? "text-destructive" : ""}`}>{formatPercent(r.marginPct)}</div>
            <div className="text-[10px] text-muted-foreground">{formatCurrency(r.gross)} gross</div>
          </div>
        </div>
      ))}
    </div>
  );
}
