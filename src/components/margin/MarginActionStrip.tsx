import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/contexts/TeamContext";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, ChevronRight, Clock, ReceiptText, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/marginCsv";
import { useMarginData, sumPendingPayouts } from "./useMarginData";

interface Props {
  onNavigate: (tab: "review" | "payouts" | "deposits") => void;
}

/**
 * Surfaces "what needs your attention" for the margin module.
 * Rendered above the KPI hero — the reason a user opens Margin belongs at the top.
 * Hidden entirely when there is nothing to do (no false urgency).
 */
export function MarginActionStrip({ onNavigate }: Props) {
  const { currentTeam } = useTeam();
  const { payouts } = useMarginData();
  const [reviewCount, setReviewCount] = useState(0);
  const [staleDeposits, setStaleDeposits] = useState(0);

  useEffect(() => {
    if (!currentTeam?.id) {
      setReviewCount(0);
      setStaleDeposits(0);
      return;
    }
    let cancelled = false;
    (async () => {
      const [reviewRes, depRes] = await Promise.all([
        supabase
          .from("vehicle_expenses")
          .select("id", { count: "exact", head: true })
          .eq("team_id", currentTeam.id)
          .eq("status", "pending_review"),
        supabase
          .from("payments")
          .select("id, transaction_date, payment_status, payment_type", { count: "exact", head: false })
          .eq("team_id", currentTeam.id)
          .eq("payment_type", "deposit")
          .eq("payment_status", "held")
          .lte("transaction_date", new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()),
      ]);
      if (cancelled) return;
      setReviewCount(reviewRes.count || 0);
      setStaleDeposits(depRes.count || 0);
    })();
    return () => { cancelled = true; };
  }, [currentTeam?.id]);

  const pendingPayoutTotal = sumPendingPayouts(payouts);
  const pendingPayoutCount = payouts.filter(
    (p) => p.status === "pending" || p.status === "scheduled",
  ).length;

  const items: {
    key: string;
    icon: any;
    label: string;
    detail: string;
    tone: "warn" | "info";
    tab: "review" | "payouts" | "deposits";
  }[] = [];

  if (reviewCount > 0) {
    items.push({
      key: "review",
      icon: ReceiptText,
      label: `${reviewCount} ${reviewCount === 1 ? "expense" : "expenses"} awaiting review`,
      detail: "Match to vehicle or booking",
      tone: "warn",
      tab: "review",
    });
  }
  if (pendingPayoutTotal > 0) {
    items.push({
      key: "payouts",
      icon: Users,
      label: `${formatCurrency(pendingPayoutTotal)} in partner payouts`,
      detail: `${pendingPayoutCount} pending`,
      tone: "info",
      tab: "payouts",
    });
  }
  if (staleDeposits > 0) {
    items.push({
      key: "deposits",
      icon: Clock,
      label: `${staleDeposits} ${staleDeposits === 1 ? "deposit" : "deposits"} held over 7 days`,
      detail: "Release or apply",
      tone: "warn",
      tab: "deposits",
    });
  }

  if (items.length === 0) return null;

  return (
    <Card className="border-amber-500/30 bg-amber-500/[0.03]">
      <CardContent className="p-3 md:p-4">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-xs font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400">
            Needs your attention
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {items.map((it) => (
            <button
              key={it.key}
              onClick={() => onNavigate(it.tab)}
              className={cn(
                "group flex items-center gap-3 rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-left transition hover:border-primary/40 hover:bg-background",
              )}
            >
              <span
                className={cn(
                  "shrink-0 grid place-items-center h-8 w-8 rounded-md",
                  it.tone === "warn"
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    : "bg-primary/10 text-primary",
                )}
              >
                <it.icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{it.label}</div>
                <div className="text-[11px] text-muted-foreground truncate">{it.detail}</div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 transition group-hover:translate-x-0.5 group-hover:text-foreground" />
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
