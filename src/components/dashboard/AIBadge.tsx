import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TrendingUp, AlertCircle, Star, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

interface AIBadgeProps {
  variant: 'price-increase' | 'underutilized' | 'high-performer' | 'maintenance-due';
  value?: string;
  reason?: string;
  impact?: string;
  className?: string;
}

export const AIBadge = ({ variant, value, reason, impact, className }: AIBadgeProps) => {
  const config = {
    'price-increase': {
      icon: TrendingUp,
      label: value || '↑ +15%',
      color: 'bg-success/20 text-success border-success/30',
      tooltip: reason || 'AI suggests increasing price based on demand'
    },
    'underutilized': {
      icon: AlertCircle,
      label: value || 'Low util.',
      color: 'bg-warning/20 text-warning border-warning/30',
      tooltip: reason || 'Vehicle utilization below optimal threshold'
    },
    'high-performer': {
      icon: Star,
      label: value || 'Top 10%',
      color: 'bg-primary/20 text-primary border-primary/30',
      tooltip: reason || 'Exceptional performance metrics'
    },
    'maintenance-due': {
      icon: Wrench,
      label: value || 'Service due',
      color: 'bg-destructive/20 text-destructive border-destructive/30',
      tooltip: reason || 'Maintenance scheduled or overdue'
    }
  };

  const { icon: Icon, label, color, tooltip } = config[variant];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            className={cn(
              "cursor-help transition-all hover:scale-105 gap-1",
              color,
              className
            )}
          >
            <Icon className="w-3 h-3" />
            {label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-1">
            <p className="font-semibold text-sm">{tooltip}</p>
            {impact && (
              <p className="text-xs text-muted-foreground">Expected impact: {impact}</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
