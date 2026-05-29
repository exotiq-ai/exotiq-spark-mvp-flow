import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrency, formatPercent } from "@/lib/marginCsv";
import { TrendingUp, Receipt, Users, Percent, DollarSign, Wallet, CreditCard, Clock, Info } from "lucide-react";
import {
  useMarginData,
  sumGross,
  sumCollected,
  sumRefunds,
  sumPlatformFees,
  sumVehicleExpenses,
  sumPendingPayouts,
  sumPartnerPayouts,
} from "./useMarginData";

export function MarginOverview() {
  const { loading, bookings, payments, expenses, payouts } = useMarginData();

  const gross = sumGross(bookings);
  const collected = sumCollected(payments);
  const refunds = sumRefunds(payments);
  const outstanding = Math.max(gross - collected - refunds, 0);
  const fees = sumPlatformFees(bookings);
  const vehicleExpenses = sumVehicleExpenses(expenses);
  const pendingPayouts = sumPendingPayouts(payouts);
  const totalPayouts = sumPartnerPayouts(payouts);
  const operatorNet = gross - fees - vehicleExpenses - totalPayouts;
  const marginPct = gross > 0 ? (operatorNet / gross) * 100 : 0;

  const hasAnyData =
    bookings.length > 0 || payments.length > 0 || expenses.length > 0 || payouts.length > 0;

  const cards = [
    {
      label: "Gross Booked",
      value: formatCurrency(gross),
      icon: DollarSign,
      hint: `${bookings.filter((b) => b.status !== "cancelled").length} bookings`,
      tip: "Sum of booking totals in the selected period, excluding cancelled bookings.",
    },
    {
      label: "Collected",
      value: formatCurrency(collected),
      icon: CreditCard,
      hint: refunds > 0 ? `Refunds ${formatCurrency(refunds)}` : "Cash received",
      tip: "Completed payments received from renters. Refunds are tracked separately and reduce Outstanding.",
    },
    {
      label: "Outstanding",
      value: formatCurrency(outstanding),
      icon: Clock,
      muted: true,
      hint: "Gross − collected − refunds",
      tip: "What renters still owe: Gross Booked minus Collected minus Refunds (floored at zero).",
    },
    {
      label: "Platform Fees",
      value: formatCurrency(fees),
      icon: Receipt,
      muted: true,
      tip: "Marketplace fees withheld on OTA bookings (e.g. Drive Exotiq). Direct bookings have no platform fee.",
    },
    {
      label: "Expenses",
      value: formatCurrency(vehicleExpenses),
      icon: Wallet,
      muted: true,
      hint: "Vehicle-scoped only",
      tip: "Vehicle-scoped expenses (maintenance, fuel, detailing, etc.) net of any reimbursements. Tenant overhead is shown in its own card.",
    },
    {
      label: "Pending Payouts",
      value: formatCurrency(pendingPayouts),
      icon: Users,
      muted: true,
      tip: "Outstanding obligations to vehicle partners — pending and scheduled payouts only. Voided payouts are excluded.",
    },
    {
      label: "Operator Net",
      value: formatCurrency(operatorNet),
      icon: TrendingUp,
      highlight: true,
      tip: "Gross Booked − Platform Fees − Vehicle Expenses − Partner Payouts (excluding voided). The bottom-line take after partners are paid.",
    },
    {
      label: "Margin %",
      value: formatPercent(marginPct),
      icon: Percent,
      highlight: true,
      tip: "Operator Net divided by Gross Booked, expressed as a percentage.",
    },
  ];

  return (
    <TooltipProvider delayDuration={150}>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {cards.map((c) => (
          <Card key={c.label} className={c.highlight ? "border-primary/40" : ""}>
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  {c.label}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="text-muted-foreground/60 hover:text-foreground">
                        <Info className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[240px] text-xs">
                      {c.tip}
                    </TooltipContent>
                  </Tooltip>
                </span>
                <c.icon className="h-3.5 w-3.5" />
              </div>
              <div className={`text-lg font-semibold ${c.muted ? "text-muted-foreground" : ""}`}>
                {loading ? "…" : c.value}
              </div>
              {c.hint && <div className="text-[10px] text-muted-foreground/70 truncate">{c.hint}</div>}
            </CardContent>
          </Card>
        ))}
      </div>

      {!loading && !hasAnyData && (
        <Card className="mt-3 border-dashed">
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            No bookings, expenses, or partner payouts in this range yet.
            Adjust filters or record activity to see your margin breakdown.
          </CardContent>
        </Card>
      )}
    </TooltipProvider>
  );
}
