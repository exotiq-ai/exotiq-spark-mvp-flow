import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/contexts/TeamContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/marginCsv";

interface Row {
  booking_source: string;
  booking_count: number;
  gross_revenue: number;
  platform_fees: number;
  net_revenue: number;
}

export function RevenueBySourceCard() {
  const { currentTeam } = useTeam();
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!currentTeam?.id) return;
    (async () => {
      const { data } = await supabase
        .from("revenue_by_source" as any)
        .select("booking_source, booking_count, gross_revenue, platform_fees, net_revenue")
        .eq("team_id", currentTeam.id);
      // Aggregate across months in client
      const agg = new Map<string, Row>();
      ((data || []) as any[]).forEach((r) => {
        const existing = agg.get(r.booking_source) || {
          booking_source: r.booking_source, booking_count: 0, gross_revenue: 0, platform_fees: 0, net_revenue: 0,
        };
        existing.booking_count += Number(r.booking_count);
        existing.gross_revenue += Number(r.gross_revenue);
        existing.platform_fees += Number(r.platform_fees);
        existing.net_revenue += Number(r.net_revenue);
        agg.set(r.booking_source, existing);
      });
      setRows(Array.from(agg.values()).sort((a, b) => b.gross_revenue - a.gross_revenue));
    })();
  }, [currentTeam?.id]);

  if (!rows.length) return null;

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Revenue by Source (All-Time)</CardTitle></CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {rows.map((r) => (
            <div key={r.booking_source} className="p-3 rounded-lg border border-border">
              <div className="text-xs text-muted-foreground capitalize">{r.booking_source.replace("_", " ")}</div>
              <div className="text-lg font-semibold mt-1">{formatCurrency(r.gross_revenue)}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {r.booking_count} booking{r.booking_count === 1 ? "" : "s"} · Fee {formatCurrency(r.platform_fees)}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
