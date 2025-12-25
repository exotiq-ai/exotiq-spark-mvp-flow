import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/ui/logo";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { SkipNavigation } from "@/components/common/SkipNavigation";
import { SEOHead } from "@/components/common/SEOHead";
import { UnifiedNotificationCenter } from "@/components/common/UnifiedNotificationCenter";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { useAnalytics } from "@/lib/analytics";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useUserRole } from "@/hooks/useUserRole";
import { performance } from "@/lib/performance";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Calendar, 
  Brain, 
  Users,
  Settings,
  BarChart3,
  Home,
  Eye
} from "lucide-react";
import { MotorIQEnhanced } from "@/components/dashboard/MotorIQEnhanced";
import { PulseEnhanced } from "@/components/dashboard/PulseEnhanced";
import { BookEnhanced } from "@/components/dashboard/BookEnhanced";
import { VaultEnhanced } from "@/components/dashboard/VaultEnhanced";
import { CoreEnhanced } from "@/components/dashboard/CoreEnhanced";
import { DashboardOverviewEnhanced } from "@/components/dashboard/DashboardOverviewEnhanced";
import { DashboardSidebarEnhanced } from "@/components/dashboard/DashboardSidebarEnhanced";
import { SettingsLayout } from "@/components/dashboard/settings/SettingsLayout";
import { KeyboardShortcutsHelp } from "@/components/common/KeyboardShortcutsHelp";
import { MobileMoreMenu } from "@/components/mobile/MobileMoreMenu";
import { FloatingActionMenu } from "@/components/mobile/FloatingActionMenu";
import { TeamActivityDashboard } from "@/components/dashboard/TeamActivityDashboard";
import { TeamMessaging, TeamMessagingTrigger } from "@/components/messaging/TeamMessaging";
import { useTeamMessaging } from "@/hooks/useTeamMessaging";
import { Calendar as CalendarIcon, DollarSign, UserPlus, FileText } from "lucide-react";

const Dashboard = () => {
  const [activeModule, setActiveModule] = useLocalStorage("activeModule", "dashboard");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMinimized, setChatMinimized] = useState(false);
  const { track, page } = useAnalytics();
  const { isReadOnly, hasRoleOrHigher, loading: roleLoading } = useUserRole();
  const { conversations } = useTeamMessaging();
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate total unread messages
  const totalUnread = conversations.reduce((acc, c) => acc + (c.unread_count || 0), 0);

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
    if (moduleId === 'messages') {
      setChatOpen(true);
      setChatMinimized(false);
      return;
    }
    track('module_switch', { from: activeModule, to: moduleId });
    setActiveModule(moduleId);
  };

  const moduleNames: Record<string, string> = {
    dashboard: "Dashboard",
    core: "FleetCopilot™",
    book: "Book",
    pulse: "Pulse",
    motoriq: "MotorIQ",
    vault: "Vault",
    settings: "Settings",
    activity: "Team Activity",
    messages: "Messages",
  };

  // FAB actions filtered by role
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
      id: "ai-assistant",
      label: "Ask AI",
      icon: <Brain className="h-4 w-4" />,
      onClick: () => handleModuleChange("core"),
      color: "bg-secondary text-secondary-foreground",
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
      case "settings":
        content = <SettingsLayout />;
        break;
      case "activity":
        content = <TeamActivityDashboard />;
        break;
      default:
        content = <DashboardOverviewEnhanced onModuleClick={handleModuleChange} />;
    }

    return (
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
    );
  };

  return (
    <div className="min-h-screen bg-background mobile-friendly flex">
      <KeyboardShortcutsHelp />
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
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Desktop Header */}
        <div className="hidden md:block">
          <DashboardHeader />
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
              <Button variant="ghost" size="sm" className="touch-target">
                <Settings className="h-4 w-4" />
              </Button>
              <div className="hidden sm:flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-primary rounded-full flex items-center justify-center">
                  <Users className="h-4 w-4 text-primary-foreground" />
                </div>
                <span className="text-sm font-medium">John Doe</span>
              </div>
            </div>
          </div>
        </div>
      </nav>

        {/* Mobile Bottom Navigation - 5 Items (simplified) */}
        <div className="mobile-nav">
          <div className="grid grid-cols-5 gap-1 px-2 py-2.5">
            {[
              { id: "dashboard", label: "Home", icon: Home, minRole: undefined },
              { id: "book", label: "Book", icon: Calendar, minRole: 'operator' as const },
              { id: "core", label: "AI", icon: Brain, minRole: 'operator' as const },
              { id: "pulse", label: "Insights", icon: BarChart3, aliases: ["motoriq", "optimize"], minRole: 'operator' as const },
            ].filter(item => !item.minRole || hasRoleOrHigher(item.minRole)).map((item) => {
              const Icon = item.icon;
              const isActive = item.aliases 
                ? [item.id, ...item.aliases].includes(activeModule)
                : activeModule === item.id;
              
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
            />
          </div>
        </div>

        {/* Floating Action Button for quick actions */}
        <FloatingActionMenu actions={fabActions} />

        {/* Main Content */}
        <main
          id="main-content" 
          ref={containerRef}
          className="mobile-padding py-4 sm:py-6 pb-28 md:pb-6 overflow-x-hidden flex-1" 
          tabIndex={-1}
        >
          <div className="max-w-7xl mx-auto mobile-spacing">
            {renderModuleContent()}
          </div>
        </main>
      </div>

      {/* Team Messaging - Floating Chat with Error Boundary */}
      <ErrorBoundary fallback={null}>
        {!chatOpen && (
          <TeamMessagingTrigger 
            onClick={() => setChatOpen(true)} 
            unreadCount={totalUnread} 
          />
        )}
        
        <TeamMessaging
          isOpen={chatOpen}
          onClose={() => setChatOpen(false)}
          isMinimized={chatMinimized}
          onToggleMinimize={() => setChatMinimized(!chatMinimized)}
        />
      </ErrorBoundary>
    </div>
  );
};

export default Dashboard;