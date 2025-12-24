import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  User, 
  CreditCard, 
  Plug, 
  Database,
  Settings,
  Bell,
  Shield,
  Zap
} from "lucide-react";
import { MyAccountSection } from "./MyAccountSection";
import { SubscriptionSection } from "./SubscriptionSection";
import { IntegrationsSection } from "./IntegrationsSection";
import { DataManagementSection } from "./DataManagementSection";
import { SystemSettingsSection } from "../SystemSettingsSection";
import { useIsMobile } from "@/hooks/use-mobile";

const settingsTabs = [
  { id: "account", label: "My Account", icon: User },
  { id: "subscription", label: "Subscription", icon: CreditCard },
  { id: "integrations", label: "Integrations", icon: Plug },
  { id: "system", label: "System", icon: Settings },
  { id: "data", label: "Data", icon: Database },
];

export const SettingsLayout = () => {
  const [activeTab, setActiveTab] = useState("account");
  const isMobile = useIsMobile();

  const renderContent = () => {
    switch (activeTab) {
      case "account":
        return <MyAccountSection />;
      case "subscription":
        return <SubscriptionSection />;
      case "integrations":
        return <IntegrationsSection />;
      case "system":
        return <SystemSettingsSection />;
      case "data":
        return <DataManagementSection />;
      default:
        return <MyAccountSection />;
    }
  };

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

  return (
    <div className="flex gap-6">
      {/* Sidebar Navigation */}
      <Card className="w-64 h-fit sticky top-4 p-4">
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
