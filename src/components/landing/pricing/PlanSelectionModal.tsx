import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';
import { type PricingTier, pickTierForFleetSize } from './PricingData';
import { BillingToggle } from './BillingToggle';
import { supabase } from '@/integrations/supabase/client';
import { toast } from "sonner";

interface PlanSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedTier: PricingTier | null;
  isAnnual: boolean;
  returnPath?: string;
  cancelPath?: string;
}

export const PlanSelectionModal = ({
  open,
  onOpenChange,
  selectedTier,
  isAnnual: isAnnualProp,
  returnPath,
  cancelPath,
}: PlanSelectionModalProps) => {
  const [fleetSize, setFleetSize] = useState(1);
  const [isAnnual, setIsAnnual] = useState(isAnnualProp);
  const [isLoading, setIsLoading] = useState(false);
  useEffect(() => {
    if (selectedTier) {
      // Default to mid-range of selected tier
      const midFleet = Math.min(
        selectedTier.maxVehicles,
        Math.max(selectedTier.minVehicles, Math.round((selectedTier.minVehicles + selectedTier.maxVehicles) / 2))
      );
      setFleetSize(midFleet);
      setIsAnnual(isAnnualProp);
    }
  }, [selectedTier, isAnnualProp]);

  if (!selectedTier) return null;

  // Enterprise → contact sales
  if (selectedTier.priceType === 'custom') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enterprise — let's talk</DialogTitle>
            <DialogDescription>
              {selectedTier.vehicleRange}. We'll tailor pricing, integrations, and SLAs to your fleet.
            </DialogDescription>
          </DialogHeader>
          <Button
            className="w-full h-12"
            onClick={() => {
              window.open('https://calendly.com/exotiq/enterprise', '_blank');
              onOpenChange(false);
            }}
          >
            Book a call
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  const perVehicleRate = isAnnual
    ? (selectedTier.perVehicleAnnualRate ?? selectedTier.price * 10)
    : (selectedTier.perVehicleRate ?? selectedTier.price);
  const totalPrice = perVehicleRate * fleetSize;
  const billingPeriod = isAnnual ? 'year' : 'month';

  const inferredTier = pickTierForFleetSize(fleetSize);
  const tierMismatch = inferredTier.id !== selectedTier.id && inferredTier.id !== 'enterprise';
  const overEnterprise = fleetSize > 50;

  const fleetInBounds =
    fleetSize >= selectedTier.minVehicles && fleetSize <= selectedTier.maxVehicles;

  const handleCheckout = async () => {
    if (!fleetInBounds) {
      toast.error('Fleet size out of range', { description: tierMismatch
          ? `Switch to ${inferredTier.name} for ${fleetSize} vehicles.`
          : 'Please enter a valid number of vehicles for this tier.' });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          tierId: selectedTier.id,
          isAnnual,
          fleetSize,
          returnPath,
          cancelPath,
          trial: true,
        },
      });
      if (error) throw error;
      if (data?.url) {
        try {
          window.location.href = data.url;
        } catch {
          window.open(data.url, '_blank');
        }
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast.error('Checkout failed', { description: error.message || 'Unable to start checkout. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Start your 14-day free trial</DialogTitle>
          <DialogDescription>
            {selectedTier.name} — {selectedTier.valueProposition}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Plan summary */}
          <div className="p-4 rounded-lg bg-muted/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{selectedTier.name} Plan</span>
              {selectedTier.popular && (
                <Badge variant="outline" className="text-primary border-primary/30">Most Popular</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{selectedTier.vehicleRange}</p>
          </div>

          {/* Fleet size */}
          <div className="space-y-2">
            <Label htmlFor="fleetSize">Number of vehicles</Label>
            <Input
              id="fleetSize"
              type="number"
              min={selectedTier.minVehicles}
              max={selectedTier.maxVehicles}
              value={fleetSize}
              onChange={(e) => setFleetSize(parseInt(e.target.value) || 1)}
            />
            {tierMismatch && !overEnterprise && (
              <p className="text-xs text-amber-600">
                {fleetSize} vehicles fits the <strong>{inferredTier.name}</strong> tier
                ({inferredTier.vehicleRange}) at ${inferredTier.perVehicleRate}/vehicle/mo.
              </p>
            )}
            {overEnterprise && (
              <p className="text-xs text-amber-600">
                51+ vehicles is Enterprise — contact sales for custom pricing.
              </p>
            )}
          </div>

          {/* Billing toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-border">
            <span className="text-sm">Billing</span>
            <BillingToggle isAnnual={isAnnual} onChange={setIsAnnual} size="sm" />
          </div>

          {/* Price */}
          <div className="space-y-2 p-4 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex justify-between text-sm">
              <span>${perVehicleRate}/vehicle/{billingPeriod === 'year' ? 'yr' : 'mo'}</span>
              <span>× {fleetSize} vehicles</span>
            </div>
            {isAnnual && (
              <div className="flex justify-between text-xs text-emerald-600">
                <span>2 months free annually</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold pt-2 border-t border-primary/20">
              <span>Total</span>
              <span className="text-primary">
                ${totalPrice.toLocaleString()}/{billingPeriod}
              </span>
            </div>
          </div>

          {/* Features */}
          <div className="space-y-2">
            {selectedTier.features.slice(0, 4).map((feature, index) => (
              <div key={index} className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span>{feature}</span>
              </div>
            ))}
          </div>

          <Button
            className="w-full h-12"
            onClick={handleCheckout}
            disabled={isLoading || !fleetInBounds}
          >
            {isLoading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing…</>
            ) : (
              <><Sparkles className="mr-2 h-4 w-4" />Start 14-day free trial</>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            No credit card required. We'll remind you before the trial ends.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
