import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Bell, 
  Shield, 
  Globe,
  Save,
  Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUserSettings } from "@/hooks/useUserSettings";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SystemSettings {
  notifications: {
    emailAlerts: boolean;
    smsAlerts: boolean;
    bookingReminders: boolean;
    maintenanceAlerts: boolean;
    paymentNotifications: boolean;
  };
  business: {
    businessName: string;
    timezone: string;
    currency: string;
    language: string;
    taxRate: string;
  };
  security: {
    twoFactorAuth: boolean;
    sessionTimeout: string;
    passwordExpiry: string;
    ipWhitelist: boolean;
  };
}

const defaultSettings: SystemSettings = {
  notifications: {
    emailAlerts: true,
    smsAlerts: false,
    bookingReminders: true,
    maintenanceAlerts: true,
    paymentNotifications: true
  },
  business: {
    businessName: "Exotiq Fleet Management",
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
};

export const SystemSettingsSection = () => {
  const { toast } = useToast();
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const {
    settings,
    toggleNestedSetting,
    updateNestedSetting,
    saveSettings,
    isLoading,
    isSaving
  } = useUserSettings<SystemSettings>({
    category: 'system',
    defaultSettings,
  });

  const validateSettings = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate business name
    if (settings.business.businessName.trim().length === 0) {
      newErrors.businessName = "Business name is required";
    } else if (settings.business.businessName.length > 100) {
      newErrors.businessName = "Business name must be less than 100 characters";
    }

    // Validate tax rate
    const taxRate = parseFloat(settings.business.taxRate);
    if (isNaN(taxRate) || taxRate < 0 || taxRate > 100) {
      newErrors.taxRate = "Tax rate must be between 0 and 100";
    }

    // Validate session timeout
    const sessionTimeout = parseInt(settings.security.sessionTimeout);
    if (isNaN(sessionTimeout) || sessionTimeout < 15 || sessionTimeout > 480) {
      newErrors.sessionTimeout = "Session timeout must be between 15 and 480 minutes";
    }

    // Validate password expiry
    const passwordExpiry = parseInt(settings.security.passwordExpiry);
    if (isNaN(passwordExpiry) || passwordExpiry < 30 || passwordExpiry > 365) {
      newErrors.passwordExpiry = "Password expiry must be between 30 and 365 days";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveSettings = async () => {
    if (!validateSettings()) {
      toast({
        title: "Validation Error",
        description: "Please fix the errors before saving.",
        variant: "destructive"
      });
      return;
    }

    const success = await saveSettings();
    if (success) {
      toast({
        title: "Settings Saved",
        description: "Your system settings have been updated successfully.",
      });
      setErrors({});
    }
  };

  const handleUpdateNestedSetting = <K extends keyof SystemSettings>(
    category: K,
    key: string,
    value: string
  ) => {
    // Clear error for this field when user types
    if (errors[key]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[key];
        return newErrors;
      });
    }

    updateNestedSetting(category, key, value);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="card-premium p-6">
            <Skeleton className="h-6 w-48 mb-6" />
            <div className="space-y-4">
              {[1, 2, 3].map((j) => (
                <Skeleton key={j} className="h-16 w-full" />
              ))}
            </div>
          </Card>
        ))}
      </div>
    );
  }

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
              onCheckedChange={() => toggleNestedSetting('notifications', 'emailAlerts')}
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
            <div>
              <Label className="font-medium">SMS Alerts</Label>
              <p className="text-sm text-muted-foreground">Get critical notifications via SMS</p>
            </div>
            <Switch
              checked={settings.notifications.smsAlerts}
              onCheckedChange={() => toggleNestedSetting('notifications', 'smsAlerts')}
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
            <div>
              <Label className="font-medium">Booking Reminders</Label>
              <p className="text-sm text-muted-foreground">Automatic booking reminder notifications</p>
            </div>
            <Switch
              checked={settings.notifications.bookingReminders}
              onCheckedChange={() => toggleNestedSetting('notifications', 'bookingReminders')}
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
            <div>
              <Label className="font-medium">Maintenance Alerts</Label>
              <p className="text-sm text-muted-foreground">Vehicle maintenance notifications</p>
            </div>
            <Switch
              checked={settings.notifications.maintenanceAlerts}
              onCheckedChange={() => toggleNestedSetting('notifications', 'maintenanceAlerts')}
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
            <div>
              <Label className="font-medium">Payment Notifications</Label>
              <p className="text-sm text-muted-foreground">Payment and invoice alerts</p>
            </div>
            <Switch
              checked={settings.notifications.paymentNotifications}
              onCheckedChange={() => toggleNestedSetting('notifications', 'paymentNotifications')}
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
              onChange={(e) => handleUpdateNestedSetting('business', 'businessName', e.target.value)}
              maxLength={100}
              className={errors.businessName ? "border-destructive" : ""}
            />
            {errors.businessName && (
              <p className="text-xs text-destructive">{errors.businessName}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Timezone</Label>
            <Select
              value={settings.business.timezone}
              onValueChange={(value) => handleUpdateNestedSetting('business', 'timezone', value)}
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
              onValueChange={(value) => handleUpdateNestedSetting('business', 'currency', value)}
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
              onChange={(e) => handleUpdateNestedSetting('business', 'taxRate', e.target.value)}
              min="0"
              max="100"
              step="0.1"
              className={errors.taxRate ? "border-destructive" : ""}
            />
            {errors.taxRate && (
              <p className="text-xs text-destructive">{errors.taxRate}</p>
            )}
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
              onCheckedChange={() => toggleNestedSetting('security', 'twoFactorAuth')}
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
            <div>
              <Label className="font-medium">IP Whitelist</Label>
              <p className="text-sm text-muted-foreground">Restrict access to specific IP addresses</p>
            </div>
            <Switch
              checked={settings.security.ipWhitelist}
              onCheckedChange={() => toggleNestedSetting('security', 'ipWhitelist')}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 rounded-lg bg-muted/30">
            <div className="space-y-2">
              <Label>Session Timeout (minutes)</Label>
              <Input
                type="number"
                value={settings.security.sessionTimeout}
                onChange={(e) => handleUpdateNestedSetting('security', 'sessionTimeout', e.target.value)}
                min="15"
                max="480"
                className={errors.sessionTimeout ? "border-destructive" : ""}
              />
              {errors.sessionTimeout && (
                <p className="text-xs text-destructive">{errors.sessionTimeout}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Password Expiry (days)</Label>
              <Input
                type="number"
                value={settings.security.passwordExpiry}
                onChange={(e) => handleUpdateNestedSetting('security', 'passwordExpiry', e.target.value)}
                min="30"
                max="365"
                className={errors.passwordExpiry ? "border-destructive" : ""}
              />
              {errors.passwordExpiry && (
                <p className="text-xs text-destructive">{errors.passwordExpiry}</p>
              )}
            </div>
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
          {isSaving ? 'Saving...' : 'Save All Settings'}
        </Button>
      </div>
    </div>
  );
};
