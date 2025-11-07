import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/ui/logo";
import { useLocalStorage } from "@/hooks/useLocalStorage";
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

export const DashboardSidebar = ({ activeModule, onModuleChange }: DashboardSidebarProps) => {
  const [collapsed, setCollapsed] = useLocalStorage("sidebarCollapsed", false);

  const modules = [
    { 
      id: "dashboard", 
      name: "Dashboard", 
      icon: Home, 
      badge: null,
      color: "text-primary"
    },
    { 
      id: "core", 
      name: "FleetCopilot™", 
      icon: Brain, 
      badge: "AI",
      color: "text-destructive"
    },
    { 
      id: "book", 
      name: "Book", 
      icon: Calendar, 
      badge: "8",
      color: "text-accent"
    },
    { 
      id: "pulse", 
      name: "Pulse", 
      icon: BarChart3, 
      badge: "Live",
      color: "text-primary"
    },
    { 
      id: "motoriq", 
      name: "MotorIQ", 
      icon: TrendingUp, 
      badge: "+12%",
      color: "text-success"
    },
    { 
      id: "vault", 
      name: "Vault", 
      icon: Shield, 
      badge: "24",
      color: "text-warning"
    }
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
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center shadow-sm">
              <span className="text-xl font-bold text-primary-foreground">E</span>
            </div>
          </div>
        ) : (
          <Logo size="md" className="h-8" />
        )}
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {modules.map((module) => {
          const isActive = activeModule === module.id || 
            (module.id === "motoriq" && activeModule === "optimize");
          
          return (
            <button
              key={module.id}
              onClick={() => onModuleChange(module.id)}
              className={cn(
                "w-full flex items-center rounded-xl transition-all duration-200 group relative",
                collapsed ? "justify-center p-3" : "justify-start p-3 space-x-3",
                isActive 
                  ? "bg-primary text-primary-foreground shadow-md" 
                  : "hover:bg-muted text-foreground"
              )}
              title={collapsed ? module.name : undefined}
            >
              <div className={cn(
                "relative p-2 rounded-lg transition-all duration-300",
                "dark:bg-white/5 dark:backdrop-blur-sm dark:border dark:border-white/10",
                "dark:shadow-[0_0_15px_rgba(255,255,255,0.1)]",
                "group-hover:dark:bg-white/10 group-hover:dark:shadow-[0_0_20px_rgba(255,255,255,0.15)]",
                isActive && "dark:bg-primary/20 dark:border-primary/30 dark:shadow-[0_0_20px_rgba(59,130,246,0.3)]"
              )}>
                <module.icon className={cn(
                  "h-5 w-5 transition-colors relative z-10",
                  isActive ? "text-primary dark:drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]" : module.color,
                  "dark:drop-shadow-[0_0_6px_rgba(255,255,255,0.3)]"
                )} />
              </div>
              
              {!collapsed && (
                <>
                  <span className="flex-1 text-left font-medium text-sm">
                    {module.name}
                  </span>
                  
                  {module.badge && (
                    <Badge 
                      variant="secondary" 
                      className={cn(
                        "text-xs px-2 py-0",
                        isActive && "bg-primary/20 text-primary border-primary/30"
                      )}
                    >
                      {module.badge}
                    </Badge>
                  )}
                </>
              )}

              {collapsed && module.badge && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                  <span className="text-[8px] text-primary-foreground font-bold">
                    {module.badge.length > 2 ? '9+' : module.badge}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* User Profile Section */}
      <div className="p-3 border-t border-sidebar-border">
        <div className={cn(
          "flex items-center rounded-xl p-3 hover:bg-sidebar-accent transition-colors cursor-pointer",
          collapsed ? "justify-center" : "space-x-3"
        )}>
          <div className={cn(
            "w-8 h-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300",
            "dark:bg-white/10 dark:backdrop-blur-sm dark:border dark:border-white/20",
            "dark:shadow-[0_0_15px_rgba(255,255,255,0.15)]"
          )}>
            <User className={cn(
              "h-4 w-4 text-primary-foreground",
              "dark:drop-shadow-[0_0_6px_rgba(255,255,255,0.4)]"
            )} />
          </div>
          
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">John Doe</p>
              <p className="text-xs text-muted-foreground truncate">Fleet Manager</p>
            </div>
          )}
        </div>
      </div>

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
