import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AnimatedMiniSparkline } from "@/components/charts/AnimatedMiniSparkline";
import { Calendar, Car, BarChart3, TrendingUp, Plus } from "lucide-react";
import { useCountUp } from "@/hooks/useCountUp";
import { motion } from "framer-motion";
import { SkeletonHeroMetric } from "@/components/ui/skeleton-specialized";

interface MetricsWidgetProps {
  isLoading?: boolean;
  // Real data props
  activeBookings?: number;
  utilization?: number;
  averageRate?: number;
  bookingsTrend?: number[];
  utilizationTrend?: number[];
  rateTrend?: number[];
  hasFleetData?: boolean;
  onAddVehicle?: () => void;
}

export const MetricsWidget = ({ 
  isLoading,
  activeBookings = 0,
  utilization = 0,
  averageRate = 0,
  bookingsTrend,
  utilizationTrend,
  rateTrend,
  hasFleetData = false,
  onAddVehicle
}: MetricsWidgetProps) => {
  // Use real data or fallback to zeros for new accounts
  const bookingsSparkline = bookingsTrend || [0, 0, 0, 0, 0, 0, 0];
  const utilizationSparkline = utilizationTrend || [0, 0, 0, 0, 0, 0, 0];
  const rateSparkline = rateTrend || [0, 0, 0, 0, 0, 0, 0];

  // Count-up animations with staggered delays
  const bookingsCount = useCountUp({ end: activeBookings, duration: 1500, delay: 200 });
  const utilizationCount = useCountUp({ end: utilization, duration: 1500, delay: 400, suffix: '%' });
  const rateCount = useCountUp({ end: averageRate, duration: 1500, delay: 600, prefix: '$' });

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.1,
        duration: 0.5,
        ease: "easeOut" as const
      }
    })
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 h-full">
        <SkeletonHeroMetric />
        <SkeletonHeroMetric />
        <SkeletonHeroMetric />
      </div>
    );
  }

  // Empty state for new accounts with no fleet data
  if (!hasFleetData) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="p-8 md:p-12 border-2 border-dashed border-muted-foreground/20 bg-muted/5">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="p-4 bg-primary/10 rounded-2xl">
                <Car className="h-8 w-8 text-primary" />
              </div>
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2 text-foreground">Welcome to Your Fleet Dashboard</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Add your first vehicle to start tracking bookings, utilization, and revenue metrics in real-time.
              </p>
            </div>
            {onAddVehicle && (
              <Button onClick={onAddVehicle} className="btn-premium">
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Vehicle
              </Button>
            )}
          </div>
        </Card>
      </motion.div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 h-full">
      <motion.div
        custom={0}
        variants={cardVariants}
        initial="hidden"
        animate="visible"
      >
        <Card 
          variant="interactive"
          className="p-6 md:p-8 border border-border hover:border-primary/50 h-full group"
          role="article"
          aria-label="Active Bookings Metric"
        >
          <div className="flex items-start justify-between mb-4">
            <motion.div 
              className="p-3 bg-primary/10 rounded-xl group-hover:bg-primary/20 transition-colors"
              whileHover={{ scale: 1.1, rotate: 5 }}
              whileTap={{ scale: 0.95 }}
            >
              <Calendar className="h-5 w-5 md:h-6 md:w-6 text-primary" aria-hidden="true" />
            </motion.div>
            {activeBookings > 0 && (
              <motion.div
                animate={{ rotate: [0, 10, 0] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
              >
                <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-success" aria-label="Trending up" />
              </motion.div>
            )}
          </div>
          <motion.div 
            className="text-2xl md:text-3xl font-bold mb-1 tabular-nums text-foreground" 
            aria-label={`${bookingsCount.value} active bookings`}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
          >
            {bookingsCount.value}
          </motion.div>
          <div className="text-xs md:text-sm text-muted-foreground mb-4">Active Bookings</div>
          <div className="h-10">
            <AnimatedMiniSparkline 
              data={bookingsSparkline} 
              color="hsl(var(--primary))" 
              height={40}
              showGradient={true}
              showGlow={activeBookings > 0}
            />
          </div>
        </Card>
      </motion.div>

      <motion.div
        custom={1}
        variants={cardVariants}
        initial="hidden"
        animate="visible"
      >
        <Card 
          variant="interactive"
          className="p-6 md:p-8 border border-border hover:border-success/50 h-full group"
          role="article"
          aria-label="Fleet Utilization Metric"
        >
          <div className="flex items-start justify-between mb-4">
            <motion.div 
              className="p-3 bg-success/10 rounded-xl group-hover:bg-success/20 transition-colors"
              whileHover={{ scale: 1.1, rotate: -5 }}
              whileTap={{ scale: 0.95 }}
            >
              <Car className="h-5 w-5 md:h-6 md:w-6 text-success" aria-hidden="true" />
            </motion.div>
            {utilization > 0 && (
              <motion.div
                animate={{ rotate: [0, 10, 0] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 4 }}
              >
                <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-success" aria-label="Trending up" />
              </motion.div>
            )}
          </div>
          <motion.div 
            className="text-2xl md:text-3xl font-bold mb-1 tabular-nums text-foreground" 
            aria-label={`${utilizationCount.value} fleet utilization`}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.4, type: "spring", stiffness: 200 }}
          >
            {utilizationCount.value}
          </motion.div>
          <div className="text-xs md:text-sm text-muted-foreground mb-4">Fleet Utilization</div>
          <div className="h-10">
            <AnimatedMiniSparkline 
              data={utilizationSparkline} 
              color="hsl(var(--success))" 
              height={40}
              showGradient={true}
              showGlow={utilization > 0}
            />
          </div>
        </Card>
      </motion.div>

      <motion.div
        custom={2}
        variants={cardVariants}
        initial="hidden"
        animate="visible"
      >
        <Card 
          variant="interactive"
          className="p-6 md:p-8 border border-border hover:border-warning/50 h-full group"
          role="article"
          aria-label="Average Daily Rate Metric"
        >
          <div className="flex items-start justify-between mb-4">
            <motion.div 
              className="p-3 bg-warning/10 rounded-xl group-hover:bg-warning/20 transition-colors"
              whileHover={{ scale: 1.1, rotate: 5 }}
              whileTap={{ scale: 0.95 }}
            >
              <BarChart3 className="h-5 w-5 md:h-6 md:w-6 text-warning" aria-hidden="true" />
            </motion.div>
            {averageRate > 0 && (
              <motion.div
                animate={{ rotate: [0, 10, 0] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 5 }}
              >
                <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-success" aria-label="Trending up" />
              </motion.div>
            )}
          </div>
          <motion.div 
            className="text-2xl md:text-3xl font-bold mb-1 tabular-nums text-foreground" 
            aria-label={`${rateCount.value} average daily rate`}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
          >
            {rateCount.value}
          </motion.div>
          <div className="text-xs md:text-sm text-muted-foreground mb-4">Average Daily Rate</div>
          <div className="h-10">
            <AnimatedMiniSparkline 
              data={rateSparkline} 
              color="hsl(var(--warning))" 
              height={40}
              showGradient={true}
              showGlow={averageRate > 0}
            />
          </div>
        </Card>
      </motion.div>
    </div>
  );
};