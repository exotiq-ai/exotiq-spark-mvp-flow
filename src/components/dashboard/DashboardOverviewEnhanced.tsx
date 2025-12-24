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
import { NewBookingDialog } from "@/components/dialogs/NewBookingDialog";
import { AddCustomerDialog } from "@/components/dialogs/AddCustomerDialog";
import { GenerateReportDialog } from "@/components/dialogs/GenerateReportDialog";
import { ScheduleMaintenanceDialog } from "@/components/dialogs/ScheduleMaintenanceDialog";
import { RecordPaymentDialog } from "@/components/dialogs/RecordPaymentDialog";
import { useFleet } from "@/contexts/FleetContext";
import { DemoOnboarding } from "@/components/demo/DemoOnboarding";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { motion } from "framer-motion";
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
  ChevronRight
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
  
  const { vehicles, bookings, applyPriceOptimization, createBooking, createCustomer, generateReport, createMaintenance, createPayment } = useFleet();
  
  // Collapsible state persistence
  const [expandedSections, setExpandedSections] = useLocalStorage<string[]>("dashboardSections", [
    "metrics", "ai-insight", "fleet-schedule"
  ]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev =>
      prev.includes(sectionId)
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const isSectionExpanded = (sectionId: string) => expandedSections.includes(sectionId);

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

      <div className="space-y-6">
        {/* Hero Banner - Always visible */}
        <BannerWidget />

        {/* Quick Actions Bar - Streamlined horizontal bar */}
        <Card className="p-4 border border-border/50">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {quickActions.map((action, index) => (
                <motion.div
                  key={action.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={action.onClick}
                    className={`flex items-center gap-2 rounded-full px-4 py-2 ${action.bgColor} whitespace-nowrap`}
                  >
                    <action.icon className={`h-4 w-4 ${action.color}`} />
                    <span className="text-sm font-medium">{action.label}</span>
                  </Button>
                </motion.div>
              ))}
            </div>
            
            {/* Rari Quick Access */}
            <Button
              onClick={() => onModuleClick('core')}
              className="flex items-center gap-2 bg-gradient-to-r from-gulf-blue to-accent text-white rounded-full px-4 py-2 shadow-md hover:shadow-lg transition-all shrink-0"
            >
              <Sparkles className="h-4 w-4" />
              <span className="text-sm font-medium hidden sm:inline">Ask Rari</span>
            </Button>
          </div>
        </Card>

        {/* Key Metrics - Collapsible */}
        <CollapsibleSection
          title="Key Performance"
          icon={<TrendingUp className="h-4 w-4" />}
          defaultOpen={isSectionExpanded("metrics")}
          badge={<Badge variant="secondary" className="text-xs">Live</Badge>}
        >
          <div className="pt-4">
            <MetricsWidget />
          </div>
        </CollapsibleSection>

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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-4">
            <FleetStatusWidget onViewAll={() => onModuleClick('motoriq')} />
            <ScheduleWidget onViewCalendar={() => onModuleClick('book')} />
          </div>
        </CollapsibleSection>

        {/* Module Navigation Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { id: 'book', name: 'Bookings', icon: Calendar, color: 'text-primary' },
            { id: 'motoriq', name: 'MotorIQ', icon: TrendingUp, color: 'text-success' },
            { id: 'vault', name: 'Vault', icon: FileText, color: 'text-warning' },
            { id: 'pulse', name: 'Pulse', icon: DollarSign, color: 'text-accent' },
          ].map((module) => (
            <button
              key={module.id}
              onClick={() => onModuleClick(module.id)}
              className="flex items-center justify-between p-4 rounded-xl border border-border bg-card hover:bg-muted/50 hover:border-primary/30 transition-all group"
            >
              <div className="flex items-center gap-3">
                <module.icon className={`h-5 w-5 ${module.color}`} />
                <span className="font-medium text-sm">{module.name}</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </button>
          ))}
        </div>
      </div>
    </>
  );
};