import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { useProfile } from "@/hooks/useProfile";
import { useSearchParams, useLocation, useNavigate } from "react-router-dom";
import { pathToModuleId, moduleIdToPath, MODULE_TITLES } from "@/lib/moduleRoutes";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/ui/logo";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { SkipNavigation } from "@/components/common/SkipNavigation";
import { SEOHead } from "@/components/common/SEOHead";
import {
  SkeletonBanner, SkeletonStatsRow, SkeletonModuleNav, SkeletonQuickActions,
  SkeletonScheduleItem, SkeletonVehicleCard, SkeletonSection, SkeletonAIInsight,
  SkeletonDocumentRow
} from "@/components/ui/skeleton-specialized";
import { UnifiedNotificationCenter } from "@/components/common/UnifiedNotificationCenter";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { LocationContextBanner } from "@/components/common/LocationBadge";
import { PaymentDueBanner } from "@/components/dashboard/PaymentDueBanner";
import { ComplianceBanner } from "@/components/compliance/ComplianceBanner";
import { InteractiveModuleTour } from "@/components/onboarding/InteractiveModuleTour";
import { AutomatedDemoTour } from "@/components/onboarding/AutomatedDemoTour";
import { PostTourChoiceModal } from "@/components/onboarding/PostTourChoiceModal";
import { TourDataProvider, useTourData } from "@/contexts/TourDataContext";
import { useAnalytics } from "@/lib/analytics";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useUserRole } from "@/hooks/useUserRole";
import { useRariSidebar } from "@/hooks/useRariSidebar";
import { performance } from "@/lib/performance";
import { motion } from "framer-motion";
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
// Lazy-loaded dashboard modules for code splitting
const MotorIQEnhanced = lazy(() => import('@/components/dashboard/MotorIQEnhanced'));
const PulseEnhanced = lazy(() => import('@/components/dashboard/PulseEnhanced'));
const BookEnhanced = lazy(() => import('@/components/dashboard/BookEnhanced'));
const VaultEnhanced = lazy(() => import('@/components/dashboard/VaultEnhanced'));
const CoreEnhanced = lazy(() => import('@/components/dashboard/CoreEnhanced'));
const FleetPageEnhanced = lazy(() => import('@/components/fleet/FleetPageEnhanced'));
const DashboardOverviewEnhanced = lazy(() => import('@/components/dashboard/DashboardOverviewEnhanced'));
const SettingsLayout = lazy(() => import('@/components/dashboard/settings/SettingsLayout'));
const TeamHub = lazy(() => import('@/components/dashboard/TeamHub'));
const TeamMessaging = lazy(() => import('@/components/messaging/TeamMessaging'));
const MarginEnhanced = lazy(() => import('@/components/dashboard/MarginEnhanced'));

