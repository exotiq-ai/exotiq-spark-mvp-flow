import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/ui/logo";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { SkipNavigation } from "@/components/common/SkipNavigation";
import { SEOHead } from "@/components/common/SEOHead";
import { UnifiedNotificationCenter } from "@/components/common/UnifiedNotificationCenter";
import { useAnalytics } from "@/lib/analytics";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";
// Realtime subscriptions now managed directly in FleetContext
// import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { performance } from "@/lib/performance";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, 
  Calendar, 
  Shield, 
  Brain, 
  Users,
  Bell,
  Settings,
  BarChart3,
  MoreHorizontal,
  Home
} from "lucide-react";
import { MotorIQEnhanced } from "@/components/dashboard/MotorIQEnhanced";
import { PulseEnhanced } from "@/components/dashboard/PulseEnhanced";
import { BookEnhanced } from "@/components/dashboard/BookEnhanced";
import { VaultEnhanced } from "@/components/dashboard/VaultEnhanced";
import { CoreEnhanced } from "@/components/dashboard/CoreEnhanced";
import { DashboardOverview } from "@/components/dashboard/DashboardOverview";
import { ModulePagination } from "@/components/dashboard/ModulePagination";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { SettingsLayout } from "@/components/dashboard/settings/SettingsLayout";
import { KeyboardShortcutsHelp } from "@/components/common/KeyboardShortcutsHelp";

