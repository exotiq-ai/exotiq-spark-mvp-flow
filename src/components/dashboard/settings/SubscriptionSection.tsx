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
  BarChart3
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

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
}

export const SubscriptionSection = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  
  // Mock subscription data - would come from Stripe in production
  const currentPlan = {
    name: "Professional",
    status: "active",
    renewalDate: "2025-01-24",
    vehicleLimit: 25,
    vehiclesUsed: 12,
    features: [
      "Up to 25 vehicles",
      "AI Dynamic Pricing",
      "Advanced Analytics",
      "Priority Support",
      "Custom Branding"
    ]
  };

  const plans: Plan[] = [
    {
      name: "Starter",
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
      price: 249,
      period: "month",
      highlighted: true,
      features: [
        { name: "Up to 25 vehicles", included: true },
        { name: "Advanced Analytics", included: true },
        { name: "Priority Support", included: true },
        { name: "AI Dynamic Pricing", included: true },
        { name: "Custom Branding", included: true }
      ]
    },
    {
      name: "Enterprise",
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

  const usagePercentage = (currentPlan.vehiclesUsed / currentPlan.vehicleLimit) * 100;

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
            {currentPlan.status.charAt(0).toUpperCase() + currentPlan.status.slice(1)}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Plan</p>
            <p className="text-2xl font-bold">{currentPlan.name}</p>
          </div>
          
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Next Billing</p>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <p className="font-medium">
                {new Date(currentPlan.renewalDate).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Vehicle Usage</p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{currentPlan.vehiclesUsed} of {currentPlan.vehicleLimit}</span>
                <span className="text-muted-foreground">{Math.round(usagePercentage)}%</span>
              </div>
              <Progress value={usagePercentage} className="h-2" />
            </div>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t flex flex-wrap gap-3">
          {currentPlan.features.map((feature, i) => (
            <Badge key={i} variant="secondary" className="gap-1">
              <Check className="w-3 h-3" />
              {feature}
            </Badge>
          ))}
        </div>

        <div className="mt-6 flex gap-3">
          <Button onClick={handleManageBilling} disabled={isLoading} className="btn-premium">
            <CreditCard className="w-4 h-4 mr-2" />
            Manage Billing
          </Button>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Download Invoices
          </Button>
        </div>
      </Card>

      {/* Available Plans */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Available Plans</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <Card 
              key={plan.name}
              className={`p-6 relative ${
                plan.highlighted 
                  ? 'border-primary shadow-lg ring-2 ring-primary/20' 
                  : 'card-premium'
              }`}
            >
              {plan.highlighted && (
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
                variant={plan.highlighted ? "default" : "outline"}
                disabled={plan.highlighted}
                onClick={() => handleUpgrade(plan.name)}
              >
                {plan.highlighted ? "Current Plan" : "Upgrade"}
              </Button>
            </Card>
          ))}
        </div>
      </div>

      {/* Payment History */}
      <Card className="card-premium p-6">
        <div className="flex items-center space-x-3 mb-6">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h3 className="text-xl font-semibold">Recent Payments</h3>
        </div>

        <div className="space-y-3">
          {[
            { date: "Dec 24, 2024", amount: 249, status: "Paid" },
            { date: "Nov 24, 2024", amount: 249, status: "Paid" },
            { date: "Oct 24, 2024", amount: 249, status: "Paid" }
          ].map((payment, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <div className="flex items-center gap-3">
                <CreditCard className="w-4 h-4 text-muted-foreground" />
                <span>{payment.date}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-medium">${payment.amount}</span>
                <Badge variant="secondary" className="text-success">
                  {payment.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