import { DashboardSidebarEnhanced } from "@/components/dashboard/DashboardSidebarEnhanced";
import { KeyboardShortcutsHelp } from "@/components/common/KeyboardShortcutsHelp";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { MobileMoreMenu } from "@/components/mobile/MobileMoreMenu";
import { FloatingActionMenu } from "@/components/mobile/FloatingActionMenu";
import { useTeamMessaging } from "@/hooks/useTeamMessaging";
import { useTeam } from "@/contexts/TeamContext";
import { useAuth } from "@/contexts/AuthContext";
import { Calendar as CalendarIcon, DollarSign, UserPlus, FileText, Sparkles } from "lucide-react";
import { RariSidebar } from "@/components/rari/RariSidebar";
import { AddLocationDialog } from "@/components/dialogs/AddLocationDialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { TrialBanner } from "@/components/trial/TrialBanner";

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
  const { user } = useAuth();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // Sync localStorage for backwards compat (tours read it)
  useEffect(() => {
    setStoredModule(activeModule);
  }, [activeModule]);
  
  // Keyboard shortcuts with Rari toggle
  useKeyboardShortcuts({ onToggleRari: rariSidebar.toggle });
  const { track, page } = useAnalytics();
  const { isReadOnly, hasRoleOrHigher, loading: roleLoading } = useUserRole();
  const { conversations } = useTeamMessaging();
  const { refreshTeam } = useTeam();
  const containerRef = useRef<HTMLDivElement>(null);

  // Backwards compat: redirect legacy ?module= URLs to path-based
  useEffect(() => {
    const moduleFromUrl = searchParams.get('module');
    if (moduleFromUrl) {
      const newPath = moduleIdToPath(moduleFromUrl);
      // Preserve other query params (bookingId, customerId, etc.)
      const params = new URLSearchParams(searchParams);
      params.delete('module');
      const qs = params.toString();
      nav(qs ? `${newPath}?${qs}` : newPath, { replace: true });
    }
  }, [searchParams, nav]);

  // Stripe Connect onboarding return handler — Stripe redirects tenants back
  // to /dashboard?stripe_onboard=complete or ?stripe_refresh=true after the
  // hosted flow. Webhooks normally fire within seconds, so we poll briefly to
  // surface the activated state without making the user hunt for "Refresh".
  useEffect(() => {
    const stripeOnboard = searchParams.get('stripe_onboard');
    const stripeRefresh = searchParams.get('stripe_refresh');
    if (!stripeOnboard && !stripeRefresh) return;

    let cancelled = false;
    (async () => {
      if (stripeOnboard === 'complete') {
        toast.success("Connecting your Stripe account", {
          description: "Stripe is verifying your details. This usually takes under a minute.",
        });
      } else if (stripeRefresh === 'true') {
        toast.info("Resume Stripe setup", {
          description: "Pick up where you left off in Settings → Payments.",
        });
      }

      // Strip the params and route to the Payments tab so the badge is visible.
      nav('/dashboard/settings?tab=payments', { replace: true });

      // Poll for up to 60s for the webhook to flip charges_enabled.
      for (let i = 0; i < 12 && !cancelled; i++) {
        await refreshTeam();
        await new Promise((r) => setTimeout(r, 5000));
      }
    })();

    return () => {
      cancelled = true;
    };
    // Only run once on mount when params are present; refreshTeam ref is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // Get user ID for welcome video
  const [userId, setUserId] = useState<string | null>(null);
  
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id || null);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!user?.id) {
      setIsSuperAdmin(false);
      return;
    }

    supabase.rpc('is_super_admin', { check_user_id: user.id }).then(({ data }) => {
      if (!cancelled) setIsSuperAdmin(data === true);
    });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Calculate total unread messages
  const totalUnread = conversations.reduce((acc, c) => acc + (c.unread_count || 0), 0);

  // Legacy ?module= redirect is handled above

  useEffect(() => {
    performance.mark('dashboard-load-start');
    page('/dashboard');
    
    return () => {
      performance.mark('dashboard-load-end');
      performance.measure('dashboard-load-time', 'dashboard-load-start', 'dashboard-load-end');
    };
  }, [page]);

  // Handle module change - special case for messages opens chat instead
  const handleModuleChange = (moduleId: string) => {
    if (moduleId === 'super-admin') {
      nav('/super-admin');
      return;
    }

    if (moduleId === 'messages') {
      setChatOpen(true);
      setChatMinimized(false);
      return;
    }

    track('module_switch', { from: activeModule, to: moduleId });
    nav(moduleIdToPath(moduleId));

    // Scroll to top of page smoothly
    window.scrollTo({ top: 0, behavior: 'smooth' });
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const moduleNames: Record<string, string> = {
    dashboard: "Dashboard",
    core: "FleetCopilot™",
    book: "Book",
    pulse: "Pulse",
    motoriq: "MotorIQ",
    vault: "Vault",
    margin: "Margin",
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

  const getModuleSkeleton = (moduleId: string) => {
    switch (moduleId) {
      case "dashboard":
        return (
          <div className="space-y-4 p-4">
            <SkeletonBanner />
            <SkeletonStatsRow count={4} />
            <SkeletonModuleNav count={4} />
          </div>
        );
      case "book":
        return (
          <div className="space-y-4 p-4">
            <SkeletonQuickActions count={4} />
            <SkeletonScheduleItem />
            <SkeletonScheduleItem />
            <SkeletonScheduleItem />
          </div>
        );
      case "fleet":
        return (
          <div className="space-y-4 p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1,2,3,4].map(i => <SkeletonVehicleCard key={i} />)}
            </div>
          </div>
        );
      case "pulse":
        return (
          <div className="space-y-4 p-4">
            <SkeletonStatsRow count={4} />
            <SkeletonSection contentHeight={280} />
          </div>
        );
      case "motoriq":
      case "optimize":
        return (
          <div className="space-y-4 p-4">
            <SkeletonAIInsight />
            <SkeletonStatsRow count={3} />
          </div>
        );
      case "vault":
        return (
          <div className="space-y-4 p-4">
            <SkeletonQuickActions count={3} />
            <SkeletonDocumentRow />
            <SkeletonDocumentRow />
            <SkeletonDocumentRow />
          </div>
        );
      case "core":
        return (
          <div className="space-y-4 p-4">
            <SkeletonAIInsight />
          </div>
        );
      default:
        return (
          <div className="space-y-4 p-4 animate-pulse">
            <div className="h-8 bg-muted rounded w-1/3" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[1,2,3,4].map(i => <div key={i} className="h-24 bg-muted rounded-lg" />)}
            </div>
            <div className="h-64 bg-muted rounded-lg" />
          </div>
        );
    }
  };

  const renderModuleContent = () => {
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
      case "margin":
        content = <MarginEnhanced />;
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
      <Suspense fallback={getModuleSkeleton(activeModule)}>
        <div key={activeModule} className="animate-fade-in-up">
          {content}
        </div>
      </Suspense>
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
        title={MODULE_TITLES[activeModule] ? MODULE_TITLES[activeModule].replace(' | Exotiq.ai', '') : 'Dashboard'}
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
        isSuperAdmin={isSuperAdmin}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Trial status banner (hidden for grandfathered teams and paid subscribers) */}
        <TrialBanner />
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
                aria-label={totalUnread > 0 ? `Team messages, ${totalUnread} unread` : 'Team messages'}
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
              isSuperAdmin={isSuperAdmin}
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
            <PaymentDueBanner />
            <ComplianceBanner />
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