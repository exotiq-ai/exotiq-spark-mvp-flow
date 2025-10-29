import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Brain, 
  TrendingUp, 
  Zap,
  CheckCircle,
  ArrowRight,
  Sparkles
} from "lucide-react";
import { useState } from "react";

export const MotorIQEnhanced = () => {
  const [isLoading] = useState(false);

  const topRecommendation = {
    title: "McLaren 720S Price Optimization",
    action: "Increase rate by $75/day",
    impact: "+$2,250/month",
    confidence: 94,
    details: "Market demand analysis shows 89% probability of maintaining current booking rate at this higher price point."
  };

  const vehicles = [
    {
      name: "McLaren 720S",
      revenue: "$12,450",
      margin: "+42%",
      trend: "up",
      opportunity: "$2,250"
    },
    {
      name: "Lamborghini Huracán",
      revenue: "$8,320",
      margin: "+35%",
      trend: "up",
      opportunity: "$840"
    },
    {
      name: "Ferrari 488",
      revenue: "$9,680",
      margin: "+38%",
      trend: "up",
      opportunity: "$1,450"
    }
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero Section - Top Priority AI Insight */}
      <Card className="card-premium bg-gradient-to-br from-success/10 via-primary/5 to-accent/10 border-success/20 p-8">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-success/20 rounded-xl animate-pulse-glow">
              <Sparkles className="h-8 w-8 text-success" />
            </div>
            <div>
              <Badge className="bg-success/20 text-success border-success/30 mb-2">
                <Brain className="w-3 h-3 mr-1" />
                AI Recommendation
              </Badge>
              <h2 className="text-3xl font-bold">{topRecommendation.impact}</h2>
              <p className="text-muted-foreground mt-1">Potential monthly revenue increase</p>
            </div>
          </div>
          <Badge className="bg-primary/10 text-primary border-primary/20">
            {topRecommendation.confidence}% Confidence
          </Badge>
        </div>

        <div className="bg-card/50 backdrop-blur-sm rounded-xl p-6 mb-4">
          <h3 className="text-xl font-semibold mb-2">{topRecommendation.title}</h3>
          <p className="text-lg text-success font-medium mb-3">{topRecommendation.action}</p>
          <p className="text-sm text-muted-foreground">{topRecommendation.details}</p>
        </div>

        <div className="flex space-x-3">
          <Button className="btn-premium hover-scale">
            <CheckCircle className="w-4 h-4 mr-2" />
            Apply This Optimization
          </Button>
          <Button variant="outline" className="hover-scale">
            View Analysis
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="card-premium p-6 hover-scale">
          <div className="flex items-center justify-between mb-2">
            <Zap className="h-5 w-5 text-accent" />
            <Badge variant="outline" className="text-xs">This Week</Badge>
          </div>
          <div className="text-3xl font-bold text-primary mb-1">$4,890</div>
          <div className="text-sm text-muted-foreground mb-2">AI Impact on Revenue</div>
          <div className="flex items-center text-xs text-success">
            <TrendingUp className="w-3 h-3 mr-1" />
            +18% vs last week
          </div>
        </Card>

        <Card className="card-premium p-6 hover-scale">
          <div className="flex items-center justify-between mb-2">
            <Brain className="h-5 w-5 text-primary" />
            <Badge variant="outline" className="text-xs">Active</Badge>
          </div>
          <div className="text-3xl font-bold text-primary mb-1">8</div>
          <div className="text-sm text-muted-foreground mb-2">Active Optimizations</div>
          <div className="text-xs text-muted-foreground">
            3 pricing • 2 utilization • 3 demand
          </div>
        </Card>

        <Card className="card-premium p-6 hover-scale">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="h-5 w-5 text-success" />
            <Badge variant="outline" className="text-xs">Accuracy</Badge>
          </div>
          <div className="text-3xl font-bold text-primary mb-1">94.2%</div>
          <div className="text-sm text-muted-foreground mb-2">Prediction Accuracy</div>
          <div className="flex items-center text-xs text-success">
            <TrendingUp className="w-3 h-3 mr-1" />
            +2.1% improvement
          </div>
        </Card>
      </div>

      {/* Vehicle Performance */}
      <Card className="card-premium p-6">
        <h3 className="text-xl font-semibold mb-6">Top Performers</h3>
        <div className="space-y-4">
          {vehicles.map((vehicle, index) => (
            <div 
              key={index} 
              className="p-4 rounded-xl bg-muted/30 border border-primary/10 hover-scale cursor-pointer transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-semibold text-lg">{vehicle.name}</h4>
                  <div className="flex items-center space-x-4 mt-1">
                    <span className="text-sm text-muted-foreground">Revenue: <span className="font-medium text-foreground">{vehicle.revenue}</span></span>
                    <span className="text-sm text-success">Margin: {vehicle.margin}</span>
                  </div>
                </div>
                <Badge className="bg-accent/10 text-accent border-accent/20">
                  Opportunity: {vehicle.opportunity}/mo
                </Badge>
              </div>
              <Button size="sm" variant="outline" className="w-full">
                View Optimization Details
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
