import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { BannerWidget } from "./widgets/BannerWidget";
import { RevenueWidget } from "./widgets/RevenueWidget";
import { MetricsWidget } from "./widgets/MetricsWidget";
import { AIInsightWidget } from "./widgets/AIInsightWidget";
import { FleetStatusWidget } from "./widgets/FleetStatusWidget";
import { ScheduleWidget } from "./widgets/ScheduleWidget";
import { PriceOptimizationDialog } from "@/components/dialogs/PriceOptimizationDialog";
import { AddVehicleDialog } from "@/components/dialogs/AddVehicleDialog";
import { NewBookingDialog } from "@/components/dialogs/NewBookingDialog";
import { AddCustomerDialog } from "@/components/dialogs/AddCustomerDialog";
import { GenerateReportDialog } from "@/components/dialogs/GenerateReportDialog";
import { ScheduleMaintenanceDialog } from "@/components/dialogs/ScheduleMaintenanceDialog";
import { RecordPaymentDialog } from "@/components/dialogs/RecordPaymentDialog";
import { useFleet } from "@/contexts/FleetContext";
import { DemoOnboarding } from "@/components/demo/DemoOnboarding";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { motion, AnimatePresence } from "framer-motion";
import { 
  SkeletonBanner, 
  SkeletonQuickActions, 
  SkeletonAIInsight, 
  SkeletonModuleNav 
} from "@/components/ui/skeleton-specialized";
import { SkeletonLineChart, SkeletonDonutChart, SkeletonTable } from "@/components/ui/skeleton-card";
import { SkeletonHeroMetric } from "@/components/ui/skeleton-specialized";
import { 
  TrendingUp, 
  Calendar, 
  Car,
  DollarSign,
  Sparkles,
  CalendarPlus,
  CreditCard,
  UserPlus,
  FileText,
  Wrench,
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
  
  const { vehicles, bookings, loading, applyPriceOptimization, createBooking, createCustomer, generateReport, createMaintenance, createPayment, createVehicle } = useFleet();
  
  // Collapsible state persistence - default to only metrics expanded for reduced visual density
  const [expandedSections, setExpandedSections] = useLocalStorage<string[]>("dashboardSections", [
    "metrics"
  ]);
  const [showAllInsights, setShowAllInsights] = useLocalStorage<boolean>("dashboardExpanded", false);

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev =>
      prev.includes(sectionId)
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const isSectionExpanded = (sectionId: string) => {
    // If "Show All" is active, force expand all sections
    if (showAllInsights) return true;
    return expandedSections.includes(sectionId);
  };

  const handleToggleInsights = () => {
    const newValue = !showAllInsights;
    setShowAllInsights(newValue);
    // Expand or collapse all sections based on new state
    if (newValue) {
      setExpandedSections(["metrics", "ai-insight", "revenue", "fleet-schedule"]);
    } else {
      setExpandedSections(["metrics"]); // Keep only metrics expanded
    }
  };

  // Quick actions - streamlined to 5 most important
  const quickActions = [
    {
      id: "new-booking",
      label: "New Booking",
      icon: CalendarPlus,
      color: "text-primary",
      bgColor: "bg-primary/10 hover:bg-primary/20",
      onClick: () => setShowBookingDialog(true),
    },
    {
      id: "record-payment",
      label: "Payment",
      icon: CreditCard,
      color: "text-success",
      bgColor: "bg-success/10 hover:bg-success/20",
      onClick: () => setShowPaymentDialog(true),
    },
    {
      id: "add-customer",
      label: "Customer",
      icon: UserPlus,
      color: "text-accent",
      bgColor: "bg-accent/10 hover:bg-accent/20",
      onClick: () => setShowCustomerDialog(true),
    },
    {
      id: "generate-report",
      label: "Report",
      icon: FileText,
      color: "text-warning",
      bgColor: "bg-warning/10 hover:bg-warning/20",
      onClick: () => setShowReportDialog(true),
    },
    {
      id: "maintenance",
      label: "Service",
      icon: Wrench,
      color: "text-muted-foreground",
      bgColor: "bg-secondary/50 hover:bg-secondary",
      onClick: () => setShowMaintenanceDialog(true),
    },
  ];

  const firstBooking = bookings[0];

  // Loading state with comprehensive skeletons
  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <SkeletonBanner />
        <SkeletonQuickActions count={5} />
        
        {/* Metrics skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SkeletonHeroMetric />
          <SkeletonHeroMetric />
          <SkeletonHeroMetric />
        </div>
        
        {/* AI Insight skeleton */}
        <SkeletonAIInsight />
        
        {/* Revenue Chart skeleton */}
        <SkeletonLineChart height={200} />
        
        {/* Fleet & Schedule skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          <SkeletonDonutChart size={160} />
          <SkeletonTable rows={3} />
        </div>
        
        {/* Module nav skeleton */}
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

      <div className="space-y-6 sm:space-y-8">
        {/* Hero Banner - Always visible */}
        <BannerWidget />

        {/* Quick Actions Bar - Streamlined horizontal bar */}
        <Card className="p-4 sm:p-6 border border-border/50">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 flex-1 min-w-0 scrollbar-hide">
              {quickActions.map((action, index) => (
                <motion.div
                  key={action.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex-shrink-0"
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={action.onClick}
                    className={`flex items-center gap-1.5 sm:gap-2 rounded-full px-2.5 sm:px-4 py-1.5 sm:py-2 ${action.bgColor} whitespace-nowrap touch-target`}
                  >
                    <action.icon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${action.color}`} />
                    <span className="text-xs sm:text-sm font-medium">{action.label}</span>
                  </Button>
                </motion.div>
              ))}
            </div>
            
            {/* Rari Quick Access */}
            <Button
              onClick={() => onModuleClick('core')}
              className="flex items-center gap-1.5 sm:gap-2 bg-gradient-to-r from-gulf-blue to-accent text-white rounded-full px-3 sm:px-4 py-1.5 sm:py-2 shadow-md hover:shadow-lg transition-all shrink-0"
            >
              <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="text-xs sm:text-sm font-medium hidden xs:inline">Ask Rari</span>
            </Button>
          </div>
        </Card>

        {/* Hero Metrics - Always visible (Key Performance Indicators) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Key Performance</h2>
              {vehicles.length > 0 && <Badge variant="secondary" className="text-xs">Live</Badge>}
            </div>
          </div>
          <MetricsWidget 
            hasFleetData={vehicles.length > 0}
            activeBookings={bookings.filter(b => b.status === 'active' || b.status === 'confirmed').length}
            utilization={vehicles.length > 0 ? Math.round((vehicles.filter(v => v.status === 'rented').length / vehicles.length) * 100) : 0}
            averageRate={vehicles.length > 0 ? Math.round(vehicles.reduce((acc, v) => acc + v.current_rate, 0) / vehicles.length) : 0}
            onAddVehicle={() => setShowAddVehicleDialog(true)}
          />
        </div>

        {/* Toggle Insights Button - Always visible */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex justify-center"
        >
          <Button
            variant="outline"
            size="lg"
            onClick={handleToggleInsights}
            className="w-full sm:w-auto min-w-[280px] border-2 border-dashed hover:border-primary hover:bg-primary/5 transition-all group"
          >
            <Sparkles className="h-4 w-4 mr-2 group-hover:rotate-12 transition-transform" />
            {showAllInsights ? "Show Less" : "Show More Insights"}
            <motion.div
              animate={{ rotate: showAllInsights ? 180 : 0 }}
              transition={{ duration: 0.3 }}
              className="ml-2"
            >
              <ChevronDown className="h-4 w-4" />
            </motion.div>
          </Button>
        </motion.div>

        {/* Additional Insights - Collapsible sections (hidden by default) */}
        <AnimatePresence mode="wait">
          {showAllInsights && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
              className="space-y-6 sm:space-y-8 overflow-hidden"
            >
            {/* AI Insight - Collapsible */}
            <CollapsibleSection
              title="AI Recommendations"
              icon={<Sparkles className="h-4 w-4" />}
              defaultOpen={isSectionExpanded("ai-insight")}
              badge={<Badge className="bg-success/10 text-success border-success/20 text-xs">1 New</Badge>}
            >
              <div className="pt-4">
                <AIInsightWidget 
                  onApplyOptimization={() => setShowOptimizationDialog(true)}
                  onViewAnalysis={() => onModuleClick('motoriq')}
                  hasFleetData={vehicles.length > 0}
                  onAddVehicle={() => setShowAddVehicleDialog(true)}
                  vehicleName={vehicles[0]?.name || "your vehicle"}
                  suggestedIncrease={15}
                  potentialRevenue={vehicles.length > 0 ? Math.round(vehicles[0]?.current_rate * 0.15 * 30) : 0}
                  probability={vehicles.length > 0 ? 89 : 0}
                />
              </div>
            </CollapsibleSection>

            {/* Revenue Analytics - Collapsible */}
            <CollapsibleSection
              title="Revenue Analytics"
              icon={<DollarSign className="h-4 w-4" />}
              defaultOpen={isSectionExpanded("revenue")}
            >
              <div className="pt-4" data-tour="revenue-widget">
                <RevenueWidget />
              </div>
            </CollapsibleSection>

            {/* Fleet & Schedule Grid - Collapsible */}
            <CollapsibleSection
              title="Fleet Status & Schedule"
              icon={<Car className="h-4 w-4" />}
              defaultOpen={isSectionExpanded("fleet-schedule")}
              badge={<Badge variant="outline" className="text-xs">Today</Badge>}
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 pt-4">
                <FleetStatusWidget onViewAll={() => onModuleClick('motoriq')} />
                <ScheduleWidget onViewCalendar={() => onModuleClick('book')} />
              </div>
            </CollapsibleSection>
          </motion.div>
        )}
        </AnimatePresence>

        {/* Module Navigation Cards */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          {[
            { id: 'book', name: 'Bookings', icon: Calendar, color: 'text-primary' },
            { id: 'motoriq', name: 'MotorIQ', icon: TrendingUp, color: 'text-success' },
            { id: 'vault', name: 'Vault', icon: FileText, color: 'text-warning' },
            { id: 'pulse', name: 'Pulse', icon: DollarSign, color: 'text-accent' },
          ].map((module) => (
            <button
              key={module.id}
              onClick={() => onModuleClick(module.id)}
              className="flex items-center justify-between p-4 sm:p-6 rounded-lg sm:rounded-xl border border-border bg-card hover:bg-muted/50 hover:border-primary/30 transition-all group touch-target"
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <module.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${module.color}`} />
                <span className="font-medium text-xs sm:text-sm">{module.name}</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </button>
          ))}
        </div>
      </div>
    </>
  );
};