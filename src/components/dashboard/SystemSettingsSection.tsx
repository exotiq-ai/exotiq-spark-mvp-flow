import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Settings, 
  Bell, 
  Mail, 
  Shield, 
  Zap,
  DollarSign,
  Clock,
  Globe,
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

export const SystemSettingsSection = () => {
  const { toast } = useToast();
  
  const [settings, setSettings] = useState({
    notifications: {
      emailAlerts: true,
      smsAlerts: false,
      bookingReminders: true,
      maintenanceAlerts: true,
      paymentNotifications: true
    },
    automation: {
      autoConfirmBookings: false,
      autoPricing: true,
      autoMaintenanceScheduling: true,
      aiAssistance: true
    },
    business: {
      businessName: "ExotIQ Fleet Management",
      timezone: "America/New_York",
      currency: "USD",
      language: "en",
      taxRate: "8.5"
    },
    security: {
      twoFactorAuth: true,
      sessionTimeout: "60",
      passwordExpiry: "90",
      ipWhitelist: false
    }
  });

  const handleSaveSettings = () => {
    toast({
      title: "Settings Saved",
      description: "Your system settings have been updated successfully.",
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
      {/* Notifications Settings */}
      <Card className="card-premium p-6">
        <div className="flex items-center space-x-3 mb-6">
          <Bell className="w-5 h-5 text-primary" />
          <h3 className="text-xl font-semibold">Notification Preferences</h3>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
            <div>
              <Label className="font-medium">Email Alerts</Label>
              <p className="text-sm text-muted-foreground">Receive important alerts via email</p>
            </div>
            <Switch
              checked={settings.notifications.emailAlerts}
              onCheckedChange={() => toggleSetting('notifications', 'emailAlerts')}
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
            <div>
              <Label className="font-medium">SMS Alerts</Label>
              <p className="text-sm text-muted-foreground">Get critical notifications via SMS</p>
            </div>
            <Switch
              checked={settings.notifications.smsAlerts}
              onCheckedChange={() => toggleSetting('notifications', 'smsAlerts')}
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
            <div>
              <Label className="font-medium">Booking Reminders</Label>
              <p className="text-sm text-muted-foreground">Automatic booking reminder notifications</p>
            </div>
            <Switch
              checked={settings.notifications.bookingReminders}
              onCheckedChange={() => toggleSetting('notifications', 'bookingReminders')}
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
            <div>
              <Label className="font-medium">Maintenance Alerts</Label>
              <p className="text-sm text-muted-foreground">Vehicle maintenance notifications</p>
            </div>
            <Switch
              checked={settings.notifications.maintenanceAlerts}
              onCheckedChange={() => toggleSetting('notifications', 'maintenanceAlerts')}
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
            <div>
              <Label className="font-medium">Payment Notifications</Label>
              <p className="text-sm text-muted-foreground">Payment and invoice alerts</p>
            </div>
            <Switch
              checked={settings.notifications.paymentNotifications}
              onCheckedChange={() => toggleSetting('notifications', 'paymentNotifications')}
            />
          </div>
        </div>
      </Card>

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

      {/* Business Settings */}
      <Card className="card-premium p-6">
        <div className="flex items-center space-x-3 mb-6">
          <Globe className="w-5 h-5 text-primary" />
          <h3 className="text-xl font-semibold">Business Configuration</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label>Business Name</Label>
            <Input
              value={settings.business.businessName}
              onChange={(e) => updateSetting('business', 'businessName', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Timezone</Label>
            <Select
              value={settings.business.timezone}
              onValueChange={(value) => updateSetting('business', 'timezone', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                <SelectItem value="Europe/London">London (GMT)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Currency</Label>
            <Select
              value={settings.business.currency}
              onValueChange={(value) => updateSetting('business', 'currency', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD ($)</SelectItem>
                <SelectItem value="EUR">EUR (€)</SelectItem>
                <SelectItem value="GBP">GBP (£)</SelectItem>
                <SelectItem value="AED">AED (د.إ)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tax Rate (%)</Label>
            <Input
              type="number"
              value={settings.business.taxRate}
              onChange={(e) => updateSetting('business', 'taxRate', e.target.value)}
              min="0"
              max="100"
              step="0.1"
            />
          </div>
        </div>
      </Card>

      {/* Security Settings */}
      <Card className="card-premium p-6">
        <div className="flex items-center space-x-3 mb-6">
          <Shield className="w-5 h-5 text-primary" />
          <h3 className="text-xl font-semibold">Security Settings</h3>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
            <div>
              <Label className="font-medium">Two-Factor Authentication</Label>
              <p className="text-sm text-muted-foreground">Require 2FA for all user accounts</p>
            </div>
            <Switch
              checked={settings.security.twoFactorAuth}
              onCheckedChange={() => toggleSetting('security', 'twoFactorAuth')}
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
            <div>
              <Label className="font-medium">IP Whitelist</Label>
              <p className="text-sm text-muted-foreground">Restrict access to specific IP addresses</p>
            </div>
            <Switch
              checked={settings.security.ipWhitelist}
              onCheckedChange={() => toggleSetting('security', 'ipWhitelist')}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 rounded-lg bg-muted/30">
            <div className="space-y-2">
              <Label>Session Timeout (minutes)</Label>
              <Input
                type="number"
                value={settings.security.sessionTimeout}
                onChange={(e) => updateSetting('security', 'sessionTimeout', e.target.value)}
                min="15"
                max="480"
              />
            </div>

            <div className="space-y-2">
              <Label>Password Expiry (days)</Label>
              <Input
                type="number"
                value={settings.security.passwordExpiry}
                onChange={(e) => updateSetting('security', 'passwordExpiry', e.target.value)}
                min="30"
                max="365"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSaveSettings} className="btn-premium" size="lg">
          <Save className="w-4 h-4 mr-2" />
          Save All Settings
        </Button>
      </div>
    </div>
  );
};
