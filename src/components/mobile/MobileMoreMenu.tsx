import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { 
  MoreHorizontal, 
  Shield, 
  Settings, 
  User, 
  HelpCircle,
  LogOut,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileMoreMenuProps {
  activeModule: string;
  onModuleChange: (moduleId: string) => void;
}

export const MobileMoreMenu = ({ activeModule, onModuleChange }: MobileMoreMenuProps) => {
  const [open, setOpen] = useState(false);

  const menuItems = [
    { 
      id: "vault", 
      label: "Vault", 
      description: "Documents & Compliance",
      icon: Shield 
    },
    { 
      id: "settings", 
      label: "Settings", 
      description: "Preferences & Account",
      icon: Settings 
    },
  ];

  const secondaryItems = [
    { id: "help", label: "Help & Support", icon: HelpCircle },
    { id: "profile", label: "Profile", icon: User },
  ];

  const handleItemClick = (itemId: string) => {
    if (navigator.vibrate) navigator.vibrate(10);
    onModuleChange(itemId);
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className={cn(
            "flex flex-col items-center justify-center py-2 px-1.5 rounded-lg transition-all touch-target focus-visible",
            activeModule === "vault" || activeModule === "settings"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted/50"
          )}
          aria-label="More options"
        >
          <MoreHorizontal className="h-5 w-5 mb-1" />
          <span className="text-[10px] font-medium">More</span>
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-3xl pb-safe">
        <SheetHeader className="text-left pb-4">
          <SheetTitle className="text-lg font-semibold">More Options</SheetTitle>
        </SheetHeader>
        
        {/* Primary Navigation Items */}
        <div className="space-y-2 mb-6">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleItemClick(item.id)}
              className={cn(
                "w-full flex items-center justify-between p-4 rounded-xl transition-all",
                activeModule === item.id
                  ? "bg-primary/10 border border-primary/20"
                  : "bg-muted/50 hover:bg-muted"
              )}
            >
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center",
                  activeModule === item.id ? "bg-primary text-primary-foreground" : "bg-background"
                )}>
                  <item.icon className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <p className="font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="border-t border-border my-4" />

        {/* Secondary Items */}
        <div className="space-y-1">
          {secondaryItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleItemClick(item.id)}
              className="w-full flex items-center gap-3 p-3 rounded-lg text-muted-foreground hover:bg-muted/50 transition-all"
            >
              <item.icon className="h-5 w-5" />
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
};
