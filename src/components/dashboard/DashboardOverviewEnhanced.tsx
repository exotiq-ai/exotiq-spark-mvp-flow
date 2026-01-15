import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { BannerWidget } from "./widgets/BannerWidget";
import { RevenueWidget } from "./widgets/RevenueWidget";
import { CompactMetricsBar } from "./widgets/CompactMetricsBar";
import { CompactAIInsightBanner } from "./widgets/CompactAIInsightBanner";
import { FleetStatusWidget } from "./widgets/FleetStatusWidget";
import { ScheduleWidget } from "./widgets/ScheduleWidget";
import { DashboardBottomActionBar } from "./DashboardBottomActionBar";
import { PriceOptimizationDialog } from "@/components/dialogs/PriceOptimizationDialog";
import { AddVehicleDialog } from "@/components/dialogs/AddVehicleDialog";
import { NewBookingDialog } from "@/components/dialogs/NewBookingDialog";
import { AddCustomerDialog } from "@/components/dialogs/AddCustomerDialog";
import { GenerateReportDialog } from "@/components/dialogs/GenerateReportDialog";
import { ScheduleMaintenanceDialog } from "@/components/dialogs/ScheduleMaintenanceDialog";
import { RecordPaymentDialog } from "@/components/dialogs/RecordPaymentDialog";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { LocationContextBanner } from "@/components/common/LocationBadge";
import { DemoOnboarding } from "@/components/demo/DemoOnboarding";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useRariSidebar } from "@/hooks/useRariSidebar";
import { motion, AnimatePresence } from "framer-motion";
import { 
  SkeletonBanner, 
  SkeletonQuickActions, 
  SkeletonModuleNav 
} from "@/components/ui/skeleton-specialized";
import { SkeletonLineChart, SkeletonDonutChart, SkeletonTable } from "@/components/ui/skeleton-card";
import { 
  TrendingUp, 
  Calendar, 
  Car,
  DollarSign,
  Sparkles,
  FileText,
  ChevronRight,
  ChevronDown
} from "lucide-react";

interface DashboardOverviewEnhancedProps {
  onModuleClick: (moduleId: string) => void;
}

