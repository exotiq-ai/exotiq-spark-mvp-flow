import { useState } from "react";
import { BannerWidget } from "./widgets/BannerWidget";
import { RevenueWidget } from "./widgets/RevenueWidget";
import { MetricsWidget } from "./widgets/MetricsWidget";
import { AIInsightWidget } from "./widgets/AIInsightWidget";
import { FleetStatusWidget } from "./widgets/FleetStatusWidget";
import { ScheduleWidget } from "./widgets/ScheduleWidget";
import { ModuleGridWidget } from "./widgets/ModuleGridWidget";
import { PriceOptimizationDialog } from "@/components/dialogs/PriceOptimizationDialog";
import { useFleet } from "@/contexts/FleetContext";
import { DemoOnboarding } from "@/components/demo/DemoOnboarding";

interface Module {
  id: string;
  name: string;
  icon: React.ElementType;
  description: string;
  color: string;
  bgColor: string;
}

interface DashboardOverviewProps {
  modules: Module[];
  onModuleClick: (moduleId: string) => void;
}

export const DashboardOverview = ({ modules, onModuleClick }: DashboardOverviewProps) => {
  const [showOptimizationDialog, setShowOptimizationDialog] = useState(false);
  const { vehicles, applyPriceOptimization } = useFleet();

  return (
    <>
      <DemoOnboarding />
      
      <PriceOptimizationDialog
        open={showOptimizationDialog}
        onOpenChange={setShowOptimizationDialog}
        vehicles={vehicles}
        onApply={(vehicleId, newRate) => applyPriceOptimization(vehicleId, newRate)}
      />

      <div className="space-y-4 md:space-y-6">
        <BannerWidget />
        <div data-tour="revenue-widget">
          <RevenueWidget />
        </div>
        <MetricsWidget />
        <AIInsightWidget 
          onApplyOptimization={() => setShowOptimizationDialog(true)}
          onViewAnalysis={() => onModuleClick('motoriq')}
        />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          <FleetStatusWidget onViewAll={() => onModuleClick('motoriq')} />
          <ScheduleWidget onViewCalendar={() => onModuleClick('book')} />
        </div>
        <ModuleGridWidget modules={modules} onModuleClick={onModuleClick} />
      </div>
    </>
  );
};
