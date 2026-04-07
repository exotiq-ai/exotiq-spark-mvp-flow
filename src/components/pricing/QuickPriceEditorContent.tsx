import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import {
  DollarSign,
  Sparkles,
  TrendingUp,
  Calendar,
  Check,
  Car,
  Zap,
  Target,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PricingContext } from "@/components/dashboard/DynamicPricingCard";

interface Vehicle {
  id: string;
  name: string;
  make: string;
  model: string;
  year: number;
  status: string;
  current_rate: number;
  suggested_rate?: number | null;
  utilization?: number;
  image_url?: string | null;
}

interface QuickPriceEditorContentProps {
  vehicle: Vehicle;
  pricingContext?: PricingContext | null;
  onApplyRate: (vehicleId: string, newRate: number) => Promise<void>;
  onComplete?: () => void;
  /** If true, renders without the vehicle info header (for inline embedding) */
  compact?: boolean;
}

export const QuickPriceEditorContent = ({
  vehicle,
  pricingContext,
  onApplyRate,
  onComplete,
  compact = false,
}: QuickPriceEditorContentProps) => {
  const [newRate, setNewRate] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);
  const { hasRoleOrHigher } = useUserRole();

  useEffect(() => {
    const suggestedRate = pricingContext
      ? (vehicle.suggested_rate || vehicle.current_rate)
      : vehicle.current_rate;
    setNewRate(suggestedRate);
  }, [vehicle, pricingContext]);

  const suggestedRate = vehicle.suggested_rate || vehicle.current_rate;
  const hasSuggestion = vehicle.suggested_rate && vehicle.suggested_rate > vehicle.current_rate;
  const hasAIContext = !!pricingContext;
  const rateChange = newRate - vehicle.current_rate;
  const monthlyImpact = rateChange * 30;

  const handleApplyAIRate = () => {
    if (vehicle.suggested_rate) {
      setNewRate(vehicle.suggested_rate);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onApplyRate(vehicle.id, newRate);
      onComplete?.();
    } finally {
      setIsSaving(false);
    }
  };

  const minRate = Math.max(50, Math.floor(vehicle.current_rate * 0.5));
  const maxRate = Math.ceil(vehicle.current_rate * 2);

  return (
    <div className="space-y-5">
      {/* Vehicle Info — only show if not compact */}
      {!compact && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border">
          <div className="h-12 w-16 bg-muted rounded-md flex items-center justify-center overflow-hidden flex-shrink-0">
            {vehicle.image_url ? (
              <img
                src={vehicle.image_url}
                alt={vehicle.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <Car className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm truncate">{vehicle.name}</h4>
            <p className="text-xs text-muted-foreground truncate">
              {vehicle.year} {vehicle.make} {vehicle.model}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-xs text-muted-foreground">Current</div>
            <div className="text-lg font-bold">${vehicle.current_rate}/day</div>
          </div>
        </div>
      )}

      {/* AI Reasoning Block */}
      {hasAIContext && pricingContext && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="p-4 rounded-lg bg-gradient-to-r from-primary/8 to-accent/8 border border-primary/15">
            <div className="flex items-start gap-3">
              <div className="p-1.5 bg-primary/15 rounded-md flex-shrink-0 mt-0.5">
                <Zap className="h-3.5 w-3.5 text-primary" />
              </div>
              <div>
                <div className="font-medium text-sm mb-1">Why this rate?</div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {pricingContext.reasoning}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">What's driving this</div>
            <div className="flex flex-wrap gap-1.5">
              {pricingContext.events.slice(0, 3).map((event) => (
                <Badge key={event.id} variant="outline" className="text-xs gap-1 px-2 py-1">
                  <Calendar className="h-3 w-3 text-accent" />
                  {event.name}
                </Badge>
              ))}
              {vehicle.utilization !== undefined && vehicle.utilization > 0 && (
                <Badge variant="outline" className="text-xs gap-1 px-2 py-1">
                  <TrendingUp className="h-3 w-3 text-success" />
                  {vehicle.utilization}% utilization
                </Badge>
              )}
              {pricingContext.factors.map((f, i) => (
                <Badge key={i} variant="outline" className="text-xs gap-1 px-2 py-1">
                  {f.name}: {f.impact > 0 ? '+' : ''}{f.impact}%
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 p-3 rounded-lg bg-muted/40 border text-center">
              <div className="text-xs text-muted-foreground mb-1">Current</div>
              <div className="text-2xl font-bold">${vehicle.current_rate}</div>
              <div className="text-xs text-muted-foreground">/day</div>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <div className="flex-1 p-3 rounded-lg bg-success/10 border border-success/20 text-center">
              <div className="text-xs text-success mb-1">Suggested</div>
              <div className="text-2xl font-bold text-success">${suggestedRate}</div>
              <div className="text-xs text-muted-foreground">/day</div>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1 p-2.5 rounded-lg bg-muted/30 border flex items-center gap-2">
              <Target className="h-4 w-4 text-primary flex-shrink-0" />
              <div>
                <div className="text-xs text-muted-foreground">Confidence</div>
                <div className="text-sm font-semibold">{pricingContext.confidence}%</div>
              </div>
            </div>
            <div className="flex-1 p-2.5 rounded-lg bg-success/5 border border-success/15 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-success flex-shrink-0" />
              <div>
                <div className="text-xs text-muted-foreground">Monthly Impact</div>
                <div className="text-sm font-bold text-success">
                  +${((suggestedRate - vehicle.current_rate) * 30).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Legacy AI suggestion banner */}
      {!hasAIContext && hasSuggestion && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-lg bg-gradient-to-r from-success/10 to-primary/10 border border-success/20"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-success/20 rounded-lg">
                <Sparkles className="h-4 w-4 text-success" />
              </div>
              <div>
                <div className="font-medium text-sm flex items-center gap-2">
                  AI Recommendation
                  <Badge className="bg-success/20 text-success border-0 text-xs">
                    +${(suggestedRate - vehicle.current_rate).toFixed(0)}
                  </Badge>
                </div>
                <div className="text-2xl font-bold text-success mt-1">
                  ${suggestedRate}/day
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Based on demand, seasonality, and local events
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-success/30 text-success hover:bg-success/10 flex-shrink-0"
              onClick={handleApplyAIRate}
            >
              <Check className="h-4 w-4 mr-1" />
              Apply
            </Button>
          </div>
        </motion.div>
      )}

      <Separator />

      {/* Manual Adjustment */}
      <div className="space-y-4">
        <h4 className="font-medium text-sm flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-primary" />
          {hasAIContext ? "Adjust Rate" : "Set New Rate"}
        </h4>

        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                type="number"
                value={newRate}
                onChange={(e) => setNewRate(Number(e.target.value))}
                className="pl-7 pr-12 text-xl font-bold h-12"
                min={minRate}
                max={maxRate}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">/day</span>
            </div>
          </div>

          <div className="px-1">
            <Slider
              value={[newRate]}
              onValueChange={([value]) => setNewRate(value)}
              min={minRate}
              max={maxRate}
              step={5}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>${minRate}</span>
              <span>${maxRate}</span>
            </div>
          </div>

          {rateChange !== 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="p-3 rounded-lg bg-muted/30 border"
            >
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Rate change</span>
                <span className={cn(
                  "font-semibold",
                  rateChange > 0 ? "text-success" : "text-destructive"
                )}>
                  {rateChange > 0 ? "+" : ""}{rateChange.toFixed(0)}/day
                </span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  Monthly impact (est.)
                </span>
                <span className={cn(
                  "font-bold",
                  monthlyImpact > 0 ? "text-success" : "text-destructive"
                )}>
                  {monthlyImpact > 0 ? "+" : ""}${Math.abs(monthlyImpact).toLocaleString()}
                </span>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Save Button */}
      <Button
        onClick={handleSave}
        disabled={isSaving || newRate === vehicle.current_rate}
        className="w-full btn-premium min-h-[44px]"
      >
        {isSaving ? "Saving..." : hasAIContext
          ? `Confirm $${newRate}/day ✓`
          : "Save Changes"
        }
      </Button>
    </div>
  );
};
