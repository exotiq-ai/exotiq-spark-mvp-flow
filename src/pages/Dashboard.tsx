import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/ui/logo";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { SkipNavigation } from "@/components/common/SkipNavigation";
import { SEOHead } from "@/components/common/SEOHead";
import { useAnalytics } from "@/lib/analytics";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";
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
import { Core } from "@/components/dashboard/Core";
import { DashboardOverview } from "@/components/dashboard/DashboardOverview";
import { ModulePagination } from "@/components/dashboard/ModulePagination";

const Dashboard = () => {
  const [activeModule, setActiveModule] = useLocalStorage("activeModule", "dashboard");
  const [showMore, setShowMore] = useState(false);
  const { track, page } = useAnalytics();
  const containerRef = useRef<HTMLDivElement>(null);

  const moduleOrder = ["dashboard", "optimize", "book", "vault", "core"];
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
      color: "text-success",
      bgColor: "bg-success/10"
    },
    {
      id: "pulse",
      name: "Pulse",
      icon: BarChart3,
      description: "Live Analytics",
      color: "text-primary",
      bgColor: "bg-primary/10"
    },
    {
      id: "book",
      name: "Book",
      icon: Calendar,
      description: "Booking Management",
      color: "text-accent",
      bgColor: "bg-accent/10"
    },
    {
      id: "vault",
      name: "Vault",
      icon: Shield,
      description: "Compliance & Docs",
      color: "text-warning",
      bgColor: "bg-warning/10"
    },
    {
      id: "core",
      name: "Core",
      icon: Brain,
      description: "Control Center",
      color: "text-destructive",
      bgColor: "bg-destructive/10"
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
        content = <Core />;
        break;
      default:
        content = <DashboardOverview modules={modules} onModuleClick={handleModuleChange} />;
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
    <div className="min-h-screen bg-background mobile-friendly">
      <SEOHead
        title="Fleet Management Dashboard"
        description="Manage your luxury fleet with comprehensive analytics, AI-powered insights, and real-time monitoring."
        noIndex={true}
      />
      <SkipNavigation />
      {/* Top Navigation */}
      <nav className="bg-background border-b border-border sticky top-0 z-40">
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
              <Button variant="ghost" size="sm" className="touch-target">
                <Bell className="h-4 w-4" />
              </Button>
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

      {/* Mobile Bottom Navigation - 5 Items */}
      <div className="mobile-nav">
        <div className="grid grid-cols-5 gap-1 p-2">
          <button
            onClick={() => handleModuleChange("dashboard")}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg transition-all hover-scale touch-target focus-visible ${
              activeModule === "dashboard" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"
            }`}
            aria-label="Dashboard"
          >
            <Home className="h-5 w-5 mb-1" />
            <span className="text-xs font-medium">Home</span>
          </button>
          
          <button
            onClick={() => handleModuleChange("optimize")}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg transition-all hover-scale touch-target focus-visible ${
              (activeModule === "motoriq" || activeModule === "pulse" || activeModule === "optimize") 
                ? "bg-primary text-primary-foreground" 
                : "text-muted-foreground hover:bg-muted/50"
            }`}
            aria-label="Optimize - AI & Analytics"
          >
            <TrendingUp className="h-5 w-5 mb-1" />
            <span className="text-xs font-medium">Optimize</span>
          </button>

          <button
            onClick={() => handleModuleChange("book")}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg transition-all hover-scale touch-target focus-visible ${
              activeModule === "book" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"
            }`}
            aria-label="Book - Booking Management"
          >
            <Calendar className="h-5 w-5 mb-1" />
            <span className="text-xs font-medium">Book</span>
          </button>

          <button
            onClick={() => handleModuleChange("vault")}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg transition-all hover-scale touch-target focus-visible ${
              activeModule === "vault" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"
            }`}
            aria-label="Vault - Compliance"
          >
            <Shield className="h-5 w-5 mb-1" />
            <span className="text-xs font-medium">Vault</span>
          </button>

          <button
            onClick={() => setShowMore(!showMore)}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg transition-all hover-scale touch-target focus-visible ${
              showMore || activeModule === "core" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"
            }`}
            aria-label="More options"
          >
            <MoreHorizontal className="h-5 w-5 mb-1" />
            <span className="text-xs font-medium">More</span>
          </button>
        </div>

        {/* More Menu */}
        <AnimatePresence>
          {showMore && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.2 }}
              className="absolute bottom-full left-0 right-0 mb-2 mx-2 bg-card border border-border rounded-2xl shadow-premium overflow-hidden"
            >
              <div className="p-2 space-y-1">
                <button
                  onClick={() => {
                    handleModuleChange("core");
                    setShowMore(false);
                  }}
                  className="w-full flex items-center space-x-3 p-4 rounded-xl hover:bg-muted/50 transition-colors touch-target"
                >
                  <Brain className="h-5 w-5 text-destructive" />
                  <div className="text-left">
                    <div className="font-semibold">Core</div>
                    <div className="text-xs text-muted-foreground">Control Center</div>
                  </div>
                </button>
                <button
                  onClick={() => setShowMore(false)}
                  className="w-full flex items-center space-x-3 p-4 rounded-xl hover:bg-muted/50 transition-colors touch-target"
                >
                  <Settings className="h-5 w-5 text-muted-foreground" />
                  <div className="text-left">
                    <div className="font-semibold">Settings</div>
                    <div className="text-xs text-muted-foreground">App preferences</div>
                  </div>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Main Content with Swipe Support */}
      <main 
        id="main-content" 
        ref={containerRef}
        className="mobile-padding py-4 sm:py-6 pb-24 md:pb-6" 
        tabIndex={-1}
        {...handlers}
      >
        <div className="max-w-7xl mx-auto mobile-spacing">
          {renderModuleContent()}
          
          {/* Pagination Dots - Mobile Only */}
          <div className="md:hidden mt-6">
            <ModulePagination 
              total={moduleOrder.length} 
              current={currentIndex}
              onDotClick={(index) => handleModuleChange(moduleOrder[index])}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;