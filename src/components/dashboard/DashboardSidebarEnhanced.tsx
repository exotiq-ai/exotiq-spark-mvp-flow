import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useUserRole } from "@/hooks/useUserRole";
import { useProfile } from "@/hooks/useProfile";
import { useRariInsightsCount } from "@/hooks/useRariInsightsCount";
import { 
  Home,
  Brain,
  Calendar,
  BarChart3,
  TrendingUp,
  Shield,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Settings,
  Sparkles,
  Activity,
  MessageSquare,
  Car
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface DashboardSidebarEnhancedProps {
  activeModule: string;
  onModuleChange: (moduleId: string) => void;
  onOpenRari?: () => void;
}

interface NavGroup {
  id: string;
  name: string;
  items: NavItem[];
}

interface NavItem {
  id: string;
  name: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  minRole?: 'admin' | 'manager' | 'operator' | 'viewer';
}

// Role display mapping
const roleDisplayNames: Record<string, string> = {
  admin: 'Administrator',
  manager: 'Manager',
  operator: 'Operator',
  viewer: 'Viewer',
};

// User Profile Section Component
const UserProfileSection = ({ collapsed }: { collapsed: boolean }) => {
  const { profile, displayName } = useProfile();
  const { role, loading } = useUserRole();
  
  const roleLabel = role ? roleDisplayNames[role] : 'Loading...';
  const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  
  return (
    <div className="p-3 border-t border-sidebar-border">
      <div className={cn(
        "flex items-center rounded-xl p-2.5 hover:bg-sidebar-accent transition-colors cursor-pointer",
        collapsed ? "justify-center" : "space-x-3"
      )}>
        <Avatar className="w-8 h-8 flex-shrink-0">
          <AvatarImage src={profile?.avatar_url || undefined} />
          <AvatarFallback className="bg-primary text-primary-foreground text-xs">
            {initials}
          </AvatarFallback>
        </Avatar>
        
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{displayName}</p>
            <div className="flex items-center gap-1.5">
              {loading ? (
                <span className="text-xs text-muted-foreground">Loading...</span>
              ) : (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {roleLabel}
                </Badge>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Rari Quick Access Section
const RariQuickAccess = ({ 
  collapsed, 
  onClick 
}: { 
  collapsed: boolean; 
  onClick?: () => void;
}) => {
  const { count: unreadCount, urgentCount, highCount } = useRariInsightsCount();
  const totalBadge = urgentCount > 0 ? urgentCount : (highCount > 0 ? highCount : unreadCount);
  
  const getBadgeClasses = () => {
    if (urgentCount > 0) {
      return "bg-destructive text-destructive-foreground animate-pulse";
    }
    if (highCount > 0) {
      return "bg-orange-500 text-white";
    }
    return "bg-yellow-500 text-slate-900";
  };

  return (
    <div className="px-3 py-2">
      <motion.button
        onClick={onClick}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={cn(
          "w-full flex items-center rounded-xl transition-all duration-200 relative",
          "bg-gradient-to-r from-rari-teal/20 to-success/10",
          "border border-rari-teal/30 hover:border-rari-teal/50",
          "hover:shadow-md hover:shadow-rari-teal/10",
          collapsed ? "justify-center p-3" : "justify-start p-3 space-x-3"
        )}
        title={collapsed ? "Ask Rari AI" : undefined}
      >
        <div className={cn(
          "flex items-center justify-center rounded-lg",
          "bg-gradient-to-br from-rari-teal to-success",
          collapsed ? "w-8 h-8" : "w-9 h-9"
        )}>
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        
        {!collapsed && (
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-foreground">Ask Rari</p>
            <p className="text-[11px] text-muted-foreground">Voice AI Assistant</p>
          </div>
        )}
        
        {/* Badge */}
        {totalBadge > 0 && (
          <span className={cn(
            "absolute text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1",
            collapsed ? "-top-1 -right-1" : "top-2 right-2",
            getBadgeClasses()
          )}>
            {totalBadge > 9 ? '9+' : totalBadge}
          </span>
        )}
      </motion.button>
    </div>
  );
};

export const DashboardSidebarEnhanced = ({ 
  activeModule, 
  onModuleChange,
  onOpenRari 
}: DashboardSidebarEnhancedProps) => {
  const [collapsed, setCollapsed] = useLocalStorage("sidebarCollapsed", false);
  const [expandedGroups, setExpandedGroups] = useLocalStorage<string[]>("sidebarExpandedGroups", ["operations", "intelligence"]);
  const { hasRoleOrHigher, isReadOnly, loading: roleLoading } = useUserRole();

  // Role hierarchy for filtering
  const roleHierarchy: Record<string, number> = {
    admin: 4,
    manager: 3,
    operator: 2,
    viewer: 1,
  };

  const allNavGroups: NavGroup[] = [
    {
      id: "operations",
      name: "Operations",
      items: [
        { id: "dashboard", name: "Dashboard", icon: Home },
        { id: "book", name: "Bookings", icon: Calendar, minRole: 'operator' },
        { id: "fleet", name: "Fleet", icon: Car, minRole: 'operator' },
        { id: "motoriq", name: "MotorIQ", icon: TrendingUp, minRole: 'manager' },
        { id: "pulse", name: "Pulse", icon: BarChart3, minRole: 'operator' },
      ]
    },
    {
      id: "intelligence",
      name: "Intelligence",
      items: [
        { id: "core", name: "FleetCopilot™", icon: Brain, minRole: 'operator' },
        { id: "vault", name: "Vault", icon: Shield, minRole: 'operator' },
      ]
    },
    {
      id: "team",
      name: "Team",
      items: [
        { id: "team-hub", name: "Team Hub", icon: Activity, minRole: 'manager' },
        { id: "messages", name: "Messages", icon: MessageSquare, minRole: 'operator' },
      ]
    },
    {
      id: "management",
      name: "Management",
      items: [
        { id: "settings", name: "Settings", icon: Settings, minRole: 'manager' },
      ]
    }
  ];

  // Filter nav items based on user role
  const navGroups = allNavGroups.map(group => ({
    ...group,
    items: group.items.filter(item => {
      if (!item.minRole) return true; // No restriction
      return hasRoleOrHigher(item.minRole);
    })
  })).filter(group => group.items.length > 0); // Remove empty groups

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => 
      prev.includes(groupId) 
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const isGroupExpanded = (groupId: string) => expandedGroups.includes(groupId);

  return (
    <aside 
      className={cn(
        "hidden md:flex flex-col h-screen bg-sidebar-background border-r border-sidebar-border transition-all duration-300 sticky top-0",
        collapsed ? "w-[72px]" : "w-[240px]"
      )}
    >
      {/* Logo Section */}
      <div className="p-4 border-b border-sidebar-border">
        {collapsed ? (
          <div className="flex justify-center">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center shadow-sm">
              <span className="text-xl font-bold text-primary-foreground">E</span>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <Logo size="lg" className="h-10" />
          </div>
        )}
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 p-3 space-y-2 overflow-y-auto">
        {navGroups.map((group) => {
          const isExpanded = isGroupExpanded(group.id);
          const hasActiveItem = group.items.some(
            item => activeModule === item.id || (item.id === "motoriq" && activeModule === "optimize")
          );

          return (
            <div key={group.id} className="space-y-1">
              {/* Group Header - Only show when not collapsed */}
              {!collapsed && (
                <button
                  onClick={() => toggleGroup(group.id)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider rounded-lg transition-colors",
                    hasActiveItem ? "text-primary" : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50"
                  )}
                >
                  <span>{group.name}</span>
                  <motion.div
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown className="h-3 w-3" />
                  </motion.div>
                </button>
              )}

              {/* Group Items */}
              <AnimatePresence initial={false}>
                {(collapsed || isExpanded) && (
                  <motion.div
                    initial={collapsed ? false : { height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-0.5"
                  >
                    {group.items.map((item) => {
                      const isActive = activeModule === item.id || 
                        (item.id === "motoriq" && activeModule === "optimize");
                      
                      return (
                        <button
                          key={item.id}
                          onClick={() => onModuleChange(item.id)}
                          className={cn(
                            "w-full flex items-center rounded-lg transition-all duration-200 group relative",
                            "min-h-[40px]",
                            collapsed ? "justify-center p-2.5" : "justify-start p-2.5 pl-6 space-x-3",
                            isActive 
                              ? "bg-primary/10 text-primary" 
                              : "hover:bg-sidebar-accent/50 text-muted-foreground hover:text-foreground"
                          )}
                          title={collapsed ? item.name : undefined}
                        >
                          {/* Active indicator */}
                          {isActive && (
                            <motion.div
                              layoutId="activeIndicator"
                              className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-full"
                              transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            />
                          )}
                          
                          <item.icon className={cn(
                            "h-4 w-4 transition-colors flex-shrink-0",
                            isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                          )} />
                          
                          {!collapsed && (
                            <span className={cn(
                              "text-sm font-medium",
                              isActive && "text-primary"
                            )}>
                              {item.name}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>

      {/* Rari Quick Access - Above User Profile */}
      <RariQuickAccess collapsed={collapsed} onClick={onOpenRari} />

      {/* User Profile Section */}
      <UserProfileSection collapsed={collapsed} />

      {/* Collapse Toggle */}
      <div className="p-3 border-t border-sidebar-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "w-full flex items-center justify-center hover:bg-sidebar-accent",
            collapsed ? "px-2" : "px-3"
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4 mr-2" />
              <span className="text-xs">Collapse</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
};