export const DashboardOverviewEnhanced = ({ onModuleClick }: DashboardOverviewEnhancedProps) => {
  const [showOptimizationDialog, setShowOptimizationDialog] = useState(false);
  const [showBookingDialog, setShowBookingDialog] = useState(false);
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showMaintenanceDialog, setShowMaintenanceDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showAddVehicleDialog, setShowAddVehicleDialog] = useState(false);
  
  const { vehicles, bookings, loading, applyPriceOptimization, createBooking, createCustomer, generateReport, createMaintenance, createPayment, createVehicle } = useLocationFilteredFleet();
  const rariSidebar = useRariSidebar();
  
  // Collapsible state persistence
  const [showFleetSchedule, setShowFleetSchedule] = useLocalStorage<boolean>("dashboardFleetSchedule", false);

  // Calculate vehicles currently out (confirmed bookings spanning today)
  const { activeVehicleIds, activeBookingsCount, pendingCount } = useMemo(() => {
    const now = new Date();
    const ids = new Set(
      bookings
        .filter(b => {
          const startDate = new Date(b.start_date);
          const endDate = new Date(b.end_date);
          return (
            b.status === 'confirmed' &&
            startDate <= now &&
            endDate >= now
          );
        })
        .map(b => b.vehicle_id)
    );
    const pending = bookings.filter(b => b.status === 'pending').length;
    return { activeVehicleIds: ids, activeBookingsCount: ids.size, pendingCount: pending };
  }, [bookings]);

  // Calculate current utilization percentage
  const currentUtilization = useMemo(() => {
    return vehicles.length > 0 
      ? Math.round((activeVehicleIds.size / vehicles.length) * 100) 
      : 0;
  }, [activeVehicleIds.size, vehicles.length]);

  // Calculate average daily rate
  const averageRate = useMemo(() => {
    return vehicles.length > 0 
      ? Math.round(vehicles.reduce((acc, v) => acc + (v.current_rate || 0), 0) / vehicles.length) 
      : 0;
  }, [vehicles]);

  const firstBooking = bookings[0];

  // Loading state with streamlined skeletons
  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6 pb-20 md:pb-24">
        <SkeletonBanner />
        <SkeletonQuickActions count={3} />
        <SkeletonLineChart height={200} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          <SkeletonDonutChart size={160} />
          <SkeletonTable rows={3} />
        </div>
        <SkeletonModuleNav count={4} />
      </div>
    );
  }

  return (
    <>
      <DemoOnboarding />
      
      {/* Dialogs */}
      <PriceOptimizationDialog
        open={showOptimizationDialog}
        onOpenChange={setShowOptimizationDialog}
        vehicles={vehicles}
        onApply={(vehicleId, newRate) => applyPriceOptimization(vehicleId, newRate)}
      />
      <NewBookingDialog
        open={showBookingDialog}
        onOpenChange={setShowBookingDialog}
        vehicles={vehicles}
        onSubmit={createBooking}
      />
      <AddCustomerDialog
        open={showCustomerDialog}
        onOpenChange={setShowCustomerDialog}
        onSubmit={createCustomer}
      />
      <GenerateReportDialog
        open={showReportDialog}
        onOpenChange={setShowReportDialog}
        onGenerate={generateReport}
      />
      <ScheduleMaintenanceDialog
        open={showMaintenanceDialog}
        onOpenChange={setShowMaintenanceDialog}
        vehicles={vehicles}
        onSubmit={createMaintenance}
      />
      {firstBooking && (
        <RecordPaymentDialog
          open={showPaymentDialog}
          onOpenChange={setShowPaymentDialog}
          booking={firstBooking}
          onSubmit={createPayment}
        />
      )}
      <AddVehicleDialog
        open={showAddVehicleDialog}
        onOpenChange={setShowAddVehicleDialog}
        onSubmit={createVehicle}
      />

      {/* Content wrapper with sticky dock */}
      <div className="relative">
        <div className="space-y-5 sm:space-y-6 pb-6 md:pb-24">
          {/* Hero Banner */}
          <BannerWidget />
          
          {/* Location Context Banner */}
          <LocationContextBanner />

          {/* Compact Metrics Bar - Clickable chips */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-medium text-foreground">Quick Stats</h2>
              {vehicles.length > 0 && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Live</Badge>}
            </div>
            <CompactMetricsBar
              activeBookings={activeBookingsCount}
              utilization={currentUtilization}
              averageRate={averageRate}
              onNavigate={onModuleClick}
            />
          </div>

          {/* Revenue Analytics - Prominently displayed */}
          <div className="space-y-3" data-tour="revenue-widget">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-success" />
              <h2 className="text-lg font-semibold text-foreground">Revenue Analytics</h2>
            </div>
            <RevenueWidget />
          </div>

          {/* Compact AI Insight Banner */}
          <CompactAIInsightBanner
            vehicleName={vehicles[0]?.name || "your vehicle"}
            suggestedIncrease={15}
            potentialRevenue={vehicles.length > 0 ? Math.round((vehicles[0]?.current_rate || 0) * 0.15 * 30) : 0}
            onApply={() => setShowOptimizationDialog(true)}
            onViewAnalysis={() => onModuleClick('motoriq')}
            hasFleetData={vehicles.length > 0}
          />

          {/* Fleet Status & Schedule - Collapsible */}
          <div className="space-y-3">
            <Button
              variant="ghost"
              onClick={() => setShowFleetSchedule(!showFleetSchedule)}
              className="flex items-center gap-2 px-0 hover:bg-transparent"
            >
              <Car className="h-4 w-4 text-foreground/70" />
              <span className="text-sm font-medium text-foreground">Fleet Status & Schedule</span>
              <Badge variant="outline" className="text-[10px] ml-1">Today</Badge>
              <motion.div
                animate={{ rotate: showFleetSchedule ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="h-4 w-4 text-foreground/70" />
              </motion.div>
            </Button>
            
            <AnimatePresence>
              {showFleetSchedule && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <FleetStatusWidget onViewAll={() => onModuleClick('motoriq')} />
                    <ScheduleWidget onViewCalendar={() => onModuleClick('book')} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Module Navigation Cards */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
            {[
              { id: 'book', name: 'Bookings', icon: Calendar, color: 'text-primary', badge: pendingCount },
              { id: 'motoriq', name: 'MotorIQ', icon: TrendingUp, color: 'text-success', badge: 0 },
              { id: 'vault', name: 'Vault', icon: FileText, color: 'text-warning', badge: 0 },
              { id: 'pulse', name: 'Pulse', icon: DollarSign, color: 'text-accent', badge: 0 },
            ].map((module) => (
              <button
                key={module.id}
                onClick={() => onModuleClick(module.id)}
                className="flex items-center justify-between p-4 sm:p-6 rounded-lg sm:rounded-xl border border-border bg-card hover:bg-muted/50 hover:border-primary/30 transition-all group touch-target"
              >
                <div className="flex items-center gap-2 sm:gap-3">
                  <module.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${module.color}`} />
                  <span className="font-medium text-xs sm:text-sm text-foreground">{module.name}</span>
                  {module.badge > 0 && (
                    <Badge className="bg-warning/20 text-warning border-warning/30 text-[10px] px-1.5 py-0">
                      {module.badge}
                    </Badge>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>
            ))}
          </div>
        </div>

        {/* Sticky Bottom Action Bar - Desktop only, within content bounds */}
        <DashboardBottomActionBar
          onNewBooking={() => setShowBookingDialog(true)}
          onRecordPayment={() => setShowPaymentDialog(true)}
          onAddCustomer={() => setShowCustomerDialog(true)}
          onGenerateReport={() => setShowReportDialog(true)}
          onScheduleMaintenance={() => setShowMaintenanceDialog(true)}
          onAskRari={rariSidebar.open}
          rariUnreadCount={rariSidebar.unreadCount + rariSidebar.urgentCount}
        />
      </div>
    </>
  );
};
