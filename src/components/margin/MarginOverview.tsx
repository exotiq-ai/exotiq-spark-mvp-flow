import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatPercent } from "@/lib/marginCsv";
import { TrendingUp, Receipt, Users, Percent, DollarSign, Wallet, CreditCard, Clock } from "lucide-react";
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

  const cards = [
    { label: "Gross Booked", value: formatCurrency(gross), icon: DollarSign, hint: `${bookings.filter((b) => b.status !== "cancelled").length} bookings` },
    { label: "Collected", value: formatCurrency(collected), icon: CreditCard, hint: refunds > 0 ? `Refunds ${formatCurrency(refunds)}` : "Cash received" },
    { label: "Outstanding", value: formatCurrency(outstanding), icon: Clock, muted: true, hint: "Gross − collected − refunds" },
    { label: "Platform Fees", value: formatCurrency(fees), icon: Receipt, muted: true },
    { label: "Expenses", value: formatCurrency(vehicleExpenses), icon: Wallet, muted: true, hint: "Vehicle-scoped only" },
    { label: "Pending Payouts", value: formatCurrency(pendingPayouts), icon: Users, muted: true },
    { label: "Operator Net", value: formatCurrency(operatorNet), icon: TrendingUp, highlight: true },
    { label: "Margin %", value: formatPercent(marginPct), icon: Percent, highlight: true },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
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
            {c.hint && <div className="text-[10px] text-muted-foreground/70 truncate">{c.hint}</div>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
