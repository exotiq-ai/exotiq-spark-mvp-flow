import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, X, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { cn } from "@/lib/utils";

interface CompactAIInsightBannerProps {
  vehicleName: string;
  suggestedIncrease: number;
  potentialRevenue: number;
  onApply: () => void;
  onViewAnalysis: () => void;
  hasFleetData: boolean;
}

export const CompactAIInsightBanner = ({
  vehicleName,
  suggestedIncrease,
  potentialRevenue,
  onApply,
  onViewAnalysis,
  hasFleetData,
}: CompactAIInsightBannerProps) => {
  const [dismissedUntil, setDismissedUntil] = useLocalStorage<number | null>(
    "aiInsightDismissedUntil",
    null
  );

  const isDismissed = dismissedUntil && Date.now() < dismissedUntil;

  const handleDismiss = () => {
    // Dismiss for 24 hours
    setDismissedUntil(Date.now() + 24 * 60 * 60 * 1000);
  };

  const handleShowInsight = () => {
    setDismissedUntil(null);
  };

  if (!hasFleetData) return null;

  // Show minimized state when dismissed
  if (isDismissed) {
    return (
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={handleShowInsight}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <Sparkles className="h-3.5 w-3.5 text-warning" />
        <span>View AI Insight</span>
        <ChevronRight className="h-3.5 w-3.5" />
      </motion.button>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={cn(
          "flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4",
          "p-3 sm:p-4 rounded-lg",
          "bg-warning/5 border border-warning/30",
          "transition-all"
        )}
      >
        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
          <div className="p-1.5 bg-warning/10 rounded-lg flex-shrink-0">
            <Sparkles className="h-4 w-4 text-warning" />
          </div>
          <div className="text-sm min-w-0">
            <span className="text-muted-foreground">
              Consider +{suggestedIncrease}% rate for{" "}
            </span>
            <span className="font-medium text-foreground truncate">
              {vehicleName}
            </span>
            {potentialRevenue > 0 && (
              <span className="text-success font-semibold ml-1">
                — +${potentialRevenue}/mo potential
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto">
          <Button
            size="sm"
            onClick={onApply}
            className="flex-1 sm:flex-none bg-warning hover:bg-warning/90 text-warning-foreground"
          >
            Apply
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onViewAnalysis}
            className="flex-1 sm:flex-none"
          >
            Details
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleDismiss}
            className="h-8 w-8"
            aria-label="Dismiss recommendation"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
