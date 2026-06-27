import { useState, useMemo, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BannerWidget } from "./widgets/BannerWidget";
import { RevenueWidget } from "./widgets/RevenueWidget";
import { CompactMetricsBar } from "./widgets/CompactMetricsBar";
import { CompactAIInsightBanner } from "./widgets/CompactAIInsightBanner";
import { FleetStatusWidget } from "./widgets/FleetStatusWidget";
import { ScheduleWidget } from "./widgets/ScheduleWidget";

import { PriceOptimizationDialog } from "@/components/dialogs/PriceOptimizationDialog";
import { AddVehicleDialog } from "@/components/dialogs/AddVehicleDialog";
import { NewBookingDialog } from "@/components/dialogs/NewBookingDialog";
import { AddCustomerDialog } from "@/components/dialogs/AddCustomerDialog";
import { GenerateReportDialog } from "@/components/dialogs/GenerateReportDialog";
import { ScheduleMaintenanceDialog } from "@/components/dialogs/ScheduleMaintenanceDialog";
import { RecordPaymentDialog } from "@/components/dialogs/RecordPaymentDialog";
import { ImportWizard } from "@/components/import/ImportWizard";
import { GettingStartedChecklist } from "./GettingStartedChecklist";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { useFleetAIInsight } from "@/hooks/useFleetAIInsight";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/contexts/AuthContext";
import { useTeam } from "@/contexts/TeamContext";
import { LocationContextBanner } from "@/components/common/LocationBadge";
import { DemoOnboarding } from "@/components/demo/DemoOnboarding";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useRariSidebar } from "@/hooks/useRariSidebar";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { 
  SkeletonBanner, 
  SkeletonQuickActions, 
  SkeletonModuleNav 
} from "@/components/ui/skeleton-specialized";
import { SkeletonLineChart, SkeletonDonutChart, SkeletonTable } from "@/components/ui/skeleton-card";
import { useUserRole } from "@/hooks/useUserRole";
import { performHardReload, isInRecoveryMode } from "@/lib/staleBuildRecovery";
import { supabase } from "@/integrations/supabase/client";
import { isFeatureEnabled } from "@/lib/featureFlags";
import { DailyBriefCard } from "./DailyBriefCard";
import { PulseStrip } from "./PulseStrip";
import { 
  TrendingUp, 
  Calendar, 
  Car,
  DollarSign,
  Sparkles,
  FileText,
  Plus,
  Upload,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  AlertTriangle,
  RotateCcw,
  LogOut,
  Play
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
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [loadingDuration, setLoadingDuration] = useState(0);
  
  const { vehicles, bookings, loading, error, applyPriceOptimization, createBooking, createCustomer, generateReport, createMaintenance, createPayment, createVehicle, refreshData } = useLocationFilteredFleet();
  const { signOut, loading: authLoading } = useAuth();
  const { profile } = useProfile();
  const { currentTeam, loading: teamLoading, error: teamError } = useTeam();
  const { toast } = useToast();
  const rariSidebar = useRariSidebar();
  const { hasRoleOrHigher: isManagerOrHigher } = useUserRole();
  const navigate = useNavigate();
  const [isRetrying, setIsRetrying] = useState(false);
  const [skippedTour, setSkippedTour] = useState(false);

  // Listen for post-tour events to open dialogs
  useEffect(() => {
    const openVehicle = () => setShowAddVehicleDialog(true);
    const openImport = () => setShowImportWizard(true);
    window.addEventListener('open-add-vehicle', openVehicle);
    window.addEventListener('open-import-wizard', openImport);
    return () => {
      window.removeEventListener('open-add-vehicle', openVehicle);
      window.removeEventListener('open-import-wizard', openImport);
    };
  }, []);

  // Track loading duration to show recovery options if stuck
  useEffect(() => {
    if (loading) {
      setLoadingDuration(0);
      const interval = setInterval(() => {
        setLoadingDuration(d => d + 1);
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setLoadingDuration(0);
    }
  }, [loading]);

  // PHASE 5: Session-aware retry handler
  const handleSessionAwareRetry = useCallback(async () => {
    setIsRetrying(true);
    
    try {
      // First, attempt to refresh the session
      const { error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError) {
        // Session is truly expired, redirect to login
        toast({
          title: 'Session Expired',
          description: 'Redirecting to login...',
          variant: 'destructive',
        });
        window.location.href = '/auth';
        return;
      }
      
      // Session refreshed successfully, retry data fetch
      await refreshData(true);
    } catch (err) {
      // Fallback: just try the data refresh anyway
      await refreshData(true);
    } finally {
      setIsRetrying(false);
    }
  }, [refreshData, toast]);
  
  // Collapsible state persistence (legacy dashboard only)
  const [showFleetSchedule, setShowFleetSchedule] = useLocalStorage<boolean>("dashboardFleetSchedule", false);
  const dailyBriefEnabled = isFeatureEnabled('dailyBrief');

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

  // Get AI insight recommendation based on real fleet data
  const aiInsight = useFleetAIInsight(vehicles, bookings);

  const firstBooking = bookings[0];

  // Loading state with streamlined skeletons and recovery options
  if (loading) {
    const showRecoveryBanner = loadingDuration >= 12;
    const inRecoveryMode = isInRecoveryMode();
    
    return (
      <div className="space-y-4 sm:space-y-6 pb-20 md:pb-24">
        {/* Recovery banner if loading takes too long */}
        {showRecoveryBanner && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-warning/10 border border-warning/30 rounded-lg p-4"
          >
            <div className="flex items-center gap-3 mb-3">
              <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
              <div>
                <p className="font-medium text-foreground">Taking longer than expected</p>
                <p className="text-sm text-muted-foreground">
                  {inRecoveryMode 
                    ? "We already tried refreshing. Try clearing the cache if the issue persists."
                    : `Loading has been running for ${loadingDuration} seconds. Try these recovery options:`
                  }
                </p>
                {/* Diagnostic line: what are we waiting on? */}
                <p className="text-xs text-muted-foreground/70 mt-1 font-mono">
                  Status: {authLoading ? 'auth' : teamLoading ? 'team' : !currentTeam ? 'no-team' : 'fleet-data'}
                  {teamError && ` | Team error: ${teamError}`}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {/* Hard Reload - most reliable fix for stale assets */}
              <Button
                size="sm"
                onClick={() => performHardReload()}
                className="gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Hard Reload
              </Button>
              {/* Session-aware Retry - refreshes session first */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleSessionAwareRetry}
                disabled={isRetrying}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
                {isRetrying ? 'Refreshing...' : 'Refresh & Retry'}
              </Button>
              {/* Clear Cache - nuclear option */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (confirm('This will sign you out and clear all cached data. Continue?')) {
                    // Use direct navigation to bypass React Router issues
                    window.location.href = '/reset';
                  }
                }}
                className="gap-2"
              >
                Clear Cache
              </Button>
              {/* Contact support link for persistent issues */}
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="gap-2 text-muted-foreground"
              >
                <a href="mailto:hello@exotiq.ai?subject=Dashboard%20Loading%20Issue">
                  Contact Support
                </a>
              </Button>
            </div>
          </motion.div>
        )}
        
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

  // Error state - show recovery UI with improved session-aware options
  if (error && !loading) {
    const isTimeoutError = error.includes('Timeout') || error.includes('timeout');
    const isNetworkError = error.includes('network') || error.includes('fetch');
    const isSessionError = error.includes('Session') || error.includes('session') || error.includes('expired');
    
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">Unable to Load Data</h2>
        <p className="text-muted-foreground text-center max-w-md">
          {isSessionError
            ? "Your session may have expired. Try refreshing your session or sign in again."
            : isTimeoutError 
            ? "The connection timed out. This could be a slow network or a temporary issue."
            : isNetworkError
            ? "Network error. Check your internet connection and try again."
            : error}
        </p>
        <div className="flex flex-wrap gap-3 mt-4 justify-center">
          {/* Session-aware Retry - refreshes session first, then retries data */}
          <Button
            onClick={handleSessionAwareRetry}
            disabled={isRetrying}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
            {isRetrying ? 'Refreshing...' : 'Refresh & Retry'}
          </Button>
          
          {/* Hard Reload - most reliable fix for stale assets */}
          <Button
            variant="outline"
            onClick={() => performHardReload()}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Hard Reload
          </Button>
          
          {/* Sign Out & Restart - clean escape hatch for auth issues */}
          <Button
            variant="outline"
            onClick={async () => {
              toast({
                title: 'Signing out...',
                description: 'You will be redirected to the login page.',
              });
              await signOut();
            }}
            className="gap-2"
          >
            <LogOut className="h-4 w-4" />
            Sign Out & Restart
          </Button>
          
          {/* Contact support for persistent issues */}
          {(isTimeoutError || isNetworkError) && (
            <Button
              variant="ghost"
              asChild
              className="gap-2 text-muted-foreground"
            >
              <a href="mailto:hello@exotiq.ai?subject=Dashboard%20Loading%20Error">
                Contact Support
              </a>
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Empty state - show getting started UI for new users
  const firstName = profile?.full_name?.split(' ')[0] || 'there';
  const companyName = profile?.company_name;
  
  if (!loading && vehicles.length === 0) {
    return (
      <div className="space-y-8 pb-20">
        {/* Personalized Welcome */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="flex flex-col items-center justify-center py-12 space-y-4"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 20 }}
            className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center"
          >
            <Sparkles className="h-8 w-8 text-primary" />
          </motion.div>
          <h2 className="text-2xl font-bold text-foreground">
            Welcome, {firstName}! 👋
          </h2>
          <p className="text-muted-foreground text-center max-w-md">
            Let's get {companyName ? <span className="font-medium text-foreground">{companyName}</span> : 'your fleet'} set up and running.
          </p>
          
          {/* Primary CTA: See Exotiq in Action */}
          <div className="flex flex-col items-center gap-3 mt-4">
            <Button
              size="lg"
              onClick={() => window.dispatchEvent(new Event('start-demo-tour'))}
              className="gap-2 min-w-[260px]"
            >
              <Play className="h-5 w-5" />
              See Exotiq in Action
            </Button>
            <button
              onClick={() => setSkippedTour(true)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
            >
              Skip, I'll set up myself
            </button>
          </div>
        </motion.div>

        {/* Show checklist only if they skipped the tour */}
        {skippedTour && (
          <GettingStartedChecklist
            vehicleCount={vehicles.length}
            bookingCount={bookings.length}
            onAddVehicle={() => setShowAddVehicleDialog(true)}
            onImportFleet={() => setShowImportWizard(true)}
            onCreateBooking={() => setShowBookingDialog(true)}
            onStartTour={() => window.dispatchEvent(new Event('start-demo-tour'))}
            onNavigateToTeam={() => onModuleClick('settings')}
          />
        )}
        
        {/* Dialogs */}
        <AddVehicleDialog
          open={showAddVehicleDialog}
          onOpenChange={setShowAddVehicleDialog}
          onSubmit={createVehicle}
        />
        <Dialog open={showImportWizard} onOpenChange={setShowImportWizard}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Import Fleet</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto">
              <ImportWizard 
                onClose={() => setShowImportWizard(false)}
                onComplete={() => {
                  setShowImportWizard(false);
                  refreshData(true);
                }}
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <>
      {/* DemoOnboarding removed - consolidated into InteractiveModuleTour */}
      
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

      {/* Content wrapper */}
      <div className="relative">
        {dailyBriefEnabled ? (
          /* Quiet Command — one decisive surface + quiet supporting context */
          <div className="space-y-8 sm:space-y-10 pb-6 md:pb-24 max-w-5xl">
            <DailyBriefCard onModuleClick={onModuleClick} />
            <PulseStrip onModuleClick={onModuleClick} />
          </div>
        ) : (
          /* Legacy dashboard — byte-identical to before the flag */
          <div className="space-y-5 sm:space-y-6 pb-6 md:pb-24">
            <BannerWidget />

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

            <div className="space-y-3" data-tour="revenue-widget">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-success" />
                <h2 className="font-semibold text-foreground text-sm sm:text-lg">
                  Revenue Analytics
                </h2>
              </div>
              <RevenueWidget />
            </div>

            {aiInsight && (
              <CompactAIInsightBanner
                vehicleName={aiInsight.vehicleName}
                suggestedIncrease={aiInsight.suggestedIncreasePercent}
                potentialRevenue={aiInsight.potentialMonthlyRevenue}
                onApply={isManagerOrHigher('manager') ? () => setShowOptimizationDialog(true) : undefined}
                onViewAnalysis={() => onModuleClick('motoriq')}
                hasFleetData={vehicles.length > 0}
              />
            )}

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
        )}
      </div>
    </>
  );
};

export default DashboardOverviewEnhanced;
