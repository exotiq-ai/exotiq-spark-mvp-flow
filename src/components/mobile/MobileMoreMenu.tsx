import { useState } from "react";
import { motion } from "framer-motion";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { 
  MoreHorizontal, 
  Shield, 
  Settings, 
  User, 
  HelpCircle,
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

  const isActive = activeModule === "vault" || activeModule === "settings";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <motion.button
          whileTap={{ scale: 0.92 }}
          className={cn(
            "flex flex-col items-center justify-center py-2 px-1 rounded-2xl transition-colors min-h-[56px]",
            isActive
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground active:bg-muted/50"
          )}
          aria-label="More options"
        >
          <MoreHorizontal className="h-5 w-5 mb-0.5" strokeWidth={isActive ? 2.5 : 2} />
          <span className="text-[10px] font-semibold tracking-tight">More</span>
        </motion.button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-3xl pb-8 pt-2 px-4">
        {/* Drag Handle */}
        <div className="flex justify-center py-2 mb-2">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>
        
        <SheetHeader className="text-left pb-3">
          <SheetTitle className="text-base font-semibold">More Options</SheetTitle>
        </SheetHeader>
        
        {/* Primary Navigation Items */}
        <div className="space-y-2 mb-5">
          {menuItems.map((item, index) => (
            <motion.button
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, type: "spring", stiffness: 300, damping: 25 }}
              onClick={() => handleItemClick(item.id)}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "w-full flex items-center justify-between p-3.5 rounded-2xl transition-colors",
                activeModule === item.id
                  ? "bg-primary/10 border border-primary/20"
                  : "bg-muted/40 active:bg-muted"
              )}
            >
              <div className="flex items-center gap-3.5">
                <div className={cn(
                  "w-11 h-11 rounded-xl flex items-center justify-center",
                  activeModule === item.id ? "bg-primary text-primary-foreground" : "bg-background shadow-sm"
                )}>
                  <item.icon className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-sm">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </motion.button>
          ))}
        </div>

        {/* Divider */}
        <div className="h-px bg-border/60 my-3" />

        {/* Secondary Items */}
        <div className="space-y-0.5">
          {secondaryItems.map((item, index) => (
            <motion.button
              key={item.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15 + index * 0.03 }}
              onClick={() => handleItemClick(item.id)}
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-muted-foreground active:bg-muted/50 transition-colors"
            >
              <item.icon className="h-5 w-5" />
              <span className="text-sm font-medium">{item.label}</span>
            </motion.button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
};
