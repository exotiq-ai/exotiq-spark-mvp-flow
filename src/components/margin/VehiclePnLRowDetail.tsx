import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Download } from "lucide-react";
import { formatCurrency, formatPercent, toCsv, downloadCsv } from "@/lib/marginCsv";
import { moduleIdToPath } from "@/lib/moduleRoutes";
import { useModuleNavigation } from "@/hooks/useModuleNavigation";
import { cn } from "@/lib/utils";
import type { FilteredBooking, FilteredExpense, FilteredPayout } from "./useMarginData";
import { countsForRevenue } from "./useMarginData";

interface Props {
  vehicleId: string;
  vehicleName: string;
  bookings: FilteredBooking[];
  expenses: FilteredExpense[];
  payouts: FilteredPayout[];
  totals: {
    gross: number;
    net: number;
    operator_net: number;
    margin_pct: number;
  };
}

const fmtDate = (d: string | null | undefined) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" });
  } catch {
    return "—";
  }
};

const sourceLabel = (s: string | null) => {
  const v = (s || "direct").toLowerCase();
  if (v === "drive_exotiq" || v === "marketplace") return "Marketplace";
  if (v === "direct") return "Direct";
  return s || "Direct";
};

const statusTone: Record<string, string> = {
  paid: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  scheduled: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  voided: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
};

