import { useState, useEffect, useMemo } from "react";
import { motion, PanInfo, useMotionValue, useTransform } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bell,
  Check,
  AlertTriangle,
  Info,
  CheckCircle,
  X,
  Trash2,
  Sparkles,
  TrendingUp,
  Calendar,
  Shield,
  AlertCircle,
  DollarSign,
  Wrench,
  FileText,
  Settings,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useFleet } from "@/contexts/FleetContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { NotificationPreferences, useNotificationPreferences } from "./NotificationPreferences";
import { useNotifications } from "@/hooks/useNotifications";
import { useSearchParams } from "react-router-dom";

interface SystemNotification {
  id: string;
  type: "info" | "warning" | "success" | "error";
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  category: "system";
  data?: Record<string, any> | null;
  notificationType?: string;
}

interface AIAlert {
  id: string;
  type: "critical" | "high" | "medium" | "info";
  category: "pricing" | "utilization" | "maintenance" | "compliance" | "demand" | "damage";
  title: string;
  description: string;
  action?: string;
  timestamp: Date;
  read: boolean;
}

type UnifiedNotification = SystemNotification | AIAlert;

const isAIAlert = (notification: UnifiedNotification): notification is AIAlert => {
  return 'category' in notification && notification.category !== 'system';
};

