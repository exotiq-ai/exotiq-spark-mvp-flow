import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  CreditCard, 
  Crown, 
  Check, 
  Calendar,
  Download,
  ExternalLink,
  Sparkles,
  BarChart3,
  Inbox,
  Loader2,
  Rocket
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFleet } from "@/contexts/FleetContext";
import { EmptyState } from "@/components/common/EmptyState";
import { pricingTiers, type PricingTier } from "@/components/landing/pricing/PricingData";
import { PlanSelectionModal } from "@/components/landing/pricing/PlanSelectionModal";
import { BillingToggle } from "@/components/landing/pricing/BillingToggle";
import { Celebration } from "@/components/common/MicroInteractions";
import { motion, AnimatePresence } from "framer-motion";

// Vehicle limits by subscription tier
const TIER_LIMITS: Record<string, number> = {
  starter: 10,
  professional: 25,
  business: 75,
  enterprise: 150
};

export const SubscriptionSection = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const { subscription } = useAuth();
  const { vehicles } = useFleet();
  const [selectedTier, setSelectedTier] = useState<PricingTier | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isAnnual, setIsAnnual] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [showCelebration, setShowCelebration] = useState(false);

  const { checkSubscription } = useAuth();

  // Detect subscription=success and trigger celebration
  useEffect(() => {
    if (searchParams.get('subscription') === 'success') {
      setShowCelebration(true);
      // Clear the query param
      searchParams.delete('subscription');
      searchParams.delete('session_id');
      setSearchParams(searchParams, { replace: true });
      // Re-use the AuthContext subscription check (no duplicate call)
      checkSubscription();
    }
  }, []);
  
  const vehiclesUsed = vehicles?.length || 0;
  const currentTier = subscription?.tier || null;
  const vehicleLimit = currentTier ? (TIER_LIMITS[currentTier] || 0) : 0;
  const isSubscribed = subscription?.subscribed || false;

  const handleManageBilling = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to open billing portal. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPlan = (tier: PricingTier) => {
    setSelectedTier(tier);
    setModalOpen(true);
  };

  const usagePercentage = vehicleLimit > 0 
    ? (vehiclesUsed / vehicleLimit) * 100 
    : 0;

  const getPlanDisplayName = (tier: string | null) => {
    if (!tier) return "None";
    return tier.charAt(0).toUpperCase() + tier.slice(1);
  };

  const getCurrentPlanFeatures = () => {
    const plan = pricingTiers.find(p => p.id === currentTier);
    return plan?.features || [];
  };

  const getDisplayPrice = (tier: PricingTier) => {
    if (tier.priceType === 'per-vehicle') {
      return `$${tier.perVehicleRate}`;
    }
    return `$${tier.price}`;
  };

  const getPriceLabel = (tier: PricingTier) => {
    if (tier.priceType === 'per-vehicle') {
      return '/vehicle/mo';
    }
    return '/month';
  };

  // No subscription state
  if (!isSubscribed) {
    return (
      <div className="space-y-6">
        <EmptyState
          icon={Crown}
          title="No Active Subscription"
          description="Choose a plan to unlock fleet management features and start managing your vehicles."
          action={{
            label: "View Plans",
            onClick: () => {
              const plansSection = document.getElementById('available-plans');
              plansSection?.scrollIntoView({ behavior: 'smooth' });
            }
          }}
        />

        <div id="available-plans">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Available Plans</h3>
            <BillingToggle isAnnual={isAnnual} onChange={setIsAnnual} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {pricingTiers.map((tier) => (
              <Card
                key={tier.id}
                className={`p-5 flex flex-col h-full ${tier.popular ? 'border-primary shadow-lg ring-2 ring-primary/20' : 'card-premium'}`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h4 className="text-base font-semibold">{tier.name}</h4>
                  {tier.popular && (
                    <Badge className="bg-primary text-xs shrink-0">Popular</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{tier.vehicleRange}</p>

                <div className="mt-3 mb-4">
                  <div className="flex items-baseline gap-1 whitespace-nowrap tabular-nums">
                    <span className="text-2xl font-bold">{getDisplayPrice(tier)}</span>
                    <span className="text-sm text-muted-foreground">{getPriceLabel(tier)}</span>
                  </div>
                  {tier.priceType === 'per-vehicle' && tier.minPrice && (
                    <p className="text-xs text-muted-foreground mt-1">${tier.minPrice}/mo minimum</p>
                  )}
                  {isAnnual && (
                    <p className="text-xs text-success mt-1">Save 2 months annually</p>
                  )}
                </div>

                <div className="space-y-2 flex-1">
                  {tier.features.slice(0, 5).map((feature, i) => (
                    <div key={i} className="flex items-center gap-2 min-w-0">
                      <Check className="w-3.5 h-3.5 text-success shrink-0" />
                      <span className="text-sm truncate" title={feature}>{feature}</span>
                    </div>
                  ))}
                </div>

                <Button
                  className="w-full mt-5"
                  variant={tier.popular ? "default" : "outline"}
                  onClick={() => handleSelectPlan(tier)}
                >
                  Get Started
                </Button>
              </Card>
            ))}
          </div>
        </div>

        <PlanSelectionModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          selectedTier={selectedTier}
          isAnnual={isAnnual}
          returnPath="/dashboard/settings?subscription=success"
          cancelPath="/dashboard/settings"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Celebration confetti + animated card */}
      <Celebration 
        trigger={showCelebration} 
        message="Subscription Activated! 🚀" 
        variant="milestone"
        onComplete={() => setShowCelebration(false)}
      />
      <AnimatePresence>
        {showCelebration && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <Card className="p-8 border-primary/30 bg-gradient-to-br from-primary/10 via-success/5 to-primary/5 text-center overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent animate-pulse" />
              <div className="relative z-10">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: [0, 1.3, 1] }}
                  transition={{ duration: 0.6, times: [0, 0.6, 1] }}
                  className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success/20 mb-4"
                >
                  <Rocket className="h-8 w-8 text-success" />
                </motion.div>
                <h3 className="text-2xl font-bold mb-2">
                  Welcome to {getPlanDisplayName(currentTier)}!
                </h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Your subscription is now active. Your fleet management just leveled up — enjoy your new features!
                </p>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Current Plan Card */}
      <Card className="card-premium p-6 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Crown className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-semibold">Current Plan</h3>
              <p className="text-sm text-muted-foreground">Your subscription details</p>
            </div>
          </div>
          <Badge className="bg-success text-success-foreground">
            <Sparkles className="w-3 h-3 mr-1" />
            Active
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Plan</p>
            <p className="text-2xl font-bold">{getPlanDisplayName(currentTier)}</p>
          </div>
          
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Next Billing</p>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <p className="font-medium">
                {subscription?.subscriptionEnd 
                  ? new Date(subscription.subscriptionEnd).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric'
                    })
                  : 'N/A'
                }
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Vehicle Usage</p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{vehiclesUsed} of {vehicleLimit}</span>
                <span className="text-muted-foreground">{Math.round(usagePercentage)}%</span>
              </div>
              <Progress value={Math.min(usagePercentage, 100)} className="h-2" />
            </div>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t flex flex-wrap gap-3">
          {getCurrentPlanFeatures().map((feature, i) => (
            <Badge key={i} variant="secondary" className="gap-1">
              <Check className="w-3 h-3" />
              {feature}
            </Badge>
          ))}
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <Button onClick={handleManageBilling} disabled={isLoading} className="btn-premium w-full sm:w-auto">
            {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CreditCard className="w-4 h-4 mr-2" />}
            Manage Billing
          </Button>
          <Button variant="outline" className="w-full sm:w-auto" onClick={handleManageBilling}>
            <Download className="w-4 h-4 mr-2" />
            Download Invoices
          </Button>
        </div>
      </Card>

      {/* Available Plans for upgrade */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Available Plans</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {pricingTiers.map((tier) => {
            const isCurrentPlan = tier.id === currentTier;

            return (
              <Card
                key={tier.id}
                className={`p-5 flex flex-col h-full ${
                  isCurrentPlan
                    ? 'border-primary shadow-lg ring-2 ring-primary/20'
                    : 'card-premium'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h4 className="text-base font-semibold">{tier.name}</h4>
                  {isCurrentPlan && (
                    <Badge className="bg-primary text-xs shrink-0">Current</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{tier.vehicleRange}</p>

                <div className="mt-3 mb-4">
                  <div className="flex items-baseline gap-1 whitespace-nowrap tabular-nums">
                    <span className="text-2xl font-bold">{getDisplayPrice(tier)}</span>
                    <span className="text-sm text-muted-foreground">{getPriceLabel(tier)}</span>
                  </div>
                </div>

                <div className="space-y-2 flex-1">
                  {tier.features.slice(0, 5).map((feature, i) => (
                    <div key={i} className="flex items-center gap-2 min-w-0">
                      <Check className="w-3.5 h-3.5 text-success shrink-0" />
                      <span className="text-sm truncate" title={feature}>{feature}</span>
                    </div>
                  ))}
                </div>

                <Button
                  className="w-full mt-5"
                  variant={isCurrentPlan ? "default" : "outline"}
                  disabled={isCurrentPlan}
                  onClick={() => handleSelectPlan(tier)}
                >
                  {isCurrentPlan ? "Current Plan" : "Upgrade"}
                </Button>
              </Card>
            );
          })}
        </div>
      </div>

      <PlanSelectionModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        selectedTier={selectedTier}
        isAnnual={isAnnual}
        returnPath="/dashboard/settings?subscription=success"
        cancelPath="/dashboard/settings"
      />
    </div>
  );
};
