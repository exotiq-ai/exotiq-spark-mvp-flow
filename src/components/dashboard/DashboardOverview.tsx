import { useState, useMemo } from "react";
import { BannerWidget } from "./widgets/BannerWidget";
import { RevenueWidget } from "./widgets/RevenueWidget";
import { CompactMetricsBar } from "./widgets/CompactMetricsBar";
import { CompactAIInsightBanner } from "./widgets/CompactAIInsightBanner";
import { FleetStatusWidget } from "./widgets/FleetStatusWidget";
import { ScheduleWidget } from "./widgets/ScheduleWidget";
import { PriceOptimizationDialog } from "@/components/dialogs/PriceOptimizationDialog";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { useFleetAIInsight } from "@/hooks/useFleetAIInsight";
import { DemoOnboarding } from "@/components/demo/DemoOnboarding";
import { PageHeader } from "@/components/common/PageHeader";

interface DashboardOverviewProps {
  onModuleClick: (moduleId: string) => void;
}

export const DashboardOverview = ({ onModuleClick }: DashboardOverviewProps) => {
  const [showOptimizationDialog, setShowOptimizationDialog] = useState(false);
  const { vehicles, bookings, applyPriceOptimization } = useLocationFilteredFleet();
  const aiInsight = useFleetAIInsight(vehicles, bookings);

  // Calculate metrics
  const { activeBookingsCount, currentUtilization, averageRate } = useMemo(() => {
    const active = bookings.filter(b => b.status === 'confirmed').length;
    const utilization = vehicles.length > 0 
      ? Math.round((active / vehicles.length) * 100) 
      : 0;
    const avgRate = vehicles.length > 0 
      ? Math.round(vehicles.reduce((acc, v) => acc + (v.current_rate || 0), 0) / vehicles.length) 
      : 0;
    return { activeBookingsCount: active, currentUtilization: utilization, averageRate: avgRate };
  }, [vehicles, bookings]);

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
        
        {/* Compact Metrics Bar */}
        <CompactMetricsBar
          activeBookings={activeBookingsCount}
          utilization={currentUtilization}
          averageRate={averageRate}
          onNavigate={onModuleClick}
        />
        
        <div data-tour="revenue-widget">
          <RevenueWidget />
        </div>
        
        {/* AI Insight Banner */}
        {aiInsight && (
          <CompactAIInsightBanner
            vehicleName={aiInsight.vehicleName}
            suggestedIncrease={aiInsight.suggestedIncreasePercent}
            potentialRevenue={aiInsight.potentialMonthlyRevenue}
            onApply={() => setShowOptimizationDialog(true)}
            onViewAnalysis={() => onModuleClick('motoriq')}
            hasFleetData={vehicles.length > 0}
          />
        )}
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
          <FleetStatusWidget onViewAll={() => onModuleClick('motoriq')} />
          <ScheduleWidget onViewCalendar={() => onModuleClick('book')} />
        </div>
      </div>
    </>
  );
};
