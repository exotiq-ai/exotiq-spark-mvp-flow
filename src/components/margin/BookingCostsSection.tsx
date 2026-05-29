import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/marginCsv";
import { Badge } from "@/components/ui/badge";
import { Receipt, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";

type BookingExpense = {
  id: string;
  expense_type: string;
  amount: number;
  expense_date: string;
  vendor: string | null;
  source_module: string;
  status: string;
};

export function BookingCostsSection({ bookingId }: { bookingId: string }) {
  const [rows, setRows] = useState<BookingExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!bookingId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("vehicle_expenses")
        .select("id, expense_type, amount, expense_date, vendor, source_module, status")
        .eq("booking_id", bookingId)
        .order("expense_date", { ascending: false });
      if (!cancelled) {
        setRows((data || []) as any);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [bookingId]);

  const approved = rows.filter((r) => r.status === "confirmed");
  const total = approved.reduce((s, r) => s + Number(r.amount), 0);
  const pending = rows.filter((r) => r.status === "pending_review").length;

  return (
    <div className="space-y-3">
      <h4 className="font-semibold flex items-center gap-2">
        <Receipt className="h-4 w-4" />
        Costs
        {pending > 0 && (
          <Badge variant="outline" className="text-xs">{pending} pending review</Badge>
        )}
      </h4>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No expenses linked to this rental yet.</p>
      ) : (
        <>
          <div className="space-y-2">
            {rows.map((r) => (
              <div
                key={r.id}
                className="p-3 bg-muted/20 rounded-lg flex items-center justify-between cursor-pointer hover:bg-muted/40 transition-colors"
                onClick={() => navigate(`/dashboard/margin?tab=expenses&highlight=${r.id}`)}
              >
                <div className="min-w-0">
                  <div className="font-medium text-sm capitalize flex items-center gap-2">
                    {r.expense_type.replace("_", " ")}
                    {r.status === "pending_review" && (
                      <Badge variant="secondary" className="text-[10px]">Pending</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {new Date(r.expense_date).toLocaleDateString()}
                    {r.vendor && ` · ${r.vendor}`}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-semibold">{formatCurrency(r.amount)}</div>
                  <div className="text-[10px] text-muted-foreground uppercase">{r.source_module}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-sm text-muted-foreground">Approved total</span>
            <span className="font-semibold">{formatCurrency(total)}</span>
          </div>
          <button
            type="button"
            className="text-xs text-primary hover:underline flex items-center gap-1"
            onClick={() => navigate(`/dashboard/margin?tab=expenses`)}
          >
            Open in Margin <ExternalLink className="h-3 w-3" />
          </button>
        </>
      )}
    </div>
  );
}
