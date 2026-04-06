import { useState, useEffect, useRef } from "react";
import { useProfile } from "@/hooks/useProfile";
import { useSearchParams, useLocation, useNavigate } from "react-router-dom";
import { pathToModuleId, moduleIdToPath, MODULE_TITLES } from "@/lib/moduleRoutes";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/ui/logo";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { SkipNavigation } from "@/components/common/SkipNavigation";
import { SEOHead } from "@/components/common/SEOHead";
import { UnifiedNotificationCenter } from "@/components/common/UnifiedNotificationCenter";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { LocationContextBanner } from "@/components/common/LocationBadge";
import { InteractiveModuleTour } from "@/components/onboarding/InteractiveModuleTour";
import { AutomatedDemoTour } from "@/components/onboarding/AutomatedDemoTour";
import { PostTourChoiceModal } from "@/components/onboarding/PostTourChoiceModal";
import { TourDataProvider, useTourData } from "@/contexts/TourDataContext";
import { useAnalytics } from "@/lib/analytics";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useUserRole } from "@/hooks/useUserRole";
import { useRariSidebar } from "@/hooks/useRariSidebar";
import { performance } from "@/lib/performance";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Calendar, 
  Brain, 
  Users,
  BarChart3,
  Home,
  Eye,
  MessageSquare
} from "lucide-react";
import { MotorIQEnhanced } from "@/components/dashboard/MotorIQEnhanced";
import { PulseEnhanced } from "@/components/dashboard/PulseEnhanced";
import { BookEnhanced } from "@/components/dashboard/BookEnhanced";
import { VaultEnhanced } from "@/components/dashboard/VaultEnhanced";
import { CoreEnhanced } from "@/components/dashboard/CoreEnhanced";
import { FleetPageEnhanced } from "@/components/fleet/FleetPageEnhanced";
import { DashboardOverviewEnhanced } from "@/components/dashboard/DashboardOverviewEnhanced";
import { DashboardSidebarEnhanced } from "@/components/dashboard/DashboardSidebarEnhanced";
import { SettingsLayout } from "@/components/dashboard/settings/SettingsLayout";
import { KeyboardShortcutsHelp } from "@/components/common/KeyboardShortcutsHelp";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { MobileMoreMenu } from "@/components/mobile/MobileMoreMenu";
import { FloatingActionMenu } from "@/components/mobile/FloatingActionMenu";
import { TeamHub } from "@/components/dashboard/TeamHub";
import { TeamMessaging } from "@/components/messaging/TeamMessaging";
import { useTeamMessaging } from "@/hooks/useTeamMessaging";
import { useTeam } from "@/contexts/TeamContext";
import { Calendar as CalendarIcon, DollarSign, UserPlus, FileText, Sparkles } from "lucide-react";
import { RariSidebar } from "@/components/rari/RariSidebar";
import { AddLocationDialog } from "@/components/dialogs/AddLocationDialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const DashboardInner = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const nav = useNavigate();
  const activeModule = pathToModuleId(location.pathname);
  const [, setStoredModule] = useLocalStorage("activeModule", "dashboard");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMinimized, setChatMinimized] = useState(false);
  const [mobileAddLocationOpen, setMobileAddLocationOpen] = useState(false);
  const rariSidebar = useRariSidebar();
  const { showPostTourModal, setShowPostTourModal } = useTourData();
  const { displayName } = useProfile();

  // Ensure module transition overlay never gets stuck
  useEffect(() => {
    setIsModuleTransitioning(false);
  }, [activeModule]);
  
  // Keyboard shortcuts with Rari toggle
  useKeyboardShortcuts({ onToggleRari: rariSidebar.toggle });
  const { track, page } = useAnalytics();
  const { isReadOnly, hasRoleOrHigher, loading: roleLoading } = useUserRole();
  const { conversations } = useTeamMessaging();
  const { refreshTeam } = useTeam();
  const containerRef = useRef<HTMLDivElement>(null);
  const moduleTransitionTimeoutRef = useRef<number | null>(null);

  // Always start at dashboard module on new browser session
  useEffect(() => {
    const isInitialLoad = !sessionStorage.getItem('dashboard_initialized');
    if (isInitialLoad) {
      setActiveModule('dashboard');
      sessionStorage.setItem('dashboard_initialized', 'true');
    }
  }, []);

  // Clean up session flag on browser/tab close
  useEffect(() => {
    const handleBeforeUnload = () => {
      sessionStorage.removeItem('dashboard_initialized');
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);
  
  // Get user ID for welcome video
  const [userId, setUserId] = useState<string | null>(null);
  
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id || null);
    });
  }, []);

  // Calculate total unread messages
  const totalUnread = conversations.reduce((acc, c) => acc + (c.unread_count || 0), 0);

  // Read module from URL query params (reliable, no race conditions)
  useEffect(() => {
    const moduleFromUrl = searchParams.get('module');
    if (moduleFromUrl) {
      handleModuleChange(moduleFromUrl);
    }
  }, [searchParams]);

  useEffect(() => {
    performance.mark('dashboard-load-start');
    page('/dashboard');
    
    return () => {
      performance.mark('dashboard-load-end');
      performance.measure('dashboard-load-time', 'dashboard-load-start', 'dashboard-load-end');
    };
  }, [page]);

  // Module transition state for loading feedback
  const [isModuleTransitioning, setIsModuleTransitioning] = useState(false);
  
  // Handle module change - special case for messages opens chat instead
  const handleModuleChange = (moduleId: string) => {
    if (moduleId === 'messages') {
      setChatOpen(true);
      setChatMinimized(false);
      return;
    }

    // No-op if already on this module (prevents stuck overlays)
    if (moduleId === activeModule) return;

    // Clear any pending transition timer
    if (moduleTransitionTimeoutRef.current) {
      window.clearTimeout(moduleTransitionTimeoutRef.current);
      moduleTransitionTimeoutRef.current = null;
    }

    setIsModuleTransitioning(true);
    track('module_switch', { from: activeModule, to: moduleId });
    setActiveModule(moduleId);

    // Scroll to top of page smoothly
    window.scrollTo({ top: 0, behavior: 'smooth' });
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });

    // Clear transition state after brief delay
    moduleTransitionTimeoutRef.current = window.setTimeout(() => {
      setIsModuleTransitioning(false);
      moduleTransitionTimeoutRef.current = null;
    }, 200);
  };

  const moduleNames: Record<string, string> = {
    dashboard: "Dashboard",
    core: "FleetCopilot™",
    book: "Book",
    pulse: "Pulse",
    motoriq: "MotorIQ",
    vault: "Vault",
    settings: "Settings",
    "team-hub": "Team Hub",
    messages: "Messages",
  };

  // FAB actions filtered by role - operational only (Rari has dedicated FAB on desktop, AI tab on mobile)
  const allFabActions = [
    {
      id: "new-booking",
      label: "New Booking",
      icon: <CalendarIcon className="h-4 w-4" />,
      onClick: () => handleModuleChange("book"),
      color: "bg-primary text-primary-foreground",
      minRole: 'operator' as const,
    },
    {
      id: "insights",
      label: "View Insights",
      icon: <BarChart3 className="h-4 w-4" />,
      onClick: () => handleModuleChange("pulse"),
      color: "bg-accent text-accent-foreground",
      minRole: 'operator' as const,
    },
  ];

  // Filter FAB actions based on role
  const fabActions = allFabActions.filter(action => 
    !action.minRole || hasRoleOrHigher(action.minRole)
  );

  const renderModuleContent = () => {
    const pageVariants = {
      initial: { opacity: 0, x: 50 },
      in: { opacity: 1, x: 0 },
      out: { opacity: 0, x: -50 }
    };

    const pageTransition = {
      type: "tween" as const,
      ease: "anticipate" as const,
      duration: 0.3
    };

    let content;
    switch (activeModule) {
      case "motoriq":
      case "optimize":
        content = <MotorIQEnhanced />;
        break;
      case "pulse":
        content = <PulseEnhanced />;
        break;
      case "book":
        content = <BookEnhanced />;
        break;
      case "vault":
        content = <VaultEnhanced />;
        break;
      case "core":
        content = <CoreEnhanced />;
        break;
      case "fleet":
        content = <FleetPageEnhanced />;
        break;
      case "settings":
        content = <SettingsLayout />;
        break;
      case "team-hub":
      case "activity": // Redirect legacy route
        content = <TeamHub />;
        break;
      default:
        content = <DashboardOverviewEnhanced onModuleClick={handleModuleChange} />;
    }

    return (
      <div className="relative">
        {/* Subtle loading overlay during module transition */}
        <AnimatePresence>
          {isModuleTransitioning && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="absolute inset-0 bg-background/50 z-10 flex items-center justify-center"
            >
              <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </motion.div>
          )}
        </AnimatePresence>
        
        <AnimatePresence mode="wait">
          <motion.div
            key={activeModule}
            initial="initial"
            animate="in"
            exit="out"
            variants={pageVariants}
            transition={pageTransition}
          >
            {content}
          </motion.div>
        </AnimatePresence>
      </div>
    );
  };


  return (
    <div className="min-h-screen bg-background mobile-friendly flex">
      <KeyboardShortcutsHelp />
      
      {/* Interactive Module Tour */}
      <InteractiveModuleTour onModuleChange={handleModuleChange} />
      
      {/* Rari-narrated Automated Demo Tour */}
      <AutomatedDemoTour onModuleChange={handleModuleChange} />
      
      {/* Post-tour choice modal */}
      <PostTourChoiceModal
        open={showPostTourModal}
        onAddVehicle={() => {
          setShowPostTourModal(false);
          handleModuleChange('dashboard');
          // Dispatch event to open add vehicle dialog in dashboard
          setTimeout(() => window.dispatchEvent(new Event('open-add-vehicle')), 300);
        }}
        onImportFleet={() => {
          setShowPostTourModal(false);
          handleModuleChange('dashboard');
          setTimeout(() => window.dispatchEvent(new Event('open-import-wizard')), 300);
        }}
        onExplore={() => {
          setShowPostTourModal(false);
          handleModuleChange('dashboard');
        }}
      />
      <SEOHead
        title="Fleet Management Dashboard"
        description="Manage your luxury fleet with comprehensive analytics, AI-powered insights, and real-time monitoring."
        noIndex={true}
      />
      <SkipNavigation />
      
      {/* View Only Badge for Viewers */}
      {isReadOnly && !roleLoading && (
        <div className="fixed top-4 right-4 z-50 md:top-20">
          <Badge variant="secondary" className="flex items-center gap-1.5 px-3 py-1.5 shadow-lg">
            <Eye className="h-3.5 w-3.5" />
            View Only Mode
          </Badge>
        </div>
      )}
      
      {/* Desktop Sidebar - Enhanced with grouped navigation */}
      <DashboardSidebarEnhanced 
        activeModule={activeModule}
        onModuleChange={handleModuleChange}
        onOpenRari={rariSidebar.open}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Desktop Header */}
        <div className="hidden md:block">
          <DashboardHeader 
            onOpenChat={() => {
              setChatOpen(true);
              setChatMinimized(false);
            }}
            onOpenRari={(query) => {
              rariSidebar.open();
              // If Rari sidebar supports initial query, pass it here
            }}
          />
        </div>

        {/* Top Navigation - Mobile */}
        <nav className="bg-background border-b border-border sticky top-0 z-40 md:hidden">
        <div className="mobile-padding py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Logo size="md" className="h-8 sm:h-10" />
              {activeModule !== "dashboard" && (
                <Badge variant="outline" className="ml-2 sm:ml-4 text-xs sm:text-sm">
                  {moduleNames[activeModule] || "Dashboard"}
                </Badge>
              )}
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <UnifiedNotificationCenter onNavigate={handleModuleChange} />
              <Button 
                variant="ghost" 
                size="sm" 
                className="touch-target relative"
                onClick={() => {
                  setChatOpen(true);
                  setChatMinimized(false);
                }}
              >
                <MessageSquare className="h-4 w-4" />
                {totalUnread > 0 && (
                  <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold min-w-[16px] h-4 rounded-full flex items-center justify-center px-1">
                    {totalUnread > 99 ? '99+' : totalUnread}
                  </span>
                )}
              </Button>
              <div className="hidden sm:flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-primary rounded-full flex items-center justify-center">
                  <Users className="h-4 w-4 text-primary-foreground" />
                </div>
                <span className="text-sm font-medium">{displayName}</span>
              </div>
            </div>
          </div>
        </div>
      </nav>

        {/* Mobile Bottom Navigation - 4 Items + More Menu */}
        <div className="mobile-nav">
          <div className="grid grid-cols-4 gap-1 px-2 py-2.5">
            {[
              { id: "dashboard", label: "Home", icon: Home },
              { id: "book", label: "Book", icon: Calendar },
              { id: "core", label: "AI", icon: Brain },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeModule === item.id;
              
              return (
                <motion.button
                  key={item.id}
                  onClick={() => {
                    handleModuleChange(item.id);
                    if (navigator.vibrate) navigator.vibrate(10);
                  }}
                  whileTap={{ scale: 0.92 }}
                  className={cn(
                    "flex flex-col items-center justify-center py-2 px-1 rounded-2xl transition-colors min-h-[56px]",
                    isActive 
                      ? "bg-primary text-primary-foreground shadow-sm" 
                      : "text-muted-foreground active:bg-muted/50"
                  )}
                  aria-label={item.label}
                >
                  <Icon className="h-5 w-5 mb-0.5" strokeWidth={isActive ? 2.5 : 2} />
                  <span className="text-[10px] font-semibold tracking-tight">{item.label}</span>
                </motion.button>
              );
            })}

            {/* More Menu - Contains Vault, Settings, Profile */}
            <MobileMoreMenu 
              activeModule={activeModule}
              onModuleChange={handleModuleChange}
              onAddLocation={() => setMobileAddLocationOpen(true)}
            />
          </div>
        </div>

        {/* Floating Action Button for quick actions - hide in Settings */}
        {activeModule !== "settings" && <FloatingActionMenu actions={fabActions} />}

        {/* Main Content */}
        <main
          id="main-content" 
          ref={containerRef}
          className="mobile-padding py-4 sm:py-6 pb-28 md:pb-6 overflow-x-hidden flex-1" 
          tabIndex={-1}
        >
          <div className="max-w-7xl mx-auto mobile-spacing">
            <LocationContextBanner className="mb-4" />
            {renderModuleContent()}
          </div>
        </main>
      </div>

      {/* Team Messaging - Floating Chat with Error Boundary */}
      <ErrorBoundary fallback={null}>
        <TeamMessaging
          isOpen={chatOpen}
          onClose={() => setChatOpen(false)}
          isMinimized={chatMinimized}
          onToggleMinimize={() => setChatMinimized(!chatMinimized)}
        />
      </ErrorBoundary>

      {/* Rari AI Assistant - Sidebar has Rari button, floating FAB removed on desktop */}
      <ErrorBoundary fallback={null}>
        <RariSidebar
          state={rariSidebar.state}
          isActiveCall={rariSidebar.isActiveCall}
          context={rariSidebar.context}
          contextLabel={rariSidebar.contextLabel}
          contextSummary={rariSidebar.contextSummary}
          recentEntities={rariSidebar.recentEntities}
          unreadCount={rariSidebar.unreadCount}
          urgentCount={rariSidebar.urgentCount}
          highCount={rariSidebar.highCount}
          onOpen={rariSidebar.open}
          onClose={rariSidebar.close}
          onMinimize={rariSidebar.minimize}
          onToggle={rariSidebar.toggle}
          onClearContext={rariSidebar.clearContext}
          onActiveCallChange={rariSidebar.setActiveCall}
        />
      </ErrorBoundary>

      {/* Mobile Add Location Dialog */}
      <AddLocationDialog
        open={mobileAddLocationOpen}
        onOpenChange={setMobileAddLocationOpen}
        onSuccess={async () => {
          setMobileAddLocationOpen(false);
          await refreshTeam();
        }}
      />
    </div>
  );
};

const Dashboard = () => (
  <TourDataProvider>
    <DashboardInner />
  </TourDataProvider>
);

export default Dashboard;