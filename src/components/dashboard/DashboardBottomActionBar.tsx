import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  CalendarPlus,
  CreditCard,
  UserPlus,
  FileText,
  Wrench,
  Sparkles,
} from "lucide-react";

interface ActionItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
}

interface DashboardBottomActionBarProps {
  onNewBooking: () => void;
  onRecordPayment: () => void;
  onAddCustomer: () => void;
  onGenerateReport: () => void;
  onScheduleMaintenance: () => void;
  onAskRari: () => void;
  rariUnreadCount?: number;
}

export const DashboardBottomActionBar = ({
  onNewBooking,
  onRecordPayment,
  onAddCustomer,
  onGenerateReport,
  onScheduleMaintenance,
  onAskRari,
  rariUnreadCount = 0,
}: DashboardBottomActionBarProps) => {
  const actions: ActionItem[] = [
    {
      id: "booking",
      label: "Booking",
      icon: CalendarPlus,
      onClick: onNewBooking,
    },
    {
      id: "payment",
      label: "Payment",
      icon: CreditCard,
      onClick: onRecordPayment,
    },
    {
      id: "customer",
      label: "Customer",
      icon: UserPlus,
      onClick: onAddCustomer,
    },
    {
      id: "report",
      label: "Report",
      icon: FileText,
      onClick: onGenerateReport,
    },
    {
      id: "service",
      label: "Service",
      icon: Wrench,
      onClick: onScheduleMaintenance,
    },
  ];

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className={cn(
        "fixed bottom-0 left-0 right-0 z-30",
        "border-t bg-background/80 backdrop-blur-lg",
        "hidden md:block", // Only show on desktop (mobile has bottom nav)
        "pb-safe" // Safe area for notched phones
      )}
    >
      <div className="max-w-[650px] mx-auto flex items-center justify-around py-3 px-4">
        {/* Quick Action Buttons */}
        {actions.map((action, index) => (
          <motion.button
            key={action.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={action.onClick}
            className={cn(
              "flex flex-col items-center justify-center gap-1",
              "min-w-[56px] py-1.5 px-2",
              "text-muted-foreground hover:text-foreground",
              "transition-colors duration-200",
              "group"
            )}
          >
            <div className="p-2 rounded-xl bg-muted/50 group-hover:bg-muted transition-colors">
              <action.icon className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-medium">{action.label}</span>
          </motion.button>
        ))}

        {/* Rari AI Button - Special styling */}
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, type: "spring" }}
          onClick={onAskRari}
          className={cn(
            "relative flex flex-col items-center justify-center gap-1",
            "min-w-[56px] py-1.5 px-2"
          )}
        >
          <div
            className={cn(
              "p-2.5 rounded-full",
              "bg-gradient-to-br from-rari-teal to-success",
              "text-white shadow-lg",
              "transition-transform hover:scale-105"
            )}
          >
            <Sparkles className="h-5 w-5" />
          </div>
          <span className="text-[10px] font-medium text-foreground">Rari</span>
          
          {/* Notification badge */}
          {rariUnreadCount > 0 && (
            <span className="absolute top-0 right-1 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1">
              {rariUnreadCount > 9 ? "9+" : rariUnreadCount}
            </span>
          )}
        </motion.button>
      </div>
    </motion.div>
  );
};
