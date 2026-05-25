import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent } from "@/components/ui/card";
import { Lock } from "lucide-react";
import { MarginOverview } from "@/components/margin/MarginOverview";
import { VehiclePnLTable } from "@/components/margin/VehiclePnLTable";
import { ExpensesTab } from "@/components/margin/ExpensesTab";
import { PartnerPayoutsTab } from "@/components/margin/PartnerPayoutsTab";
import { DepositLedgerTab } from "@/components/margin/DepositLedgerTab";
import { RevenueBySourceCard } from "@/components/margin/RevenueBySourceCard";

const startOfMonth = () => {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
};

export default function MarginEnhanced() {
  const { isManagerOrHigher, loading } = useUserRole();
  const [range] = useState<{ start: Date; end: Date }>({
    start: startOfMonth(),
    end: new Date(),
  });

  if (loading) {
    return <div className="p-6 animate-pulse text-muted-foreground">Loading Margin…</div>;
  }

  if (!isManagerOrHigher) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <Lock className="h-8 w-8 mx-auto text-muted-foreground" />
            <h2 className="text-lg font-semibold">Manager access required</h2>
            <p className="text-sm text-muted-foreground">
              Margin contains financial data and is restricted to Owners, Admins, and Managers.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Margin</h1>
        <p className="text-sm text-muted-foreground">
          Per-vehicle profit & loss, expenses, partner payouts, and deposit tracking.
        </p>
      </header>

      <MarginOverview start={range.start} end={range.end} />
      <RevenueBySourceCard />

      <Tabs defaultValue="vehicles" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 max-w-2xl">
          <TabsTrigger value="vehicles">Per-Vehicle P&L</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="payouts">Partner Payouts</TabsTrigger>
          <TabsTrigger value="deposits">Deposits</TabsTrigger>
        </TabsList>
        <TabsContent value="vehicles" className="mt-4">
          <VehiclePnLTable start={range.start} end={range.end} />
        </TabsContent>
        <TabsContent value="expenses" className="mt-4">
          <ExpensesTab start={range.start} end={range.end} />
        </TabsContent>
        <TabsContent value="payouts" className="mt-4">
          <PartnerPayoutsTab />
        </TabsContent>
        <TabsContent value="deposits" className="mt-4">
          <DepositLedgerTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
