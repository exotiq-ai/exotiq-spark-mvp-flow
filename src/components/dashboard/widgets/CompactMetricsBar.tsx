import { Calendar, Car, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface CompactMetricsBarProps {
  activeBookings: number;
  utilization: number;
  averageRate: number;
  onNavigate: (moduleId: string) => void;
}

export const CompactMetricsBar = ({
  activeBookings,
  utilization,
  averageRate,
  onNavigate,
}: CompactMetricsBarProps) => {
  const metrics = [
    {
      id: "book",
      label: "Active",
      value: activeBookings,
      icon: Calendar,
      color: "text-primary",
      borderColor: "hover:border-primary/50",
      bgColor: "hover:bg-primary/5",
    },
    {
      id: "pulse",
      label: "Utilization",
      value: `${utilization}%`,
      icon: Car,
      color: "text-success",
      borderColor: "hover:border-success/50",
      bgColor: "hover:bg-success/5",
    },
    {
      id: "motoriq",
      label: "Avg Rate",
      value: `$${averageRate.toLocaleString()}`,
      icon: BarChart3,
      color: "text-warning",
      borderColor: "hover:border-warning/50",
      bgColor: "hover:bg-warning/5",
    },
  ];

  return (
    <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto pb-1 scrollbar-hide">
      {metrics.map((metric, index) => (
        <motion.button
          key={metric.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          onClick={() => onNavigate(metric.id)}
          className={cn(
            "flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5",
            "rounded-full border border-border bg-card",
            "transition-all duration-200",
            "flex-shrink-0 touch-target",
            metric.borderColor,
            metric.bgColor
          )}
          title={`Click to view ${metric.label} details`}
        >
          <metric.icon className={cn("h-4 w-4", metric.color)} />
          <span className="font-bold text-sm sm:text-base tabular-nums text-foreground">
            {metric.value}
          </span>
          <span className="text-xs sm:text-sm text-muted-foreground hidden sm:inline">
            {metric.label}
          </span>
        </motion.button>
      ))}
    </div>
  );
};
