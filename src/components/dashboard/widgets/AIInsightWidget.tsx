import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Zap, ArrowRight } from "lucide-react";
import { useCountUp } from "@/hooks/useCountUp";
import { motion } from "framer-motion";
import { fadeInUp, hoverLift } from "@/lib/animations";
import { SkeletonAIInsight } from "@/components/ui/skeleton-specialized";

interface AIInsightWidgetProps {
  onApplyOptimization: () => void;
  onViewAnalysis: () => void;
  isLoading?: boolean;
}

export const AIInsightWidget = ({ onApplyOptimization, onViewAnalysis, isLoading }: AIInsightWidgetProps) => {
  // Animated counting for potential revenue
  const { value: potentialValue } = useCountUp({
    end: 2250,
    duration: 2000,
    decimals: 0,
    prefix: '+$',
    suffix: '/mo potential'
  });

  // Animated counting for probability
  const { value: probabilityValue } = useCountUp({
    end: 89,
    duration: 1500,
    decimals: 0,
    suffix: '% probability'
  });

  if (isLoading) {
    return <SkeletonAIInsight />;
  }

  return (
    <motion.div
      initial="initial"
      animate="animate"
      variants={fadeInUp}
    >
      <Card 
        className="p-6 md:p-8 border-2 border-gulf-blue/30 shadow-md hover:shadow-lg transition-all overflow-hidden relative h-full"
        role="region"
        aria-labelledby="ai-insight-title"
      >
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-gulf-blue/5 via-accent/5 to-transparent bg-[length:200%_200%] animate-gradient-flow opacity-50" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:space-x-6 space-y-4 md:space-y-0">
          <motion.div 
            className="p-4 bg-gulf-blue/10 border-2 border-gulf-blue/30 rounded-2xl"
            whileHover={{ scale: 1.05, rotate: 5 }}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
          >
            <Sparkles className="h-8 w-8 md:h-10 md:w-10 text-gulf-blue animate-pulse-soft" aria-hidden="true" />
          </motion.div>
          <div className="flex-1 w-full">
            <div className="flex flex-col sm:flex-row items-start justify-between mb-3 gap-2">
              <div>
                <h3 id="ai-insight-title" className="text-xl md:text-2xl font-semibold mb-1">
                  FleetCopilot™ Recommendation
                </h3>
                <p className="text-xs md:text-sm text-muted-foreground">AI-powered pricing insight</p>
              </div>
              <Badge className="bg-success text-success-foreground border-transparent shadow-sm text-sm md:text-base px-3 md:px-4 py-1 animate-scale-spring">
                {potentialValue}
              </Badge>
            </div>
            <p className="text-muted-foreground mb-6 text-sm md:text-base leading-relaxed">
              Consider increasing the rate for your Ferrari 488 by 15% for weekend bookings. 
              Market demand shows <span className="font-semibold text-foreground animate-slide-up-fade">{probabilityValue}</span> of maintaining bookings at this price point.
            </p>
            <div className="flex flex-wrap gap-3">
              <motion.div {...hoverLift}>
                <Button 
                  size="lg"
                  className="touch-target min-h-[44px] hover:shadow-[0_0_20px_rgba(37,150,190,0.3)] transition-all"
                  onClick={onApplyOptimization}
                  aria-label="Apply pricing optimization recommendation"
                >
                  <Zap className="w-4 h-4 mr-2" aria-hidden="true" />
                  Apply Optimization
                </Button>
              </motion.div>
              <motion.div {...hoverLift}>
                <Button 
                  size="lg"
                  variant="outline" 
                  className="touch-target min-h-[44px]"
                  onClick={onViewAnalysis}
                  aria-label="View full pricing analysis"
                >
                  View Full Analysis
                  <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
                </Button>
              </motion.div>
              <Button 
                size="lg"
                variant="ghost"
                className="touch-target min-h-[44px]"
                aria-label="Dismiss recommendation"
              >
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
};