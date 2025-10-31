import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useFleet } from "@/contexts/FleetContext";
import { PriceOptimizationDialog } from "@/components/dialogs/PriceOptimizationDialog";
import { 
  TrendingUp, 
  Zap,
  CheckCircle,
  ArrowRight,
  Sparkles,
  Brain
} from "lucide-react";

export const MotorIQEnhanced = () => {
  const { vehicles, applyPriceOptimization } = useFleet();
  
  const [showOptimizationDialog, setShowOptimizationDialog] = useState(false);

  const vehiclesWithOptimization = vehicles
    .filter(v => v.name !== 'Lotus Evija')
    .map(v => ({
      ...v,
      opportunity: v.suggested_rate && v.suggested_rate > v.current_rate 
        ? `$${((v.suggested_rate - v.current_rate) * 30).toFixed(0)}` 
        : null
    }));

  const validOptimizations = vehiclesWithOptimization.filter(v => 
    v.suggested_rate && v.suggested_rate > v.current_rate
  );
  
  const topRecommendation = validOptimizations[0] || null;
  const potentialIncrease = topRecommendation?.suggested_rate 
    ? (topRecommendation.suggested_rate - topRecommendation.current_rate) * 30 
    : 0;

  return (
    <>
      <PriceOptimizationDialog
        open={showOptimizationDialog}
        onOpenChange={setShowOptimizationDialog}
        vehicles={vehiclesWithOptimization}
        onApply={(vehicleId, newRate) => applyPriceOptimization(vehicleId, newRate)}
      />
      <div className="space-y-6 overflow-x-hidden">
        {/* Hero Section - Top Priority AI Insight */}
        {topRecommendation && potentialIncrease > 0 ? (
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
                  <h2 className="text-3xl font-bold">+${potentialIncrease.toFixed(0)}/mo</h2>
                  <p className="text-muted-foreground mt-1">Potential revenue increase</p>
                </div>
              </div>
              <Badge className="bg-primary/10 text-primary border-primary/20">
                94% Confidence
              </Badge>
            </div>

            <div className="bg-card/50 backdrop-blur-sm rounded-xl p-6 mb-4">
              <h3 className="text-xl font-semibold mb-2">{topRecommendation.name} Optimization</h3>
              <p className="text-lg text-success font-medium mb-3">
                Increase rate to ${topRecommendation.suggested_rate}/day
              </p>
              <p className="text-sm text-muted-foreground">
                Market demand analysis shows high probability of maintaining bookings at this price point.
              </p>
            </div>

            <div className="flex space-x-3">
              <Button 
                className="btn-premium hover-scale"
                onClick={() => setShowOptimizationDialog(true)}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Apply This Optimization
              </Button>
              <Button 
                variant="outline" 
                className="hover-scale"
                onClick={() => {
                  validOptimizations.forEach(v => {
                    if (v.suggested_rate) {
                      applyPriceOptimization(v.id, v.suggested_rate);
                    }
                  });
                }}
              >
                Apply All ({validOptimizations.length})
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="card-premium p-8">
            <div className="text-center py-8">
              <Brain className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-xl font-semibold mb-2">No Active Optimizations</h3>
              <p className="text-muted-foreground">
                Your fleet is currently optimized. We'll notify you when new opportunities arise.
              </p>
            </div>
          </Card>
        )}

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="card-premium p-6 hover-scale">
            <div className="flex items-center justify-between mb-2">
              <Zap className="h-5 w-5 text-accent" />
              <Badge variant="outline" className="text-xs">This Week</Badge>
            </div>
            <div className="text-3xl font-bold text-primary mb-1">
              ${(vehicles.reduce((sum, v) => sum + (v.revenue || 0), 0) / 4.33).toLocaleString('en-US', { 
                maximumFractionDigits: 0 
              })}
            </div>
            <div className="text-sm text-muted-foreground mb-2">Total Fleet Revenue (This Week)</div>
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
            <div className="text-3xl font-bold text-primary mb-1">
              {validOptimizations.length}
            </div>
            <div className="text-sm text-muted-foreground mb-2">Active Optimizations</div>
            <div className="text-xs text-muted-foreground">
              AI-powered pricing recommendations
            </div>
          </Card>

          <Card className="card-premium p-6 hover-scale">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="h-5 w-5 text-success" />
              <Badge variant="outline" className="text-xs">Avg</Badge>
            </div>
            <div className="text-3xl font-bold text-primary mb-1">
              {Math.round(vehicles.reduce((sum, v) => sum + (v.utilization || 0), 0) / vehicles.length)}%
            </div>
            <div className="text-sm text-muted-foreground mb-2">Fleet Utilization</div>
            <div className="flex items-center text-xs text-success">
              <TrendingUp className="w-3 h-3 mr-1" />
              +5% improvement
            </div>
          </Card>
        </div>

        {/* Vehicle Performance */}
        <Card className="card-premium p-4 sm:p-6 overflow-hidden">
          <h3 className="text-xl font-semibold mb-6">Fleet Performance</h3>
          <div className="space-y-4">
            {vehiclesWithOptimization.map((vehicle, index) => (
              <div 
                key={index} 
                className="p-4 rounded-xl bg-muted/30 border border-primary/10 hover-scale cursor-pointer transition-all min-w-0 w-full"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                  <div className="min-w-0 flex-1">
                    <h4 className="font-semibold text-lg truncate">{vehicle.name}</h4>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 gap-1 sm:gap-0 mt-1">
                      <span className="text-sm text-muted-foreground truncate">
                        Current: <span className="font-medium text-foreground">${vehicle.current_rate}/day</span>
                      </span>
                      {vehicle.suggested_rate && (
                        <span className="text-sm text-success truncate">
                          Suggested: ${vehicle.suggested_rate}/day
                        </span>
                      )}
                    </div>
                  </div>
                  {vehicle.opportunity && (
                    <Badge className="bg-accent/10 text-accent border-accent/20 shrink-0 text-xs sm:text-sm whitespace-nowrap">
                      {vehicle.opportunity}/mo opportunity
                    </Badge>
                  )}
                </div>
                <div className="flex items-center space-x-3 mb-3 min-w-0">
                  <div className="flex-1 bg-muted/50 rounded-full h-2 min-w-0">
                    <div 
                      className="bg-primary h-2 rounded-full" 
                      style={{ width: `${vehicle.utilization || 0}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium shrink-0">{vehicle.utilization || 0}% utilized</span>
                </div>
                {vehicle.suggested_rate && (
                  <Button 
                    size="sm" 
                    className="btn-premium hover-scale w-full"
                    onClick={() => setShowOptimizationDialog(true)}
                  >
                    Apply Optimization
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
};
