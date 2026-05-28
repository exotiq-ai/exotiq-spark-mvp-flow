import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent } from "@/components/ui/card";
import { Lock } from "lucide-react";
import { MarginFiltersProvider } from "@/components/margin/MarginFiltersContext";
import { MarginFilterBar } from "@/components/margin/MarginFilterBar";
import { MarginOverview } from "@/components/margin/MarginOverview";
import { VehiclePnLTable } from "@/components/margin/VehiclePnLTable";
import { ExpensesTab } from "@/components/margin/ExpensesTab";
import { PartnerPayoutsTab } from "@/components/margin/PartnerPayoutsTab";
import { DepositLedgerTab } from "@/components/margin/DepositLedgerTab";
import { RevenueBySourceCard } from "@/components/margin/RevenueBySourceCard";
import { RevenueExpenseTrendChart } from "@/components/margin/RevenueExpenseTrendChart";
import { ExpenseBreakdownChart } from "@/components/margin/ExpenseBreakdownChart";
import { TopBottomMarginVehicles } from "@/components/margin/TopBottomMarginVehicles";
import { TenantOverheadCard } from "@/components/margin/TenantOverheadCard";

export default function MarginEnhanced() {
  const { isManagerOrHigher, loading } = useUserRole();

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
    <MarginFiltersProvider>
      <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Margin</h1>
          <p className="text-sm text-muted-foreground">
            Revenue, expenses, and vehicle profitability — filter by date, location, vehicle, or source.
          </p>
        </header>

        <MarginFilterBar />
        <MarginOverview />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <RevenueExpenseTrendChart />
          </div>
          <ExpenseBreakdownChart />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <RevenueBySourceCard />
          <div className="lg:col-span-2">
            <TopBottomMarginVehicles />
          </div>
        </div>

        <TenantOverheadCard />

        <Tabs defaultValue="vehicles" className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 max-w-2xl">
            <TabsTrigger value="vehicles">Per-Vehicle P&L</TabsTrigger>
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
            <TabsTrigger value="payouts">Partner Payouts</TabsTrigger>
            <TabsTrigger value="deposits">Deposits</TabsTrigger>
          </TabsList>
          <TabsContent value="vehicles" className="mt-4">
            <VehiclePnLTable />
          </TabsContent>
          <TabsContent value="expenses" className="mt-4">
            <ExpensesTab />
          </TabsContent>
          <TabsContent value="payouts" className="mt-4">
            <PartnerPayoutsTab />
          </TabsContent>
          <TabsContent value="deposits" className="mt-4">
            <DepositLedgerTab />
          </TabsContent>
        </Tabs>
      </div>
    </MarginFiltersProvider>
  );
}
