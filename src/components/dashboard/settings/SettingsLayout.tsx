import { useState, useMemo, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useBreakpoint } from "@/hooks/use-mobile";
import { useUserRole } from "@/hooks/useUserRole";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { 
  Settings, 
  User, 
  Users, 
  MapPin, 
  Bell, 
  CreditCard, 
  Puzzle, 
  Database,
  Banknote
} from "lucide-react";

// Settings sections
import { MyAccountSection } from "./MyAccountSection";
import { TeamHub } from "../TeamHub";
import { LocationsSection } from "./LocationsSection";
import { NotificationSettingsSection } from "./NotificationSettingsSection";
import { SubscriptionSection } from "./SubscriptionSection";
import { IntegrationsSection } from "./IntegrationsSection";
import { DataManagementSection } from "./DataManagementSection";
import { PaymentMethodsSection } from "@/components/settings/PaymentMethodsSection";

interface SettingsTab {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  requiresAdmin?: boolean;
}

const allSettingsTabs: SettingsTab[] = [
  { id: "account", label: "My Account", icon: User },
  { id: "team", label: "Team", icon: Users },
  { id: "locations", label: "Locations", icon: MapPin, requiresAdmin: true },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "subscription", label: "Billing", icon: CreditCard },
  { id: "integrations", label: "Integrations", icon: Puzzle },
  { id: "data", label: "Data", icon: Database },
  { id: "payments", label: "Payments", icon: Banknote },
];

export const SettingsLayout = () => {
  const [activeTab, setActiveTab] = useState("account");
  const { isMobile, isTablet, isDesktop } = useBreakpoint();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showRightFade, setShowRightFade] = useState(true);
  const [showLeftFade, setShowLeftFade] = useState(false);

  // Filter tabs based on user role
  const settingsTabs = useMemo(() => {
    return allSettingsTabs.filter(tab => {
      if (tab.requiresAdmin && !isAdmin) return false;
      return true;
    });
  }, [isAdmin]);

  // Handle scroll fade indicators
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    setShowLeftFade(scrollLeft > 10);
    setShowRightFade(scrollLeft < scrollWidth - clientWidth - 10);
  };

  // Scroll active tab into view
  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    // Scroll the tab into view smoothly
    tabRefs.current[tabId]?.scrollIntoView({
      behavior: 'smooth',
      inline: 'start',
      block: 'nearest'
    });
  };

  // Check scroll position on mount
  useEffect(() => {
    handleScroll();
  }, [settingsTabs]);

  const renderContent = () => {
    switch (activeTab) {
      case "account":
        return <MyAccountSection />;
      case "team":
        return <TeamHub />;
      case "locations":
        return isAdmin ? <LocationsSection /> : null;
      case "notifications":
        return <NotificationSettingsSection />;
      case "subscription":
        return <SubscriptionSection />;
      case "integrations":
        return <IntegrationsSection />;
      case "data":
        return <DataManagementSection />;
      case "payments":
        return <PaymentMethodsSection />;
      default:
        return <MyAccountSection />;
    }
  };

  // Mobile Layout: Horizontal scroll tabs with animated indicator
  if (isMobile) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold">Settings</h2>
        </div>

        {/* Horizontal tab navigation with Apple-style sliding indicator */}
        <div className="relative">
          <div 
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="overflow-x-auto scrollbar-hide"
          >
            <nav className="flex items-center gap-1 p-1 bg-muted/40 rounded-xl border border-border/50 min-w-max">
              {settingsTabs.map((tab) => (
                <button
                  key={tab.id}
                  ref={(el) => { tabRefs.current[tab.id] = el; }}
                  onClick={() => handleTabClick(tab.id)}
                  className={cn(
                    "relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium",
                    "whitespace-nowrap transition-colors duration-200",
                    activeTab === tab.id
                      ? "text-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  <tab.icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  
                  {/* Animated pill indicator */}
                  {activeTab === tab.id && (
                    <motion.div
                      layoutId="settings-mobile-tab-indicator"
                      className="absolute inset-0 bg-background rounded-lg shadow-sm border border-border/50 -z-10"
                      transition={{ type: "spring", stiffness: 500, damping: 35 }}
                    />
                  )}
                </button>
              ))}
            </nav>
          </div>
          
          {/* Scroll fade indicators */}
          {showLeftFade && (
            <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-background to-transparent pointer-events-none rounded-l-xl" />
          )}
          {showRightFade && (
            <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-background to-transparent pointer-events-none rounded-r-xl" />
          )}
        </div>

        {/* Content */}
        <div className="mt-4">
          {renderContent()}
        </div>
      </div>
    );
  }

  // Tablet Layout: Horizontal pill navigation bar with animated indicator
  if (isTablet) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold">Settings</h2>
        </div>

        {/* Horizontal Pill Navigation with scroll indicators */}
        <div className="relative">
          <div 
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="overflow-x-auto scrollbar-hide"
          >
            <nav className="flex items-center gap-1 p-1.5 bg-muted/40 rounded-xl border border-border/50 min-w-max">
              {settingsTabs.map((tab) => (
                <button
                  key={tab.id}
                  ref={(el) => { tabRefs.current[tab.id] = el; }}
                  onClick={() => handleTabClick(tab.id)}
                  className={cn(
                    "relative flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium",
                    "whitespace-nowrap transition-colors duration-200",
                    activeTab === tab.id
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <tab.icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  
                  {/* Animated pill indicator */}
                  {activeTab === tab.id && (
                    <motion.div
                      layoutId="settings-tablet-tab-indicator"
                      className="absolute inset-0 bg-background rounded-lg shadow-sm border border-border/50 -z-10"
                      transition={{ type: "spring", stiffness: 500, damping: 35 }}
                    />
                  )}
                </button>
              ))}
            </nav>
          </div>
          
          {/* Scroll fade indicators */}
          {showLeftFade && (
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent pointer-events-none rounded-l-xl" />
          )}
          {showRightFade && (
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none rounded-r-xl" />
          )}
        </div>

        {/* Full-width Content */}
        <div className="min-w-0">
          {renderContent()}
        </div>
      </div>
    );
  }

  // Desktop Layout: Sidebar + Content
  return (
    <div className="flex gap-6">
      {/* Sidebar Navigation */}
      <Card className="w-64 h-fit sticky top-4 p-4 shrink-0">
        <div className="flex items-center gap-2 mb-6 pb-4 border-b">
          <Settings className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">Settings</h2>
        </div>

        <nav className="space-y-1">
          {settingsTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="text-sm font-medium">{tab.label}</span>
            </button>
          ))}
        </nav>
      </Card>

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        {renderContent()}
      </div>
    </div>
  );
};

export default SettingsLayout;
