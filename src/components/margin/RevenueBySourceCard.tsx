import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMarginData } from "./useMarginData";
import { sourceLabel } from "./MarginFiltersContext";
import { formatCurrency } from "@/lib/marginCsv";

interface Row {
  source: string;
  label: string;
  bookings: number;
  gross: number;
  fees: number;
}

export function RevenueBySourceCard() {
  const { bookings, loading } = useMarginData();

  const rows = useMemo<Row[]>(() => {
    const map = new Map<string, Row>();
    bookings
      .filter((b) => b.status !== "cancelled")
      .forEach((b) => {
        const raw = b.booking_source || "direct";
        // Normalize Drive Exotiq variants
        const key = raw === "drive_exotiq" ? "marketplace" : raw;
        const r = map.get(key) || { source: key, label: sourceLabel(key), bookings: 0, gross: 0, fees: 0 };
        r.bookings += 1;
        r.gross += Number(b.total_value || 0);
        r.fees += Number(b.platform_fee_amount || 0);
        map.set(key, r);
      });
    return Array.from(map.values()).sort((a, b) => b.gross - a.gross);
  }, [bookings]);

  const total = rows.reduce((s, r) => s + r.gross, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Revenue by Source</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">No bookings in range.</div>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => {
              const pct = total > 0 ? (r.gross / total) * 100 : 0;
              return (
                <div key={r.source}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 text-xs mb-1 min-w-0">
                    <span className="truncate font-medium">{r.label}</span>
                    <span className="text-muted-foreground tabular-nums shrink-0">
                      {formatCurrency(r.gross)} · {pct.toFixed(0)}% · {r.bookings} bk
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
