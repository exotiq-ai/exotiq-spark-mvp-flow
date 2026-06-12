import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Zap,
  Sparkles,
  Volume2,
  Bell,
  Save,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { useUserSettings } from "@/hooks/useUserSettings";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AISettings {
  automation: {
    autoConfirmBookings: boolean;
    autoPricing: boolean;
    autoMaintenanceScheduling: boolean;
    aiAssistance: boolean;
  };
  rari: {
    defaultVoice: string;
    autoSuggestions: boolean;
    proactiveInsights: string;
    voiceEnabled: boolean;
  };
}

const defaultSettings: AISettings = {
  automation: {
    autoConfirmBookings: false,
    autoPricing: true,
    autoMaintenanceScheduling: true,
    aiAssistance: true
  },
  rari: {
    defaultVoice: "natural",
    autoSuggestions: true,
    proactiveInsights: "medium",
    voiceEnabled: true
  }
};

export const AISettingsSection = () => {
  const {
    settings,
    toggleNestedSetting,
    updateNestedSetting,
    saveSettings,
    isLoading,
    isSaving
  } = useUserSettings<AISettings>({
    category: 'ai',
    defaultSettings,
  });

  const handleSaveSettings = async () => {
    const success = await saveSettings();
    if (success) {
      toast("AI Settings Saved", { description: "Your AI and automation preferences have been updated." });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card className="card-premium p-6">
          <Skeleton className="h-6 w-48 mb-6" />
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </Card>
        <Card className="card-premium p-6">
          <Skeleton className="h-6 w-48 mb-6" />
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Automation Settings */}
      <Card className="card-premium p-6">
        <div className="flex items-center space-x-3 mb-6">
          <Zap className="w-5 h-5 text-primary" />
          <h3 className="text-xl font-semibold">Automation & AI</h3>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
            <div>
              <Label className="font-medium">Auto-Confirm Bookings</Label>
              <p className="text-sm text-muted-foreground">Automatically confirm eligible bookings</p>
            </div>
            <Switch
              checked={settings.automation.autoConfirmBookings}
              onCheckedChange={() => toggleNestedSetting('automation', 'autoConfirmBookings')}
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
            <div>
              <Label className="font-medium">Dynamic Pricing</Label>
              <p className="text-sm text-muted-foreground">AI-powered automatic pricing optimization</p>
            </div>
            <Switch
              checked={settings.automation.autoPricing}
              onCheckedChange={() => toggleNestedSetting('automation', 'autoPricing')}
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
            <div>
              <Label className="font-medium">Auto Maintenance Scheduling</Label>
              <p className="text-sm text-muted-foreground">Automatically schedule routine maintenance</p>
            </div>
            <Switch
              checked={settings.automation.autoMaintenanceScheduling}
              onCheckedChange={() => toggleNestedSetting('automation', 'autoMaintenanceScheduling')}
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
            <div>
              <Label className="font-medium">FleetCopilot™ AI Assistance</Label>
              <p className="text-sm text-muted-foreground">Enable AI-powered insights and recommendations</p>
            </div>
            <Switch
              checked={settings.automation.aiAssistance}
              onCheckedChange={() => toggleNestedSetting('automation', 'aiAssistance')}
            />
          </div>
        </div>
      </Card>

      {/* Rari Preferences */}
      <Card className="card-premium p-6">
        <div className="flex items-center space-x-3 mb-6">
          <Sparkles className="w-5 h-5 text-rari-teal" />
          <h3 className="text-xl font-semibold">Rari AI Preferences</h3>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
            <div>
              <Label className="font-medium">Voice Interface</Label>
              <p className="text-sm text-muted-foreground">Enable voice commands and responses</p>
            </div>
            <Switch
              checked={settings.rari.voiceEnabled}
              onCheckedChange={() => toggleNestedSetting('rari', 'voiceEnabled')}
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
            <div>
              <Label className="font-medium">Auto-Suggestions</Label>
              <p className="text-sm text-muted-foreground">Show contextual suggestions based on your actions</p>
            </div>
            <Switch
              checked={settings.rari.autoSuggestions}
              onCheckedChange={() => toggleNestedSetting('rari', 'autoSuggestions')}
            />
          </div>

          <div className="p-4 rounded-lg bg-muted/30 space-y-3">
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-muted-foreground" />
              <Label className="font-medium">Default Voice</Label>
            </div>
            <Select
              value={settings.rari.defaultVoice}
              onValueChange={(value) => updateNestedSetting('rari', 'defaultVoice', value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="natural">Natural (Default)</SelectItem>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="friendly">Friendly</SelectItem>
                <SelectItem value="concise">Concise</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="p-4 rounded-lg bg-muted/30 space-y-3">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-muted-foreground" />
              <Label className="font-medium">Proactive Insights Frequency</Label>
            </div>
            <Select
              value={settings.rari.proactiveInsights}
              onValueChange={(value) => updateNestedSetting('rari', 'proactiveInsights', value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High - Show all insights immediately</SelectItem>
                <SelectItem value="medium">Medium - Important insights only</SelectItem>
                <SelectItem value="low">Low - Critical alerts only</SelectItem>
                <SelectItem value="off">Off - Manual check only</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Controls how often Rari proactively notifies you about insights and opportunities
            </p>
          </div>
        </div>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button 
          onClick={handleSaveSettings} 
          className="btn-premium" 
          size="lg"
          disabled={isSaving}
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          {isSaving ? 'Saving...' : 'Save AI Settings'}
        </Button>
      </div>
    </div>
  );
};
