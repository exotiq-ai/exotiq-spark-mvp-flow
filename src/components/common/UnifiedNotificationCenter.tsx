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
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useFleet } from "@/contexts/FleetContext";
import { useIsMobile } from "@/hooks/use-mobile";

interface SystemNotification {
  id: string;
  type: "info" | "warning" | "success" | "error";
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  category: "system";
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
  
  const [systemNotifications, setSystemNotifications] = useState<SystemNotification[]>([
    {
      id: "1",
      type: "warning",
      title: "Maintenance Due",
      message: "Lamborghini Huracán requires scheduled maintenance in 3 days",
      timestamp: "2 hours ago",
      read: false,
      category: "system"
    },
    {
      id: "2",
      type: "success",
      title: "Payment Received",
      message: "Payment of $2,100 has been received for booking #12345",
      timestamp: "3 hours ago",
      read: false,
      category: "system"
    },
    {
      id: "3",
      type: "info",
      title: "New Booking Request",
      message: "New booking inquiry for Ferrari 488 - Weekend rental",
      timestamp: "5 hours ago",
      read: true,
      category: "system"
    },
    {
      id: "4",
      type: "error",
      title: "Insurance Expiring",
      message: "Insurance for Porsche 911 GT3 expires in 5 days",
      timestamp: "1 day ago",
      read: true,
      category: "system"
    }
  ]);

  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<string>("all");
  const [open, setOpen] = useState(false);

  // Haptic feedback when opening/closing
  useEffect(() => {
    if (open && isMobile && navigator.vibrate) {
      navigator.vibrate(5);
    }
  }, [open, isMobile]);

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

  const unreadCount = allNotifications.filter((n) => !n.read).length;
  const criticalCount = aiAlerts.filter(a => a.type === 'critical' && !a.read).length;

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
        return <AlertCircle className="w-4 h-4 text-gulf-blue" />;
      default:
        return <Sparkles className="w-4 h-4 text-gulf-blue" />;
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
    if (systemNotifications.find(n => n.id === id)) {
      setSystemNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, read: true } : n))
      );
    }
  };

  const markAllAsRead = () => {
    if (navigator.vibrate) navigator.vibrate(5);
    setSystemNotifications(prev => prev.map(n => ({ ...n, read: true })));
    toast({
      title: "All notifications marked as read",
    });
  };

  const deleteNotification = (id: string) => {
    setSystemNotifications(prev => prev.filter(n => n.id !== id));
    setDismissedAlerts(prev => new Set([...prev, id]));
    toast({
      title: "Notification deleted",
    });
  };

  const clearAll = () => {
    if (navigator.vibrate) navigator.vibrate([10, 50, 10]);
    setSystemNotifications([]);
    setDismissedAlerts(new Set(aiAlerts.map(a => a.id)));
    toast({
      title: "All notifications cleared",
    });
  };

  const handleAlertAction = (alert: AIAlert) => {
    if (alert.action && onNavigate) {
      onNavigate(alert.action);
      setOpen(false);
      if (navigator.vibrate) navigator.vibrate(10);
    }
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
    if (notifications.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Bell className="w-12 h-12 mb-2 opacity-20" />
          <p className="text-sm">No notifications</p>
        </div>
      );
    }

    return (
      <div className="divide-y">
        {notifications.map((notification) => {
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
          {allNotifications.length > 0 && (
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
            {aiAlerts.filter(a => !a.read).length > 0 && (
              <Badge className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center bg-gulf-blue text-white text-[10px]">
                {aiAlerts.filter(a => !a.read).length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="system" className="flex-1">
            System
            {systemNotifications.filter(n => !n.read).length > 0 && (
              <Badge className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center bg-gulf-blue text-white text-[10px]">
                {systemNotifications.filter(n => !n.read).length}
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
    <Button variant="ghost" size="icon" className="relative">
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
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {triggerButton}
      </PopoverTrigger>
      <PopoverContent className="w-[480px] p-0" align="end">
        {contentComponent}
      </PopoverContent>
    </Popover>
  );
};
