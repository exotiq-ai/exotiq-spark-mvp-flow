import { useState } from "react";
import { BannerWidget } from "./widgets/BannerWidget";
import { RevenueWidget } from "./widgets/RevenueWidget";
import { MetricsWidget } from "./widgets/MetricsWidget";
import { AIInsightWidget } from "./widgets/AIInsightWidget";
import { FleetStatusWidget } from "./widgets/FleetStatusWidget";
import { ScheduleWidget } from "./widgets/ScheduleWidget";
import { QuickActionsWidget } from "./widgets/QuickActionsWidget";
import { PriceOptimizationDialog } from "@/components/dialogs/PriceOptimizationDialog";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { DemoOnboarding } from "@/components/demo/DemoOnboarding";
import { PageHeader } from "@/components/common/PageHeader";

interface DashboardOverviewProps {
  onModuleClick: (moduleId: string) => void;
}

export const DashboardOverview = ({ onModuleClick }: DashboardOverviewProps) => {
  const [showOptimizationDialog, setShowOptimizationDialog] = useState(false);
  const { vehicles, applyPriceOptimization } = useLocationFilteredFleet();

  return (
    <>
      <DemoOnboarding />
      
      <PriceOptimizationDialog
        open={showOptimizationDialog}
        onOpenChange={setShowOptimizationDialog}
        vehicles={vehicles}
        onApply={(vehicleId, newRate) => applyPriceOptimization(vehicleId, newRate)}
      />

      <div className="space-y-6 md:space-y-8">
        <PageHeader 
          title="Command Center"
          subtitle="Real-time fleet operations at your fingertips"
          showDivider={false}
        />
        <BannerWidget />
        <div data-tour="revenue-widget">
          <RevenueWidget />
        </div>
        <MetricsWidget />
        <AIInsightWidget 
          onApplyOptimization={() => setShowOptimizationDialog(true)}
          onViewAnalysis={() => onModuleClick('motoriq')}
        />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
          <FleetStatusWidget onViewAll={() => onModuleClick('motoriq')} />
          <ScheduleWidget onViewCalendar={() => onModuleClick('book')} />
        </div>
        <QuickActionsWidget onModuleClick={onModuleClick} />
      </div>
    </>
  );
};
