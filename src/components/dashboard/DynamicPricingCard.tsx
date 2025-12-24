import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useFleet } from "@/contexts/FleetContext";
import { useState } from "react";
import {
  DollarSign,
  TrendingUp,
  Calendar,
  Zap,
  Info,
  Settings,
  Sparkles,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DynamicPricingCardProps {
  onApplyOptimization: () => void;
}

export const DynamicPricingCard = ({ onApplyOptimization }: DynamicPricingCardProps) => {
  const { vehicles, applyPriceOptimization } = useFleet();
  const [autoPricingEnabled, setAutoPricingEnabled] = useState<Record<string, boolean>>({});

  const toggleAutoPricing = (vehicleId: string) => {
    setAutoPricingEnabled(prev => ({
      ...prev,
      [vehicleId]: !prev[vehicleId]
    }));
  };

  // Calculate pricing factors (simulated for MVP)
  const pricingFactors = {
    baseRate: 100,
    demandMultiplier: 1.15,
    seasonalFactor: 1.08,
    eventPremium: 0, // Coming soon
    utilization: 78,
  };

  const effectiveMultiplier = pricingFactors.demandMultiplier * pricingFactors.seasonalFactor;

  return (
    <Card className="card-premium p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-primary/20 to-accent/20 rounded-xl">
            <DollarSign className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="text-xl font-semibold">Dynamic Pricing</h3>
            <p className="text-sm text-muted-foreground">AI-powered rate optimization</p>
          </div>
        </div>
        <Badge className="bg-primary/20 text-primary border-primary/30">
          <Sparkles className="h-3 w-3 mr-1" />
          AI Active
        </Badge>
      </div>

      {/* Pricing Factors Breakdown */}
      <div className="space-y-4 mb-6">
        <h4 className="font-medium text-sm text-muted-foreground">Pricing Factors</h4>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-muted/30 border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Base Rate</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Starting daily rate before adjustments</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="text-2xl font-bold">${pricingFactors.baseRate}</div>
            <div className="text-xs text-muted-foreground">per day</div>
          </div>

          <div className="p-4 rounded-lg bg-success/10 border border-success/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Demand</span>
              <TrendingUp className="h-3 w-3 text-success" />
            </div>
            <div className="text-2xl font-bold text-success">+{((pricingFactors.demandMultiplier - 1) * 100).toFixed(0)}%</div>
            <div className="text-xs text-muted-foreground">utilization-based</div>
          </div>

          <div className="p-4 rounded-lg bg-warning/10 border border-warning/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Seasonal</span>
              <Calendar className="h-3 w-3 text-warning" />
            </div>
            <div className="text-2xl font-bold text-warning">+{((pricingFactors.seasonalFactor - 1) * 100).toFixed(0)}%</div>
            <div className="text-xs text-muted-foreground">holiday season</div>
          </div>

          <div className="p-4 rounded-lg bg-muted/30 border border-dashed">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Events</span>
              <Badge variant="outline" className="text-xs">Soon</Badge>
            </div>
            <div className="text-2xl font-bold text-muted-foreground">--</div>
            <div className="text-xs text-muted-foreground">event premium</div>
          </div>
        </div>

        {/* Effective Rate */}
        <div className="p-4 rounded-lg bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Effective Rate Multiplier</div>
              <div className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                {effectiveMultiplier.toFixed(2)}x
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground mb-1">Example Rate</div>
              <div className="text-2xl font-bold">
                ${Math.round(pricingFactors.baseRate * effectiveMultiplier)}/day
              </div>
            </div>
          </div>
        </div>
      </div>

      <Separator className="my-6" />

      {/* Per-Vehicle Auto-Pricing Toggles */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium">Auto-Pricing by Vehicle</h4>
          <Button variant="ghost" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Configure
          </Button>
        </div>

        <div className="space-y-3 max-h-[200px] overflow-y-auto">
          {vehicles.slice(0, 5).map((vehicle) => (
            <div
              key={vehicle.id}
              className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{vehicle.name}</div>
                <div className="text-sm text-muted-foreground">
                  ${vehicle.current_rate}/day
                  {vehicle.suggested_rate && vehicle.suggested_rate > vehicle.current_rate && (
                    <span className="text-success ml-2">→ ${vehicle.suggested_rate}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {autoPricingEnabled[vehicle.id] && (
                  <Badge variant="outline" className="text-xs">Auto</Badge>
                )}
                <Switch
                  checked={autoPricingEnabled[vehicle.id] || false}
                  onCheckedChange={() => toggleAutoPricing(vehicle.id)}
                />
              </div>
            </div>
          ))}
        </div>

        <Button onClick={onApplyOptimization} className="w-full btn-premium">
          <Zap className="h-4 w-4 mr-2" />
          Apply All Optimizations
        </Button>
      </div>
    </Card>
  );
};
