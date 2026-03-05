import { Button } from "@/components/ui/button";
import { ExotiqLogo, ExotiqLogoBranded } from "@/components/common/ExotiqLogo";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useUserRole } from "@/hooks/useUserRole";
import { useProfile } from "@/hooks/useProfile";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { 
  Home,
  Brain,
  Calendar,
  BarChart3,
  TrendingUp,
  Shield,
  ChevronLeft,
  ChevronRight,
  User
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardSidebarProps {
  activeModule: string;
  onModuleChange: (moduleId: string) => void;
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
        "flex items-center rounded-xl p-3 hover:bg-sidebar-accent transition-colors cursor-pointer",
        collapsed ? "justify-center" : "space-x-3"
      )}>
        <Avatar className={cn(
          "w-8 h-8 flex-shrink-0 transition-all duration-300",
          "dark:border dark:border-white/20",
          "dark:shadow-[0_0_15px_rgba(255,255,255,0.15)]"
        )}>
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

// Nav button component
const NavButton = ({ module, isActive, collapsed, onModuleChange }: { 
  module: { id: string; name: string; icon: any; color: string }; 
  isActive: boolean; collapsed: boolean; onModuleChange: (id: string) => void 
}) => (
  <button
    onClick={() => onModuleChange(module.id)}
    data-tour={`nav-${module.id}`}
    className={cn(
      "w-full flex items-center rounded-lg transition-all duration-200 group relative",
      "min-h-[44px]",
      collapsed ? "justify-center p-3" : "justify-start p-3 space-x-3",
      isActive 
        ? "bg-sidebar-accent border-l-4 border-primary" 
        : "hover:bg-sidebar-accent/50 border-l-4 border-transparent hover:border-border"
    )}
    title={collapsed ? module.name : undefined}
  >
    <div className={cn("p-2 rounded-lg transition-all", isActive && "bg-primary/10")}>
      <module.icon className={cn("h-5 w-5 transition-colors", isActive ? "text-primary" : module.color)} />
    </div>
    {!collapsed && (
      <span className={cn("flex-1 text-left font-medium text-sm", isActive && "text-primary")}>
        {module.name}
      </span>
    )}
  </button>
);

export const DashboardSidebar = ({ activeModule, onModuleChange }: DashboardSidebarProps) => {
  const [collapsed, setCollapsed] = useLocalStorage("sidebarCollapsed", false);

  const intelligenceModules = [
    { id: "dashboard", name: "Dashboard", icon: Home, color: "text-primary" },
    { id: "core", name: "FleetCopilot™", icon: Brain, color: "text-primary" },
    { id: "motoriq", name: "MotorIQ", icon: TrendingUp, color: "text-primary" },
  ];

  const operationsModules = [
    { id: "pulse", name: "Pulse", icon: BarChart3, color: "text-primary" },
    { id: "book", name: "Book", icon: Calendar, color: "text-primary" },
    { id: "vault", name: "Vault", icon: Shield, color: "text-primary" },
  ];

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
            <ExotiqLogo variant="gulf-blue" size="md" />
          </div>
        ) : (
          <ExotiqLogoBranded variant="gulf-blue" size="md" />
        )}
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {/* Intelligence Group */}
        {!collapsed && (
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-3 pt-2 pb-1">
            Intelligence
          </p>
        )}
        {intelligenceModules.map((module) => {
          const isActive = activeModule === module.id || 
            (module.id === "motoriq" && activeModule === "optimize");
          return (
            <NavButton key={module.id} module={module} isActive={isActive} collapsed={collapsed} onModuleChange={onModuleChange} />
          );
        })}

        {/* Operations Group */}
        {!collapsed && (
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-3 pt-4 pb-1">
            Operations
          </p>
        )}
        {collapsed && <div className="h-3" />}
        {operationsModules.map((module) => {
          const isActive = activeModule === module.id;
          return (
            <NavButton key={module.id} module={module} isActive={isActive} collapsed={collapsed} onModuleChange={onModuleChange} />
          );
        })}
      </nav>

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
