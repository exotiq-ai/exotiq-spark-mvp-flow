import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Zap, ArrowRight } from "lucide-react";

interface AIInsightWidgetProps {
  onApplyOptimization: () => void;
  onViewAnalysis: () => void;
}

export const AIInsightWidget = ({ onApplyOptimization, onViewAnalysis }: AIInsightWidgetProps) => {
  return (
    <Card 
      className="p-6 md:p-8 border-2 border-accent/30 shadow-md hover:shadow-lg transition-all bg-gradient-to-br from-background to-accent/5 h-full"
      role="region"
      aria-labelledby="ai-insight-title"
    >
      <div className="flex flex-col md:flex-row items-start md:space-x-6 space-y-4 md:space-y-0">
        <div className="p-4 bg-accent/10 border-2 border-accent/30 rounded-2xl">
          <Sparkles className="h-8 w-8 md:h-10 md:w-10 text-accent" aria-hidden="true" />
        </div>
        <div className="flex-1 w-full">
          <div className="flex flex-col sm:flex-row items-start justify-between mb-3 gap-2">
            <div>
              <h3 id="ai-insight-title" className="text-xl md:text-2xl font-semibold mb-1">
                FleetCopilot™ Recommendation
              </h3>
              <p className="text-xs md:text-sm text-muted-foreground">AI-powered pricing insight</p>
            </div>
            <Badge className="bg-success text-success-foreground border-transparent shadow-sm text-sm md:text-base px-3 md:px-4 py-1">
              +$2,250/mo potential
            </Badge>
          </div>
          <p className="text-muted-foreground mb-6 text-sm md:text-base leading-relaxed">
            Consider increasing the rate for your Ferrari 488 by 15% for weekend bookings. 
            Market demand shows <span className="font-semibold text-foreground">89% probability</span> of maintaining bookings at this price point.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button 
              size="lg"
              className="hover-scale touch-target min-h-[44px]"
              onClick={onApplyOptimization}
              aria-label="Apply pricing optimization recommendation"
            >
              <Zap className="w-4 h-4 mr-2" aria-hidden="true" />
              Apply Optimization
            </Button>
            <Button 
              size="lg"
              variant="outline" 
              className="hover-scale touch-target min-h-[44px]"
              onClick={onViewAnalysis}
              aria-label="View full pricing analysis"
            >
              View Full Analysis
              <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
            </Button>
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
  );
};