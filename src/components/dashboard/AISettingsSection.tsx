import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  Zap,
  Brain,
  Sparkles,
  Volume2,
  Bell,
  Clock,
  Save
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const AISettingsSection = () => {
  const { toast } = useToast();
  
  const [settings, setSettings] = useState({
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
  });

  const handleSaveSettings = () => {
    toast({
      title: "AI Settings Saved",
      description: "Your AI and automation preferences have been updated.",
    });
  };

  const toggleSetting = (category: keyof typeof settings, key: string) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: !prev[category][key as keyof typeof prev[typeof category]]
      }
    }));
  };

  const updateSetting = (category: keyof typeof settings, key: string, value: string) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value
      }
    }));
  };

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
              onCheckedChange={() => toggleSetting('automation', 'autoConfirmBookings')}
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
            <div>
              <Label className="font-medium">Dynamic Pricing</Label>
              <p className="text-sm text-muted-foreground">AI-powered automatic pricing optimization</p>
            </div>
            <Switch
              checked={settings.automation.autoPricing}
              onCheckedChange={() => toggleSetting('automation', 'autoPricing')}
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
            <div>
              <Label className="font-medium">Auto Maintenance Scheduling</Label>
              <p className="text-sm text-muted-foreground">Automatically schedule routine maintenance</p>
            </div>
            <Switch
              checked={settings.automation.autoMaintenanceScheduling}
              onCheckedChange={() => toggleSetting('automation', 'autoMaintenanceScheduling')}
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
            <div>
              <Label className="font-medium">FleetCopilot™ AI Assistance</Label>
              <p className="text-sm text-muted-foreground">Enable AI-powered insights and recommendations</p>
            </div>
            <Switch
              checked={settings.automation.aiAssistance}
              onCheckedChange={() => toggleSetting('automation', 'aiAssistance')}
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
              onCheckedChange={() => toggleSetting('rari', 'voiceEnabled')}
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
            <div>
              <Label className="font-medium">Auto-Suggestions</Label>
              <p className="text-sm text-muted-foreground">Show contextual suggestions based on your actions</p>
            </div>
            <Switch
              checked={settings.rari.autoSuggestions}
              onCheckedChange={() => toggleSetting('rari', 'autoSuggestions')}
            />
          </div>

          <div className="p-4 rounded-lg bg-muted/30 space-y-3">
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-muted-foreground" />
              <Label className="font-medium">Default Voice</Label>
            </div>
            <Select
              value={settings.rari.defaultVoice}
              onValueChange={(value) => updateSetting('rari', 'defaultVoice', value)}
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
              onValueChange={(value) => updateSetting('rari', 'proactiveInsights', value)}
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
        <Button onClick={handleSaveSettings} className="btn-premium" size="lg">
          <Save className="w-4 h-4 mr-2" />
          Save AI Settings
        </Button>
      </div>
    </div>
  );
};