const Dashboard = () => {
  const [activeModule, setActiveModule] = useLocalStorage("activeModule", "dashboard");
  const { track, page } = useAnalytics();
  const containerRef = useRef<HTMLDivElement>(null);

  // Realtime subscriptions are now handled automatically in FleetContext

  // Enable keyboard shortcuts

  const moduleOrder = ["dashboard", "core", "book", "pulse", "motoriq", "vault"];
  const currentIndex = moduleOrder.indexOf(activeModule);

  useEffect(() => {
    performance.mark('dashboard-load-start');
    page('/dashboard');
    
    return () => {
      performance.mark('dashboard-load-end');
      performance.measure('dashboard-load-time', 'dashboard-load-start', 'dashboard-load-end');
    };
  }, [page]);

  const handleModuleChange = (moduleId: string) => {
    track('module_switch', { from: activeModule, to: moduleId });
    setActiveModule(moduleId);
  };

  const handleSwipeLeft = () => {
    if (currentIndex < moduleOrder.length - 1) {
      handleModuleChange(moduleOrder[currentIndex + 1]);
    }
  };

  const handleSwipeRight = () => {
    if (currentIndex > 0) {
      handleModuleChange(moduleOrder[currentIndex - 1]);
    }
  };

  const { handlers } = useSwipeGesture({
    onSwipeLeft: handleSwipeLeft,
    onSwipeRight: handleSwipeRight,
    threshold: 50,
    velocityThreshold: 0.5,
  });

  const modules = [
    {
      id: "motoriq",
      name: "MotorIQ",
      icon: TrendingUp,
      description: "AI Pricing Optimization",
      color: "text-primary", // Primary - Core Operations
      bgColor: "bg-primary/10"
    },
    {
      id: "pulse",
      name: "Pulse",
      icon: BarChart3,
      description: "Live Analytics & Telematics",
      color: "text-primary", // Primary - Core Operations
      bgColor: "bg-primary/10"
    },
    {
      id: "book",
      name: "Book",
      icon: Calendar,
      description: "Booking Management",
      color: "text-secondary", // Secondary - Management
      bgColor: "bg-secondary/10"
    },
    {
      id: "vault",
      name: "Vault",
      icon: Shield,
      description: "Compliance & Docs",
      color: "text-secondary", // Secondary - Management
      bgColor: "bg-secondary/10"
    },
    {
      id: "core",
      name: "FleetCopilot™",
      icon: Brain,
      description: "AI Control Center",
      color: "text-primary", // Primary - Core Operations (AI)
      bgColor: "bg-primary/10"
    }
  ];

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
      default:
        content = <DashboardOverview onModuleClick={handleModuleChange} />;
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
      
      {/* Desktop Sidebar */}
      <DashboardSidebar 
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
                  {modules.find(m => m.id === activeModule)?.name || "Dashboard"}
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

        {/* Mobile Bottom Navigation - 6 Items */}
        <div className="mobile-nav">
          <div className="grid grid-cols-6 gap-1.5 p-2">
            <button
              onClick={() => {
                handleModuleChange("dashboard");
                if (navigator.vibrate) navigator.vibrate(10);
              }}
              className={`flex flex-col items-center justify-center py-2 px-1.5 rounded-lg transition-all hover-scale touch-target focus-visible ${
                activeModule === "dashboard" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"
              }`}
              aria-label="Dashboard"
            >
              <Home className="h-5 w-5 mb-1" />
              <span className="text-[10px] font-medium truncate max-w-full">Dashboard</span>
            </button>
            
            <button
              onClick={() => {
                handleModuleChange("core");
                if (navigator.vibrate) navigator.vibrate(10);
              }}
              className={`flex flex-col items-center justify-center py-2 px-1.5 rounded-lg transition-all hover-scale touch-target focus-visible ${
                activeModule === "core" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"
              }`}
              aria-label="FleetCopilot"
            >
              <Brain className="h-5 w-5 mb-1" />
              <span className="text-[10px] font-medium truncate max-w-full">Copilot</span>
            </button>

            <button
              onClick={() => {
                handleModuleChange("book");
                if (navigator.vibrate) navigator.vibrate(10);
              }}
              className={`flex flex-col items-center justify-center py-2 px-1.5 rounded-lg transition-all hover-scale touch-target focus-visible ${
                activeModule === "book" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"
              }`}
              aria-label="Book"
            >
              <Calendar className="h-5 w-5 mb-1" />
              <span className="text-[10px] font-medium truncate max-w-full">Book</span>
            </button>

            <button
              onClick={() => {
                handleModuleChange("pulse");
                if (navigator.vibrate) navigator.vibrate(10);
              }}
              className={`flex flex-col items-center justify-center py-2 px-1.5 rounded-lg transition-all hover-scale touch-target focus-visible ${
                activeModule === "pulse" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"
              }`}
              aria-label="Pulse"
            >
              <BarChart3 className="h-5 w-5 mb-1" />
              <span className="text-[10px] font-medium truncate max-w-full">Pulse</span>
            </button>

            <button
              onClick={() => {
                handleModuleChange("motoriq");
                if (navigator.vibrate) navigator.vibrate(10);
              }}
              className={`flex flex-col items-center justify-center py-2 px-1.5 rounded-lg transition-all hover-scale touch-target focus-visible ${
                (activeModule === "motoriq" || activeModule === "optimize") ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"
              }`}
              aria-label="MotorIQ"
            >
              <TrendingUp className="h-5 w-5 mb-1" />
              <span className="text-[10px] font-medium truncate max-w-full">MotorIQ</span>
            </button>

            <button
              onClick={() => {
                handleModuleChange("vault");
                if (navigator.vibrate) navigator.vibrate(10);
              }}
              className={`flex flex-col items-center justify-center py-2 px-1.5 rounded-lg transition-all hover-scale touch-target focus-visible ${
                activeModule === "vault" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"
              }`}
              aria-label="Vault"
            >
              <Shield className="h-5 w-5 mb-1" />
              <span className="text-[10px] font-medium truncate max-w-full">Vault</span>
            </button>
          </div>
        </div>

        {/* Main Content with Swipe Support */}
        <main
        id="main-content" 
        ref={containerRef}
        className="mobile-padding py-4 sm:py-6 pb-28 md:pb-6 overflow-x-hidden" 
        tabIndex={-1}
        {...handlers}
      >
        <div className="max-w-7xl mx-auto mobile-spacing">
          {renderModuleContent()}
          
          {/* Pagination Dots - Mobile Only */}
          <div className="md:hidden mt-6 mb-4">
            <ModulePagination 
              total={moduleOrder.length} 
              current={currentIndex}
              onDotClick={(index) => handleModuleChange(moduleOrder[index])}
            />
          </div>
        </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;