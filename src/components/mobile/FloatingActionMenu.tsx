import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Calendar, DollarSign, UserPlus, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActionItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  color?: string;
}

interface FloatingActionMenuProps {
  actions: ActionItem[];
  className?: string;
  onMainClick?: () => void;
}

export const FloatingActionMenu = ({ actions, className }: FloatingActionMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => {
    if (navigator.vibrate) navigator.vibrate(isOpen ? 5 : 15);
    setIsOpen(!isOpen);
  };

  const handleAction = (action: ActionItem) => {
    if (navigator.vibrate) navigator.vibrate(10);
    action.onClick();
    setIsOpen(false);
  };

  return (
    <div 
      className={cn("fixed right-4 z-40 md:hidden", className)}
      style={{ 
        bottom: 'calc(6rem + env(safe-area-inset-bottom))' // Increased from 5rem to 6rem to clear nav bar
      }}
    >
      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-background/60 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Action Items */}
      <AnimatePresence>
        {isOpen && (
          <div className="absolute bottom-16 right-0 flex flex-col-reverse gap-2.5">
            {actions.map((action, index) => (
              <motion.button
                key={action.id}
                initial={{ opacity: 0, y: 20, scale: 0.8 }}
                animate={{ 
                  opacity: 1, 
                  y: 0, 
                  scale: 1,
                }}
                exit={{ 
                  opacity: 0, 
                  y: 10, 
                  scale: 0.8,
                }}
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 25,
                  delay: index * 0.04,
                }}
                onClick={() => handleAction(action)}
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.02 }}
                className="flex items-center gap-3 pl-3 pr-4 py-2.5 bg-card/90 backdrop-blur-lg rounded-full shadow-lg border border-border/80 hover:border-border active:bg-muted hover:shadow-xl transition-all duration-200"
              >
                <div className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center shadow-sm",
                  action.color || "bg-primary text-primary-foreground"
                )}>
                  {action.icon}
                </div>
                <span className="text-sm font-medium whitespace-nowrap pr-1">{action.label}</span>
              </motion.button>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Main FAB Button - Enhanced with Glassmorphism */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        whileHover={{ scale: 1.05 }}
        onClick={toggleMenu}
        className={cn(
          "w-14 h-14 rounded-full flex items-center justify-center",
          "backdrop-blur-xl border transition-all duration-300",
          "shadow-[0_8px_30px_rgba(0,0,0,0.12),0_4px_12px_rgba(0,0,0,0.08)]",
          "hover:shadow-[0_12px_40px_rgba(0,0,0,0.16),0_6px_16px_rgba(0,0,0,0.1)]",
          isOpen
            ? "bg-muted/80 text-foreground border-border/80 shadow-lg"
            : "bg-gradient-to-br from-primary via-primary to-primary-dark text-primary-foreground border-primary-light/30 shadow-[0_8px_30px_hsl(var(--primary)/0.35),0_0_60px_hsl(var(--primary)/0.15)]"
        )}
        style={{
          boxShadow: isOpen 
            ? undefined 
            : '0 8px 30px hsla(var(--primary), 0.35), 0 0 60px hsla(var(--primary), 0.15), inset 0 1px 1px rgba(255,255,255,0.15)'
        }}
        aria-label={isOpen ? "Close menu" : "Open quick actions"}
      >
        <motion.div
          animate={{ rotate: isOpen ? 45 : 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          <Plus className="h-6 w-6" strokeWidth={2.5} />
        </motion.div>
      </motion.button>
    </div>
  );
};

// Pre-configured action sets for different contexts
export const getDefaultActions = (handlers: {
  onNewBooking?: () => void;
  onRecordPayment?: () => void;
  onAddCustomer?: () => void;
  onGenerateReport?: () => void;
}): ActionItem[] => [
  {
    id: "new-booking",
    label: "New Booking",
    icon: <Calendar className="h-4 w-4" />,
    onClick: handlers.onNewBooking || (() => {}),
    color: "bg-primary text-primary-foreground",
  },
  {
    id: "record-payment",
    label: "Record Payment",
    icon: <DollarSign className="h-4 w-4" />,
    onClick: handlers.onRecordPayment || (() => {}),
    color: "bg-success text-success-foreground",
  },
  {
    id: "add-customer",
    label: "Add Customer",
    icon: <UserPlus className="h-4 w-4" />,
    onClick: handlers.onAddCustomer || (() => {}),
    color: "bg-secondary text-secondary-foreground",
  },
  {
    id: "generate-report",
    label: "Generate Report",
    icon: <FileText className="h-4 w-4" />,
    onClick: handlers.onGenerateReport || (() => {}),
    color: "bg-accent text-accent-foreground",
  },
];