export const UnifiedNotificationCenter = ({ onNavigate }: { onNavigate?: (module: string) => void }) => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { vehicles, bookings, customers, damageClaims, inspections } = useFleet();
  const { prefs, isInQuietHours } = useNotificationPreferences();
  const { notifications: dbNotifications, markAsRead: markDbRead, markAllAsRead: markAllDbRead, deleteNotification: deleteDbNotification, clearAll: clearAllDb } = useNotifications();
  const [, setNotifSearchParams] = useSearchParams();
  
  const systemNotifications = useMemo<SystemNotification[]>(() => {
    return dbNotifications.map(n => ({
      id: n.id,
      type: (n.type === 'booking_update' || n.type === 'booking' ? 'info' : n.type === 'payment' ? 'success' : n.type === 'damage_claim' || n.type === 'damage' ? 'error' : 'info') as SystemNotification['type'],
      title: n.title,
      message: n.message,
      timestamp: n.timestamp,
      read: n.read,
      category: 'system' as const,
      data: n.data,
      notificationType: n.type,
    }));
  }, [dbNotifications]);

  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);

  // Haptic feedback when opening/closing
  useEffect(() => {
    if (open && isMobile && navigator.vibrate) {
      navigator.vibrate(5);
    }
  }, [open, isMobile]);

  const shouldShowNotification = (notification: UnifiedNotification): boolean => {
    // Always show critical alerts
    if (isAIAlert(notification) && notification.type === 'critical' && prefs.enableCriticalAlerts) {
      return true;
    }

    // Check quiet hours for non-critical
    if (isInQuietHours()) {
      return false;
    }

    // Check preferences
    if (isAIAlert(notification)) {
      if (!prefs.enableAIInsights) return false;
      if (notification.type === 'high' && !prefs.enableWarnings) return false;
      if (notification.type === 'medium' && !prefs.enableInfoAlerts) return false;
      if (notification.type === 'info' && !prefs.enableInfoAlerts) return false;
    } else {
      if (!prefs.enableSystemNotifications) return false;
      if (notification.type === 'warning' && !prefs.enableWarnings) return false;
      if (notification.type === 'info' && !prefs.enableInfoAlerts) return false;
      if (notification.type === 'error' && !prefs.enableCriticalAlerts) return false;
    }

    return true;
  };

  // Generate AI alerts from fleet data
  const aiAlerts = useMemo(() => {
    const alerts: AIAlert[] = [];
    const now = new Date();

    // High: Unresolved damage claims
    const unresolvedClaims = damageClaims.filter(c => c.claim_status !== 'resolved').length;
    if (unresolvedClaims > 0) {
      alerts.push({
        id: 'unresolved-claims',
        type: 'high',
        category: 'damage',
        title: 'Unresolved Damage Claims',
        description: `${unresolvedClaims} damage claim${unresolvedClaims > 1 ? 's' : ''} require attention`,
        action: 'vault',
        timestamp: now,
        read: false
      });
    }

    // High: Pricing opportunities
    const highValueVehicles = vehicles.filter(v => v.current_rate && v.current_rate > 1000);
    if (highValueVehicles.length > 0) {
      const potentialRevenue = Math.floor(highValueVehicles.length * 150);
      alerts.push({
        id: 'pricing-opportunity',
        type: 'high',
        category: 'pricing',
        title: 'Dynamic Pricing Opportunity',
        description: `${highValueVehicles.length} premium vehicles could benefit from AI pricing optimization (+$${potentialRevenue}/week)`,
        action: 'motoriq',
        timestamp: now,
        read: false
      });
    }

    // Medium: Low utilization
    const availableVehicles = vehicles.filter(v => v.status === 'available');
    if (availableVehicles.length > vehicles.length * 0.4) {
      alerts.push({
        id: 'low-utilization',
        type: 'medium',
        category: 'utilization',
        title: 'Fleet Utilization Below Target',
        description: `${availableVehicles.length} vehicles available - consider promotional pricing`,
        action: 'pulse',
        timestamp: now,
        read: false
      });
    }

    return alerts.filter(a => !dismissedAlerts.has(a.id));
  }, [vehicles, damageClaims, dismissedAlerts]);

  // Combine all notifications
  const allNotifications = useMemo(() => {
    return [...systemNotifications, ...aiAlerts].sort((a, b) => {
      const timeA = isAIAlert(a) ? a.timestamp.getTime() : new Date().getTime();
      const timeB = isAIAlert(b) ? b.timestamp.getTime() : new Date().getTime();
      return timeB - timeA;
    });
  }, [systemNotifications, aiAlerts]);

  const unreadCount = allNotifications.filter((n) => !n.read && shouldShowNotification(n)).length;
  const criticalCount = aiAlerts.filter(a => a.type === 'critical' && !a.read && shouldShowNotification(a)).length;

  // Update app badge count
  useEffect(() => {
    if ('setAppBadge' in navigator) {
      if (unreadCount > 0) {
        (navigator as any).setAppBadge(unreadCount);
      } else {
        (navigator as any).clearAppBadge();
      }
    }
  }, [unreadCount]);

  const getSystemIcon = (type: string) => {
    switch (type) {
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-warning" />;
      case "error":
        return <AlertTriangle className="w-4 h-4 text-destructive" />;
      case "success":
        return <CheckCircle className="w-4 h-4 text-success" />;
      default:
        return <Info className="w-4 h-4 text-primary" />;
    }
  };

  const getAIIcon = (category: string) => {
    switch (category) {
      case 'pricing':
        return <DollarSign className="w-4 h-4 text-gulf-blue" />;
      case 'utilization':
        return <TrendingUp className="w-4 h-4 text-gulf-blue" />;
      case 'maintenance':
        return <Wrench className="w-4 h-4 text-gulf-blue" />;
      case 'compliance':
        return <Shield className="w-4 h-4 text-gulf-blue" />;
      case 'demand':
        return <Calendar className="w-4 h-4 text-gulf-blue" />;
      case 'damage':
        return <AlertCircle className="w-4 h-4 text-rari-teal" />;
      default:
        return <Sparkles className="w-4 h-4 text-rari-teal" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'critical':
        return 'bg-destructive/10 text-destructive border-destructive/30';
      case 'high':
        return 'bg-warning/10 text-warning border-warning/30';
      case 'medium':
        return 'bg-gulf-blue/10 text-gulf-blue border-gulf-blue/30';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const markAsRead = (id: string) => {
    markDbRead(id);
  };

  const markAllAsRead = () => {
    if (navigator.vibrate) navigator.vibrate(5);
    markAllDbRead();
  };

  const deleteNotification = (id: string) => {
    deleteDbNotification(id);
    setDismissedAlerts(prev => new Set([...prev, id]));
  };

  const clearAll = () => {
    if (navigator.vibrate) navigator.vibrate([10, 50, 10]);
    clearAllDb();
    setDismissedAlerts(new Set(aiAlerts.map(a => a.id)));
  };

  const handleAlertAction = (alert: AIAlert) => {
    if (alert.action && onNavigate) {
      onNavigate(alert.action);
      setOpen(false);
      if (navigator.vibrate) navigator.vibrate(10);
    }
  };

  const handleSystemAction = (notification: SystemNotification) => {
    const data = notification.data;
    if (!data) return;
    const nType = notification.notificationType;
    const params: Record<string, string> = {};

    if (nType === 'booking' || nType === 'booking_update') {
      params.module = 'book';
      if (data.booking_id) params.bookingId = data.booking_id;
    } else if (nType === 'payment') {
      params.module = 'book';
      params.view = 'payments';
      if (data.booking_id) params.bookingId = data.booking_id;
    } else if (nType === 'damage' || nType === 'damage_claim') {
      params.module = 'vault';
      params.view = 'claims';
      if (data.claim_id) params.damageClaimId = data.claim_id;
    } else if (nType === 'maintenance') {
      params.module = 'fleet';
      params.tab = 'maintenance';
    } else {
      return;
    }

    setNotifSearchParams(params);
    setOpen(false);
    if (navigator.vibrate) navigator.vibrate(10);
  };

  const formatTimestamp = (timestamp: Date | string): string => {
    if (typeof timestamp === 'string') return timestamp;
    
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const handleSwipeDismiss = (notificationId: string, info: PanInfo) => {
    const swipeThreshold = 100;
    const velocity = info.velocity.x;
    const offset = info.offset.x;

    // Dismiss if swiped more than threshold or with high velocity
    if (Math.abs(offset) > swipeThreshold || Math.abs(velocity) > 500) {
      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(10);
      }
      deleteNotification(notificationId);
    }
  };

  const renderNotificationContent = (notifications: UnifiedNotification[]) => {
    const filteredNotifications = notifications.filter(shouldShowNotification);
    
    if (filteredNotifications.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Bell className="w-12 h-12 mb-2 opacity-20" />
          <p className="text-sm">No notifications</p>
          {isInQuietHours() && (
            <p className="text-xs mt-2">Quiet hours active</p>
          )}
        </div>
      );
    }

    return (
      <div className="divide-y">
        {filteredNotifications.map((notification) => {
          const isAI = isAIAlert(notification);

          return (
            <motion.div
              key={notification.id}
              drag={isMobile ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={isMobile ? (_: any, info: PanInfo) => handleSwipeDismiss(notification.id, info) : undefined}
              whileDrag={isMobile ? { cursor: "grabbing", scale: 0.98 } : undefined}
              className={`p-4 hover:bg-muted/30 transition-smooth ${
                isMobile ? "cursor-grab active:cursor-grabbing touch-manipulation" : ""
              } ${!notification.read ? "bg-gulf-blue/5" : ""}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3 flex-1">
                  <div className="mt-0.5">
                    {isAI ? getAIIcon(notification.category) : getSystemIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <h4 className="text-sm font-medium">
                        {notification.title}
                      </h4>
                      {isAI && (
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${getTypeColor(notification.type)}`}>
                          {notification.type.toUpperCase()}
                        </Badge>
                      )}
                      {!notification.read && (
                        <div className="w-2 h-2 rounded-full bg-gulf-blue flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {isAI ? notification.description : notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatTimestamp(isAI ? notification.timestamp : notification.timestamp)}
                    </p>
                    {isAI && notification.action && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 h-7 text-xs"
                        onClick={() => {
                          if (navigator.vibrate) navigator.vibrate(5);
                          handleAlertAction(notification);
                        }}
                      >
                        View Details
                      </Button>
                    )}
                    {!isAI && (notification as SystemNotification).data && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 h-7 text-xs"
                        onClick={() => {
                          if (navigator.vibrate) navigator.vibrate(5);
                          handleSystemAction(notification as SystemNotification);
                        }}
                      >
                        View Details
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-1 ml-2">
                  {!notification.read && !isAI && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => {
                        if (navigator.vibrate) navigator.vibrate(5);
                        markAsRead(notification.id);
                      }}
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => {
                      if (navigator.vibrate) navigator.vibrate(10);
                      deleteNotification(notification.id);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    );
  };

  const contentComponent = (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold">Notifications</h3>
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (navigator.vibrate) navigator.vibrate(5);
              setPrefsOpen(true);
            }}
            className="text-xs"
          >
            <Settings className="w-3 h-3 mr-1" />
            Settings
          </Button>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="text-xs"
            >
              <Check className="w-3 h-3 mr-1" />
              Mark all read
            </Button>
          )}
          {allNotifications.filter(shouldShowNotification).length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              className="text-xs"
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Clear all
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="mx-4 mt-4">
          <TabsTrigger value="all" className="flex-1">
            All
            {unreadCount > 0 && (
              <Badge className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center bg-gulf-blue text-white text-[10px]">
                {unreadCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex-1">
            <Sparkles className="w-3 h-3 mr-1" />
            AI Insights
            {aiAlerts.filter(a => !a.read && shouldShowNotification(a)).length > 0 && (
              <Badge className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center bg-gulf-blue text-white text-[10px]">
                {aiAlerts.filter(a => !a.read && shouldShowNotification(a)).length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="system" className="flex-1">
            System
            {systemNotifications.filter(n => !n.read && shouldShowNotification(n)).length > 0 && (
              <Badge className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center bg-gulf-blue text-white text-[10px]">
                {systemNotifications.filter(n => !n.read && shouldShowNotification(n)).length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="flex-1 mt-0">
          <ScrollArea className="h-[400px] md:h-[500px]">
            {renderNotificationContent(allNotifications)}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="ai" className="flex-1 mt-0">
          <ScrollArea className="h-[400px] md:h-[500px]">
            {renderNotificationContent(aiAlerts)}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="system" className="flex-1 mt-0">
          <ScrollArea className="h-[400px] md:h-[500px]">
            {renderNotificationContent(systemNotifications)}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );

  const triggerButton = (
    <Button
      variant="ghost"
      size="icon"
      className="relative"
      aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
    >
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && (
        <Badge
          className={`absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-white ${
            criticalCount > 0 ? 'bg-destructive' : 'bg-gulf-blue'
          }`}
        >
          {unreadCount > 9 ? '9+' : unreadCount}
        </Badge>
      )}
    </Button>
  );

  if (isMobile) {
    return (
      <>
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerTrigger asChild>
            {triggerButton}
          </DrawerTrigger>
          <DrawerContent className="max-h-[85vh]">
            <DrawerHeader>
              <DrawerTitle>Notifications & AI Insights</DrawerTitle>
            </DrawerHeader>
            {contentComponent}
          </DrawerContent>
        </Drawer>
        <NotificationPreferences open={prefsOpen} onOpenChange={setPrefsOpen} />
      </>
    );
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          {triggerButton}
        </PopoverTrigger>
        <PopoverContent className="w-[480px] p-0" align="end">
          {contentComponent}
        </PopoverContent>
      </Popover>
      <NotificationPreferences open={prefsOpen} onOpenChange={setPrefsOpen} />
    </>
  );
};
