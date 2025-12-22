import { Card } from "@/components/ui/card";
import { AnimatedMiniSparkline } from "@/components/charts/AnimatedMiniSparkline";
import { Calendar, Car, BarChart3, TrendingUp } from "lucide-react";
import { useCountUp } from "@/hooks/useCountUp";
import { motion } from "framer-motion";

export const MetricsWidget = () => {
  const bookingsSparkline = [12, 15, 13, 18, 16, 17, 18];
  const utilizationSparkline = [72, 75, 78, 76, 79, 77, 78];
  const rateSparkline = [320, 330, 325, 342, 338, 340, 342];

  // Count-up animations with staggered delays
  const bookingsCount = useCountUp({ end: 18, duration: 1500, delay: 200 });
  const utilizationCount = useCountUp({ end: 78, duration: 1500, delay: 400, suffix: '%' });
  const rateCount = useCountUp({ end: 342, duration: 1500, delay: 600, prefix: '$' });

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

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 h-full">
      <motion.div
        custom={0}
        variants={cardVariants}
        initial="hidden"
        animate="visible"
      >
        <Card 
          className="p-4 md:p-6 border-2 border-border hover:border-primary/50 transition-all touch-target h-full group"
          role="article"
          aria-label="Active Bookings Metric"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 bg-primary/10 rounded-xl group-hover:bg-primary/20 transition-colors">
              <Calendar className="h-5 w-5 md:h-6 md:w-6 text-primary" aria-hidden="true" />
            </div>
            <motion.div
              animate={{ rotate: [0, 10, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            >
              <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-success" aria-label="Trending up" />
            </motion.div>
          </div>
          <div className="text-2xl md:text-3xl font-bold mb-1" aria-label={`${bookingsCount.value} active bookings`}>
            {bookingsCount.value}
          </div>
          <div className="text-xs md:text-sm text-muted-foreground mb-4">Active Bookings</div>
          <div className="h-10">
            <AnimatedMiniSparkline 
              data={bookingsSparkline} 
              color="hsl(var(--primary))" 
              height={40}
              showGradient={true}
              showGlow={true}
            />
          </div>
          <div className="sr-only">
            Bookings trend data: {bookingsSparkline.join(', ')} bookings over 7 days
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
          className="p-4 md:p-6 border-2 border-border hover:border-success/50 transition-all touch-target h-full group"
          role="article"
          aria-label="Fleet Utilization Metric"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 bg-success/10 rounded-xl group-hover:bg-success/20 transition-colors">
              <Car className="h-5 w-5 md:h-6 md:w-6 text-success" aria-hidden="true" />
            </div>
            <motion.div
              animate={{ rotate: [0, 10, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 4 }}
            >
              <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-success" aria-label="Trending up" />
            </motion.div>
          </div>
          <div className="text-2xl md:text-3xl font-bold mb-1" aria-label={`${utilizationCount.value} fleet utilization`}>
            {utilizationCount.value}
          </div>
          <div className="text-xs md:text-sm text-muted-foreground mb-4">Fleet Utilization</div>
          <div className="h-10">
            <AnimatedMiniSparkline 
              data={utilizationSparkline} 
              color="hsl(var(--success))" 
              height={40}
              showGradient={true}
              showGlow={true}
            />
          </div>
          <div className="sr-only">
            Utilization trend data: {utilizationSparkline.join(', ')} percent over 7 days
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
          className="p-4 md:p-6 border-2 border-border hover:border-warning/50 transition-all touch-target h-full group"
          role="article"
          aria-label="Average Daily Rate Metric"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 bg-warning/10 rounded-xl group-hover:bg-warning/20 transition-colors">
              <BarChart3 className="h-5 w-5 md:h-6 md:w-6 text-warning" aria-hidden="true" />
            </div>
            <motion.div
              animate={{ rotate: [0, 10, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 5 }}
            >
              <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-success" aria-label="Trending up" />
            </motion.div>
          </div>
          <div className="text-2xl md:text-3xl font-bold mb-1" aria-label={`${rateCount.value} average daily rate`}>
            {rateCount.value}
          </div>
          <div className="text-xs md:text-sm text-muted-foreground mb-4">Average Daily Rate</div>
          <div className="h-10">
            <AnimatedMiniSparkline 
              data={rateSparkline} 
              color="hsl(var(--warning))" 
              height={40}
              showGradient={true}
              showGlow={true}
            />
          </div>
          <div className="sr-only">
            Daily rate trend data: {rateSparkline.map(r => `$${r}`).join(', ')} over 7 days
          </div>
        </Card>
      </motion.div>
    </div>
  );
};