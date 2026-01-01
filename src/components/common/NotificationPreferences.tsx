import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Settings, Bell, Moon, Sparkles, AlertTriangle, Info } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLocalStorage } from "@/hooks/useLocalStorage";

export interface NotificationPrefs {
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  enableSystemNotifications: boolean;
  enableAIInsights: boolean;
  enableCriticalAlerts: boolean;
  enableWarnings: boolean;
  enableInfoAlerts: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  quietHoursEnabled: false,
  quietHoursStart: "22:00",
  quietHoursEnd: "08:00",
  enableSystemNotifications: true,
  enableAIInsights: true,
  enableCriticalAlerts: true,
  enableWarnings: true,
  enableInfoAlerts: true,
};

export const NotificationPreferences = ({ 
  open, 
  onOpenChange 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
}) => {
  const isMobile = useIsMobile();
  const [prefs, setPrefs] = useLocalStorage<NotificationPrefs>(
    "notification-preferences",
    DEFAULT_PREFS
  );

  const handleToggle = (key: keyof NotificationPrefs) => {
    if (navigator.vibrate) navigator.vibrate(5);
    setPrefs(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleTimeChange = (key: "quietHoursStart" | "quietHoursEnd", value: string) => {
    setPrefs(prev => ({ ...prev, [key]: value }));
  };

  const contentComponent = (
    <div className="space-y-6">
      {/* Quiet Hours Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center space-x-2">
              <Moon className="w-4 h-4 text-muted-foreground" />
              <Label className="text-base font-medium">Quiet Hours</Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Mute non-critical notifications during specific hours
            </p>
          </div>
          <Switch
            checked={prefs.quietHoursEnabled}
            onCheckedChange={() => handleToggle("quietHoursEnabled")}
          />
        </div>

        {prefs.quietHoursEnabled && (
          <div className="pl-6 space-y-3 animate-fade-in">
            <div className="flex items-center justify-between">
              <Label htmlFor="start-time" className="text-sm">Start Time</Label>
              <input
                id="start-time"
                type="time"
                value={prefs.quietHoursStart}
                onChange={(e) => handleTimeChange("quietHoursStart", e.target.value)}
                className="px-3 py-1.5 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="end-time" className="text-sm">End Time</Label>
              <input
                id="end-time"
                type="time"
                value={prefs.quietHoursEnd}
                onChange={(e) => handleTimeChange("quietHoursEnd", e.target.value)}
                className="px-3 py-1.5 text-sm border rounded-md bg-background"
              />
            </div>
          </div>
        )}
      </div>

      <Separator />

      {/* Notification Types Section */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Bell className="w-4 h-4 text-muted-foreground" />
          <Label className="text-base font-medium">Notification Types</Label>
        </div>
        <p className="text-xs text-muted-foreground">
          Choose which types of notifications you want to receive
        </p>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <Label className="text-sm">Critical Alerts</Label>
            </div>
            <Switch
              checked={prefs.enableCriticalAlerts}
              onCheckedChange={() => handleToggle("enableCriticalAlerts")}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-rari-teal" />
              <Label className="text-sm">AI Insights</Label>
            </div>
            <Switch
              checked={prefs.enableAIInsights}
              onCheckedChange={() => handleToggle("enableAIInsights")}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              <Label className="text-sm">Warnings</Label>
            </div>
            <Switch
              checked={prefs.enableWarnings}
              onCheckedChange={() => handleToggle("enableWarnings")}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Bell className="w-4 h-4 text-muted-foreground" />
              <Label className="text-sm">System Notifications</Label>
            </div>
            <Switch
              checked={prefs.enableSystemNotifications}
              onCheckedChange={() => handleToggle("enableSystemNotifications")}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Info className="w-4 h-4 text-primary" />
              <Label className="text-sm">Info Alerts</Label>
            </div>
            <Switch
              checked={prefs.enableInfoAlerts}
              onCheckedChange={() => handleToggle("enableInfoAlerts")}
            />
          </div>
        </div>
      </div>

      {isMobile && (
        <>
          <Separator />
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              💡 App icon badges show your unread notification count on mobile devices when installed as a PWA.
            </p>
          </div>
        </>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Notification Preferences
            </DrawerTitle>
            <DrawerDescription>
              Customize how and when you receive notifications
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 py-4 overflow-y-auto max-h-[70vh]">
            {contentComponent}
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline">Close</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Notification Preferences
          </DialogTitle>
          <DialogDescription>
            Customize how and when you receive notifications
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {contentComponent}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const useNotificationPreferences = () => {
  const [prefs] = useLocalStorage<NotificationPrefs>(
    "notification-preferences",
    DEFAULT_PREFS
  );

  const isInQuietHours = () => {
    if (!prefs.quietHoursEnabled) return false;

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    const [startHour, startMin] = prefs.quietHoursStart.split(':').map(Number);
    const [endHour, endMin] = prefs.quietHoursEnd.split(':').map(Number);
    
    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    // Handle overnight quiet hours (e.g., 22:00 - 08:00)
    if (startTime > endTime) {
      return currentTime >= startTime || currentTime <= endTime;
    }
    
    return currentTime >= startTime && currentTime <= endTime;
  };

  return {
    prefs,
    isInQuietHours,
  };
};
