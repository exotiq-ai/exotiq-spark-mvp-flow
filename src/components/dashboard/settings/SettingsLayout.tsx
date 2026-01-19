import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useBreakpoint } from "@/hooks/use-mobile";
import { useUserRole } from "@/hooks/useUserRole";
import { 
  Settings, 
  User, 
  Users, 
  MapPin, 
  Bell, 
  CreditCard, 
  Puzzle, 
  Database 
} from "lucide-react";

// Settings sections
import { MyAccountSection } from "./MyAccountSection";
import { TeamHub } from "../TeamHub";
import { LocationsSection } from "./LocationsSection";
import { NotificationSettingsSection } from "./NotificationSettingsSection";
import { SubscriptionSection } from "./SubscriptionSection";
import { IntegrationsSection } from "./IntegrationsSection";
import { DataManagementSection } from "./DataManagementSection";

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
  { id: "subscription", label: "Subscription", icon: CreditCard },
  { id: "integrations", label: "Integrations", icon: Puzzle },
  { id: "data", label: "Data", icon: Database },
];

export const SettingsLayout = () => {
  const [activeTab, setActiveTab] = useState("account");
  const { isMobile, isTablet, isDesktop } = useBreakpoint();
  const { isAdmin, loading: roleLoading } = useUserRole();

  // Filter tabs based on user role
  const settingsTabs = useMemo(() => {
    return allSettingsTabs.filter(tab => {
      if (tab.requiresAdmin && !isAdmin) return false;
      return true;
    });
  }, [isAdmin]);

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
      default:
        return <MyAccountSection />;
    }
  };

  // Mobile Layout: Horizontal scroll tabs
  if (isMobile) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold">Settings</h2>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <ScrollArea className="w-full">
            <TabsList className="w-full justify-start bg-muted/50 p-1">
              {settingsTabs.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="flex items-center gap-2 whitespace-nowrap"
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          {settingsTabs.map((tab) => (
            <TabsContent key={tab.id} value={tab.id} className="mt-4">
              {renderContent()}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    );
  }

  // Tablet Layout: Horizontal pill navigation bar
  if (isTablet) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold">Settings</h2>
        </div>

        {/* Horizontal Pill Navigation */}
        <div className="bg-muted/40 rounded-xl p-1.5 border border-border/50">
          <ScrollArea className="w-full">
            <nav className="flex items-center gap-1">
              {settingsTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium
                    whitespace-nowrap transition-all duration-200
                    ${activeTab === tab.id
                      ? "bg-background text-foreground shadow-sm border border-border/50"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }
                  `}
                >
                  <tab.icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
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