export function VehiclePnLRowDetail({
  vehicleId,
  vehicleName,
  bookings,
  expenses,
  payouts,
  totals,
}: Props) {
  const navigate = useNavigate();
  const { goToBookingDetails } = useModuleNavigation();

  const vBookings = useMemo(
    () =>
      bookings
        .filter((b) => b.vehicle_id === vehicleId && countsForRevenue(b.status))
        .sort((a, b) => (b.start_date || "").localeCompare(a.start_date || "")),
    [bookings, vehicleId],
  );
  const vExpenses = useMemo(
    () =>
      expenses
        .filter((e) => e.vehicle_id === vehicleId)
        .sort((a, b) => (b.expense_date || "").localeCompare(a.expense_date || "")),
    [expenses, vehicleId],
  );
  const vPayouts = useMemo(
    () =>
      payouts
        .filter((p) => p.vehicle_id === vehicleId && p.status !== "voided" && p.status !== "cancelled")
        .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "")),
    [payouts, vehicleId],
  );

  const openInFleet = () => navigate(moduleIdToPath("fleet", { vehicle: vehicleId }));

  const exportVehicleCsv = () => {
    const rows = [
      ...vBookings.map((b) => ({
        section: "Booking",
        date: b.start_date?.slice(0, 10) || "",
        ref: b.booking_ref || b.id.slice(0, 8),
        detail: b.customer_name,
        source: sourceLabel(b.booking_source),
        amount: Number(b.total_value || 0),
        fee: Number(b.platform_fee_amount || 0),
      })),
      ...vExpenses.map((e) => ({
        section: "Expense",
        date: e.expense_date,
        ref: e.id.slice(0, 8),
        detail: e.expense_type,
        source: e.source_module,
        amount: -(Number(e.amount || 0) - Number(e.reimbursed_amount || 0)),
        fee: 0,
      })),
      ...vPayouts.map((p) => ({
        section: "Partner Payout",
        date: (p.paid_at || p.created_at || "").slice(0, 10),
        ref: p.id.slice(0, 8),
        detail: p.status,
        source: "partners",
        amount: -Number(p.net_to_partner || 0),
        fee: 0,
      })),
    ];
    const csv = toCsv(rows as any, [
      { key: "section", label: "Section" },
      { key: "date", label: "Date" },
      { key: "ref", label: "Ref" },
      { key: "detail", label: "Detail" },
      { key: "source", label: "Source" },
      { key: "amount", label: "Amount" },
      { key: "fee", label: "Platform Fee" },
    ]);
    downloadCsv(`vehicle-${vehicleName.replace(/\s+/g, "-").toLowerCase()}-${Date.now()}.csv`, csv);
  };

  const marginTone =
    totals.operator_net < 0
      ? "text-destructive"
      : totals.margin_pct < 10
        ? "text-amber-500"
        : totals.margin_pct < 30
          ? "text-foreground"
          : "text-emerald-500";

  return (
    <div className="bg-muted/30 border-t border-b border-border/60 px-4 py-4 space-y-4">
      {/* Header strip */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1 text-sm">
          <Stat label="Gross" value={formatCurrency(totals.gross)} />
          <Stat label="Net after fees" value={formatCurrency(totals.net)} />
          <Stat label="Operator Net" value={formatCurrency(totals.operator_net)} tone={totals.operator_net < 0 ? "text-destructive font-semibold" : "font-semibold"} />
          <Stat label="Margin" value={formatPercent(totals.margin_pct)} tone={cn("font-semibold", marginTone)} />
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={exportVehicleCsv}>
            <Download className="h-3.5 w-3.5 mr-1.5" /> CSV
          </Button>
          <Button size="sm" variant="outline" onClick={openInFleet}>
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Open in Fleet
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bookings */}
        <Section title="Bookings" count={vBookings.length}>
          {vBookings.length === 0 ? (
            <Empty>No bookings in this period.</Empty>
          ) : (
            <MiniTable
              headers={["Ref", "Dates", "Customer", "Source", "Gross", "Fee"]}
              aligns={["left", "left", "left", "left", "right", "right"]}
              rows={vBookings.map((b) => ({
                key: b.id,
                onClick: () => goToBookingDetails(b.id),
                cells: [
                  <span className="font-mono text-xs">{b.booking_ref || b.id.slice(0, 8)}</span>,
                  <span className="text-xs">{fmtDate(b.start_date)}<span className="text-muted-foreground"> → </span>{fmtDate(b.end_date)}</span>,
                  <span className="truncate max-w-[140px] inline-block align-bottom">{b.customer_name || "—"}</span>,
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{sourceLabel(b.booking_source)}</Badge>,
                  <span className="tabular-nums">{formatCurrency(Number(b.total_value || 0))}</span>,
                  <span className="tabular-nums text-muted-foreground">{Number(b.platform_fee_amount || 0) === 0 ? "—" : formatCurrency(Number(b.platform_fee_amount || 0))}</span>,
                ],
              }))}
            />
          )}
        </Section>

        {/* Expenses */}
        <Section title="Expenses" count={vExpenses.length}>
          {vExpenses.length === 0 ? (
            <Empty>No expenses in this period.</Empty>
          ) : (
            <MiniTable
              headers={["Date", "Type", "Source", "Amount"]}
              aligns={["left", "left", "left", "right"]}
              rows={vExpenses.map((e) => {
                const net = Number(e.amount || 0) - Number(e.reimbursed_amount || 0);
                return {
                  key: e.id,
                  cells: [
                    <span className="text-xs">{fmtDate(e.expense_date)}</span>,
                    <span className="truncate max-w-[160px] inline-block align-bottom capitalize">{e.expense_type.replace(/_/g, " ")}</span>,
                    <span className="text-xs text-muted-foreground capitalize">{e.source_module.replace(/_/g, " ")}</span>,
                    <span className="tabular-nums">{formatCurrency(net)}</span>,
                  ],
                };
              })}
            />
          )}
        </Section>
      </div>

      {vPayouts.length > 0 && (
        <Section title="Partner Payouts" count={vPayouts.length}>
          <MiniTable
            headers={["Date", "Status", "Net to Partner"]}
            aligns={["left", "left", "right"]}
            rows={vPayouts.map((p) => ({
              key: p.id,
              cells: [
                <span className="text-xs">{fmtDate(p.paid_at || p.created_at)}</span>,
                <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-4 capitalize", statusTone[p.status] || "")}>{p.status}</Badge>,
                <span className="tabular-nums">{formatCurrency(Number(p.net_to_partner || 0))}</span>,
              ],
            }))}
          />
        </Section>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={cn("tabular-nums", tone)}>{value}</span>
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border/60 bg-background overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/60">
        <span className="text-xs font-semibold">{title}</span>
        <span className="text-[11px] text-muted-foreground tabular-nums">{count}</span>
      </div>
      <div className="max-h-64 overflow-auto">{children}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-3 py-4 text-xs text-muted-foreground text-center">{children}</div>;
}

function MiniTable({
  headers,
  aligns,
  rows,
}: {
  headers: string[];
  aligns: ("left" | "right")[];
  rows: { key: string; cells: React.ReactNode[]; onClick?: () => void }[];
}) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {headers.map((h, i) => (
            <th key={h} className={cn("px-3 py-1.5 font-medium", aligns[i] === "right" ? "text-right" : "text-left")}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr
            key={r.key}
            className={cn("border-t border-border/40", r.onClick && "cursor-pointer hover:bg-muted/50")}
            onClick={r.onClick}
          >
            {r.cells.map((c, i) => (
              <td key={i} className={cn("px-3 py-1.5", aligns[i] === "right" ? "text-right" : "text-left")}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
