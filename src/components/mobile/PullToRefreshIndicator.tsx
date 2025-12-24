import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  isRefreshing: boolean;
  progress: number;
  threshold?: number;
}

export const PullToRefreshIndicator = ({
  pullDistance,
  isRefreshing,
  progress,
  threshold = 80,
}: PullToRefreshIndicatorProps) => {
  if (pullDistance === 0 && !isRefreshing) return null;

  return (
    <motion.div
      className="absolute left-0 right-0 flex justify-center z-50 pointer-events-none"
      style={{ top: pullDistance - 40 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: pullDistance > 20 || isRefreshing ? 1 : 0 }}
    >
      <div
        className={cn(
          "w-10 h-10 rounded-full bg-background shadow-lg border border-border flex items-center justify-center",
          isRefreshing && "animate-pulse"
        )}
      >
        <motion.div
          animate={{
            rotate: isRefreshing ? 360 : progress * 180,
          }}
          transition={{
            rotate: isRefreshing
              ? { repeat: Infinity, duration: 1, ease: "linear" }
              : { duration: 0 },
          }}
        >
          <RefreshCw
            className={cn(
              "h-5 w-5",
              progress >= 1 || isRefreshing
                ? "text-primary"
                : "text-muted-foreground"
            )}
          />
        </motion.div>
      </div>
    </motion.div>
  );
};
