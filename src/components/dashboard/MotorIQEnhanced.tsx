import { useMemo, useState } from "react";
import { Brain, BarChart3, Calendar, DollarSign, Layers } from "lucide-react";
import { TabsContent } from "@/components/ui/tabs";
import { ModuleTabs } from "@/components/common/ModuleTabs";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { useMotorIQ } from "@/hooks/useMotorIQ";
import { useUserRole } from "@/hooks/useUserRole";
import { QuickPriceEditorDialog } from "@/components/dialogs/QuickPriceEditorDialog";
import { DemandForecastCard } from "@/components/dashboard/DemandForecastCard";
import { DemandForecastErrorBoundary } from "@/components/dashboard/DemandForecastErrorBoundary";
import { RateTiersPanel } from "@/components/dashboard/RateTiersPanel";
import { PricingCalendar } from "@/components/dashboard/PricingCalendar";
import { SkeletonAIInsight, SkeletonStatsRow, SkeletonVehicleCard } from "@/components/ui/skeleton-specialized";
import { NoVehiclesState } from "@/components/common/EmptyState";
import { AddVehicleDialog } from "@/components/dialogs/AddVehicleDialog";
import { ApplyRatesDialog } from "@/components/motoriq/ApplyRatesDialog";
import { MotorIQOverview } from "@/components/motoriq/MotorIQOverview";
import { PricingEngineCard } from "@/components/motoriq/PricingEngineCard";

type TabId = "overview" | "calendar" | "pricing" | "forecast" | "rate-tiers";

export const MotorIQEnhanced = () => {
  const { vehicles, bookings, applyPriceOptimization, loading, createVehicle } = useLocationFilteredFleet();
  const motoriq = useMotorIQ();
  const { hasRoleOrHigher } = useUserRole();
  const canApply = hasRoleOrHigher("manager");

  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [applyIds, setApplyIds] = useState<string[] | null>(null); // null = closed; [] = all changes
  const [editVehicleId, setEditVehicleId] = useState<string | null>(null);

  const recommendations = motoriq.snapshot?.recommendations ?? [];
  const editVehicle = useMemo(() => (editVehicleId ? (vehicles.find((v) => v.id === editVehicleId) ?? null) : null), [editVehicleId, vehicles]);
  const editRecommendation = useMemo(() => recommendations.find((r) => r.vehicleId === editVehicleId) ?? null, [recommendations, editVehicleId]);

  const dialogRecs = useMemo(() => {
    if (applyIds === null) return [];
    const changes = recommendations.filter((r) => r.action !== "hold");
    return applyIds.length ? changes.filter((r) => applyIds.includes(r.vehicleId)) : changes;
  }, [applyIds, recommendations]);

  if (!loading && vehicles.length === 0) {
    return (
      <div className="space-y-6">
        <NoVehiclesState onAddVehicle={() => setShowAddVehicle(true)} />
        <AddVehicleDialog open={showAddVehicle} onOpenChange={setShowAddVehicle} onSubmit={createVehicle} />
      </div>
    );
  }

  if (loading || !motoriq.snapshot) {
    return (
      <div className="space-y-6" aria-busy="true">
        <SkeletonAIInsight />
        <SkeletonStatsRow count={4} />
        <SkeletonVehicleCard />
        <SkeletonVehicleCard />
      </div>
    );
  }

  const openTab = (tab: "pricing" | "forecast" | "calendar") => setActiveTab(tab);

  return (
    <>
      <ApplyRatesDialog
        open={applyIds !== null}
        onOpenChange={(o) => { if (!o) setApplyIds(null); }}
        recommendations={dialogRecs}
        onApply={(vehicleId, rate) => applyPriceOptimization(vehicleId, rate)}
      />
      <QuickPriceEditorDialog
        open={editVehicleId !== null}
        onOpenChange={(o) => { if (!o) setEditVehicleId(null); }}
        vehicle={editVehicle as any}
        onApplyRate={async (vehicleId, rate) => { await applyPriceOptimization(vehicleId, rate); }}
        recommendation={editRecommendation}
      />

      <div className="w-full space-y-4 overflow-x-hidden sm:space-y-6">
        <ModuleTabs
          tabs={[
            { id: "overview", label: "Overview", shortLabel: "Home", icon: Brain },
            { id: "calendar", label: "Calendar", shortLabel: "Cal", icon: Calendar },
            { id: "pricing", label: "Dynamic Pricing", shortLabel: "Price", icon: DollarSign },
            { id: "forecast", label: "Demand Forecast", shortLabel: "Trends", icon: BarChart3 },
            { id: "rate-tiers", label: "Rate Tiers", shortLabel: "Rates", icon: Layers },
          ]}
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as TabId)}
        >
          <TabsContent value="overview" className="space-y-6">
            <MotorIQOverview
              state={motoriq}
              canApply={canApply}
              onApplyRates={(ids) => setApplyIds(ids ?? [])}
              onOpenVehicle={setEditVehicleId}
              onOpenTab={openTab}
            />
          </TabsContent>

          <TabsContent value="calendar" className="space-y-6">
            <PricingCalendar />
          </TabsContent>

          <TabsContent value="pricing" className="space-y-6">
            <PricingEngineCard
              state={motoriq}
              canApply={canApply}
              onApplyRates={(ids) => setApplyIds(ids ?? [])}
              onEditRate={setEditVehicleId}
            />
          </TabsContent>

          <TabsContent value="forecast" className="space-y-6">
            <DemandForecastErrorBoundary>
              <DemandForecastCard bookings={bookings} vehicles={vehicles} />
            </DemandForecastErrorBoundary>
          </TabsContent>

          <TabsContent value="rate-tiers" className="space-y-6">
            <RateTiersPanel />
          </TabsContent>
        </ModuleTabs>
      </div>
    </>
  );
};

export default MotorIQEnhanced;
