import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface MobileSummaryCardProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  value?: string | number;
  valueLabel?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  children?: React.ReactNode;
  expandable?: boolean;
  defaultExpanded?: boolean;
  onViewAll?: () => void;
  viewAllLabel?: string;
  className?: string;
}

export const MobileSummaryCard = ({
  title,
  subtitle,
  icon,
  value,
  valueLabel,
  trend,
  children,
  expandable = false,
  defaultExpanded = false,
  onViewAll,
  viewAllLabel = "View All",
  className,
}: MobileSummaryCardProps) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const handleToggle = () => {
    if (expandable) {
      if (navigator.vibrate) navigator.vibrate(5);
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <Card className={cn("overflow-hidden", className)}>
      {/* Summary Header - Always Visible */}
      <button
        onClick={handleToggle}
        disabled={!expandable}
        className={cn(
          "w-full p-4 flex items-center gap-3",
          expandable && "cursor-pointer active:bg-muted/30 transition-colors"
        )}
      >
        {/* Icon */}
        {icon && (
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            {icon}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm truncate">{title}</h3>
            {trend && (
              <span
                className={cn(
                  "text-xs font-medium px-1.5 py-0.5 rounded-full",
                  trend.isPositive
                    ? "bg-success/10 text-success"
                    : "bg-destructive/10 text-destructive"
                )}
              >
                {trend.isPositive ? "+" : ""}{trend.value}%
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
          )}
        </div>

        {/* Value or Expand Indicator */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {value !== undefined && (
            <div className="text-right">
              <p className="font-bold text-lg">{value}</p>
              {valueLabel && (
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  {valueLabel}
                </p>
              )}
            </div>
          )}
          {expandable && (
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            </motion.div>
          )}
        </div>
      </button>

      {/* Expandable Content */}
      <AnimatePresence>
        {isExpanded && children && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0 border-t border-border/50">
              <div className="pt-3">{children}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* View All Button */}
      {onViewAll && !expandable && (
        <div className="px-4 pb-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onViewAll}
            className="w-full justify-between text-primary hover:text-primary/80"
          >
            {viewAllLabel}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </Card>
  );
};
