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
import { Loader2, ArrowRight, CheckCircle2 } from 'lucide-react';
import { type PricingTier } from './PricingData';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PlanSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedTier: PricingTier | null;
  isAnnual: boolean;
}

export const PlanSelectionModal = ({
  open,
  onOpenChange,
  selectedTier,
  isAnnual,
}: PlanSelectionModalProps) => {
  const [fleetSize, setFleetSize] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Reset fleet size when tier changes
  useEffect(() => {
    if (selectedTier) {
      setFleetSize(selectedTier.maxVehicles);
    }
  }, [selectedTier]);

  if (!selectedTier) return null;

  // Calculate total price based on tier type
  const calculateMonthlyPrice = () => {
    if (selectedTier.priceType === 'per-vehicle') {
      const basePrice = (selectedTier.perVehicleRate || 29) * fleetSize;
      return Math.max(basePrice, selectedTier.minPrice || 79);
    }
    // Flat rate with potential overage
    if (fleetSize > selectedTier.maxVehicles && selectedTier.overageRate) {
      const overageVehicles = fleetSize - selectedTier.maxVehicles;
      return selectedTier.price + (overageVehicles * selectedTier.overageRate);
    }
    return selectedTier.price;
  };

  const monthlyPrice = calculateMonthlyPrice();
  const totalPrice = isAnnual ? monthlyPrice * 10 : monthlyPrice; // 10 months for annual (2 free)
  const billingPeriod = isAnnual ? 'year' : 'month';

  const isValidFleetSize = fleetSize >= 1 && fleetSize <= 200;

  const handleCheckout = async () => {
    if (!isValidFleetSize) {
      toast({
        title: 'Invalid fleet size',
        description: 'Please enter a valid number of vehicles.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          tierId: selectedTier.id,
          isAnnual,
          fleetSize,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast({
        title: 'Checkout failed',
        description: error.message || 'Unable to start checkout. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Get Started with {selectedTier.name}</DialogTitle>
          <DialogDescription>
            {selectedTier.valueProposition}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Plan Summary */}
          <div className="p-4 rounded-lg bg-muted/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{selectedTier.name} Plan</span>
              {selectedTier.popular && (
                <Badge variant="outline" className="text-primary border-primary/30">
                  Most Popular
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{selectedTier.vehicleRange}</p>
          </div>

          {/* Fleet Size Input */}
          <div className="space-y-2">
            <Label htmlFor="fleetSize">
              {selectedTier.priceType === 'per-vehicle' 
                ? 'Number of Vehicles' 
                : `Total Vehicles (${selectedTier.maxVehicles} included)`}
            </Label>
            <Input
              id="fleetSize"
              type="number"
              min={1}
              max={500}
              value={fleetSize}
              onChange={(e) => setFleetSize(parseInt(e.target.value) || 1)}
            />
            {selectedTier.priceType === 'flat' && fleetSize <= selectedTier.maxVehicles && (
              <p className="text-xs text-muted-foreground">
                Up to {selectedTier.maxVehicles} vehicles included in your plan
              </p>
            )}
            {selectedTier.priceType === 'flat' && fleetSize > selectedTier.maxVehicles && (
              <p className="text-xs text-amber-600">
                {fleetSize - selectedTier.maxVehicles} additional vehicles × ${selectedTier.overageRate}/each added to base rate
              </p>
            )}
          </div>

          {/* Billing Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-border">
            <span className="text-sm">Billing</span>
            <span className="font-medium">
              {isAnnual ? 'Annual (2 months free)' : 'Monthly'}
            </span>
          </div>

          {/* Price Calculation */}
          <div className="space-y-2 p-4 rounded-lg bg-primary/5 border border-primary/20">
            {selectedTier.priceType === 'per-vehicle' ? (
              <>
                <div className="flex justify-between text-sm">
                  <span>${selectedTier.perVehicleRate}/vehicle</span>
                  <span>x {fleetSize} vehicles</span>
                </div>
                {monthlyPrice === selectedTier.minPrice && fleetSize * (selectedTier.perVehicleRate || 29) < (selectedTier.minPrice || 79) && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Minimum applies</span>
                    <span>${selectedTier.minPrice}/month</span>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex justify-between text-sm">
                  <span>Base rate</span>
                  <span>${selectedTier.price}/month</span>
                </div>
                {fleetSize > selectedTier.maxVehicles && selectedTier.overageRate && (
                  <div className="flex justify-between text-sm text-amber-600">
                    <span>Overage ({fleetSize - selectedTier.maxVehicles} vehicles)</span>
                    <span>+${(fleetSize - selectedTier.maxVehicles) * selectedTier.overageRate}/month</span>
                  </div>
                )}
              </>
            )}
            {isAnnual && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>x 10 months (2 free)</span>
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

          {/* Checkout Button */}
          <Button
            className="w-full h-12"
            onClick={handleCheckout}
            disabled={isLoading || !isValidFleetSize}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                Continue to Payment
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            You will be redirected to secure checkout. Your card will not be charged during the 14-day trial.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
