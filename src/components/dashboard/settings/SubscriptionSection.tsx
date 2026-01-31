import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  CreditCard, 
  Crown, 
  Check, 
  Zap,
  Calendar,
  Download,
  ExternalLink,
  Sparkles,
  Shield,
  BarChart3,
  Inbox
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFleet } from "@/contexts/FleetContext";
import { EmptyState } from "@/components/common/EmptyState";

interface PlanFeature {
  name: string;
  included: boolean;
}

interface Plan {
  name: string;
  price: number;
  period: string;
  features: PlanFeature[];
  highlighted?: boolean;
  tier: string;
}

// Vehicle limits by subscription tier
const TIER_LIMITS: Record<string, number> = {
  starter: 10,
  growth: 25,
  professional: 50,
  enterprise: Infinity
};

const TIER_PRICES: Record<string, number> = {
  starter: 99,
  growth: 179,
  professional: 249,
  enterprise: 499
};

export const SubscriptionSection = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const { subscription } = useAuth();
  const { vehicles } = useFleet();
  
  // Real data from contexts
  const vehiclesUsed = vehicles?.length || 0;
  const currentTier = subscription?.tier || null;
  const vehicleLimit = currentTier ? (TIER_LIMITS[currentTier] || 0) : 0;
  const isSubscribed = subscription?.subscribed || false;

  const plans: Plan[] = [
    {
      name: "Starter",
      tier: "starter",
      price: 99,
      period: "month",
      features: [
        { name: "Up to 10 vehicles", included: true },
        { name: "Basic Analytics", included: true },
        { name: "Email Support", included: true },
        { name: "AI Dynamic Pricing", included: false },
        { name: "Custom Branding", included: false }
      ]
    },
    {
      name: "Professional",
      tier: "professional",
      price: 249,
      period: "month",
      features: [
        { name: "Up to 50 vehicles", included: true },
        { name: "Advanced Analytics", included: true },
        { name: "Priority Support", included: true },
        { name: "AI Dynamic Pricing", included: true },
        { name: "Custom Branding", included: true }
      ]
    },
    {
      name: "Enterprise",
      tier: "enterprise",
      price: 499,
      period: "month",
      features: [
        { name: "Unlimited vehicles", included: true },
        { name: "Enterprise Analytics", included: true },
        { name: "24/7 Phone Support", included: true },
        { name: "AI Dynamic Pricing", included: true },
        { name: "White-label Solution", included: true }
      ]
    }
  ];

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

  const handleUpgrade = async (planName: string) => {
    toast({
      title: "Upgrade Request",
      description: `Contact sales to upgrade to ${planName} plan.`
    });
  };

  const usagePercentage = vehicleLimit > 0 && vehicleLimit !== Infinity 
    ? (vehiclesUsed / vehicleLimit) * 100 
    : 0;

  // Get display name for current tier
  const getPlanDisplayName = (tier: string | null) => {
    if (!tier) return "None";
    return tier.charAt(0).toUpperCase() + tier.slice(1);
  };

  // Get features for current tier
  const getCurrentPlanFeatures = () => {
    const plan = plans.find(p => p.tier === currentTier);
    return plan?.features.filter(f => f.included).map(f => f.name) || [];
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

        {/* Available Plans */}
        <div id="available-plans">
          <h3 className="text-lg font-semibold mb-4">Available Plans</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.map((plan) => (
              <Card 
                key={plan.name}
                className="p-6 relative card-premium"
              >
                <div className="text-center mb-6">
                  <h4 className="text-lg font-semibold">{plan.name}</h4>
                  <div className="mt-2">
                    <span className="text-3xl font-bold">${plan.price}</span>
                    <span className="text-muted-foreground">/{plan.period}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  {plan.features.map((feature, i) => (
                    <div key={i} className="flex items-center gap-2">
                      {feature.included ? (
                        <Check className="w-4 h-4 text-success" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30" />
                      )}
                      <span className={feature.included ? "" : "text-muted-foreground"}>
                        {feature.name}
                      </span>
                    </div>
                  ))}
                </div>

                <Button 
                  className="w-full mt-6"
                  variant="outline"
                  onClick={() => handleUpgrade(plan.name)}
                >
                  Get Started
                </Button>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
                <span>{vehiclesUsed} of {vehicleLimit === Infinity ? '∞' : vehicleLimit}</span>
                {vehicleLimit !== Infinity && (
                  <span className="text-muted-foreground">{Math.round(usagePercentage)}%</span>
                )}
              </div>
              {vehicleLimit !== Infinity && (
                <Progress value={usagePercentage} className="h-2" />
              )}
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
            <CreditCard className="w-4 h-4 mr-2" />
            Manage Billing
          </Button>
          <Button variant="outline" className="w-full sm:w-auto" onClick={handleManageBilling}>
            <Download className="w-4 h-4 mr-2" />
            Download Invoices
          </Button>
        </div>
      </Card>

      {/* Available Plans */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Available Plans</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan) => {
            const isCurrentPlan = plan.tier === currentTier;
            
            return (
              <Card 
                key={plan.name}
                className={`p-6 relative ${
                  isCurrentPlan 
                    ? 'border-primary shadow-lg ring-2 ring-primary/20' 
                    : 'card-premium'
                }`}
              >
                {isCurrentPlan && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary">
                    Current Plan
                  </Badge>
                )}

                <div className="text-center mb-6">
                  <h4 className="text-lg font-semibold">{plan.name}</h4>
                  <div className="mt-2">
                    <span className="text-3xl font-bold">${plan.price}</span>
                    <span className="text-muted-foreground">/{plan.period}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  {plan.features.map((feature, i) => (
                    <div key={i} className="flex items-center gap-2">
                      {feature.included ? (
                        <Check className="w-4 h-4 text-success" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30" />
                      )}
                      <span className={feature.included ? "" : "text-muted-foreground"}>
                        {feature.name}
                      </span>
                    </div>
                  ))}
                </div>

                <Button 
                  className="w-full mt-6"
                  variant={isCurrentPlan ? "default" : "outline"}
                  disabled={isCurrentPlan}
                  onClick={() => handleUpgrade(plan.name)}
                >
                  {isCurrentPlan ? "Current Plan" : "Upgrade"}
                </Button>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Payment History - Empty State */}
      <Card className="card-premium p-6">
        <div className="flex items-center space-x-3 mb-6">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h3 className="text-xl font-semibold">Recent Payments</h3>
        </div>

        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="p-3 rounded-full bg-muted/50 mb-4">
            <Inbox className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground mb-4">Payment history is managed through the billing portal.</p>
          <Button variant="outline" size="sm" onClick={handleManageBilling} disabled={isLoading}>
            <ExternalLink className="w-4 h-4 mr-2" />
            View in Billing Portal
          </Button>
        </div>
      </Card>
    </div>
  );
};
