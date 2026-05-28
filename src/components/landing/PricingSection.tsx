import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";
import { pricingPlans } from "./LandingData";

interface PricingSectionProps {
  onGetStarted: () => void;
}

export const PricingSection = ({ onGetStarted }: PricingSectionProps) => {
  return (
    <section id="pricing" className="py-12 sm:py-16 lg:py-20 px-4 sm:px-6">
      <div className="container mx-auto">
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 px-4">Choose Your Plan</h2>
          <p className="text-lg sm:text-xl text-muted-foreground px-4">Scale with confidence as your fleet grows</p>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 px-4 max-w-6xl mx-auto">
          {pricingPlans.map((plan, index) => (
            <Card key={index} className={`card-premium ${plan.popular ? 'ring-2 ring-primary shadow-premium' : ''} relative p-6 sm:p-8`}>
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gradient-primary text-primary-foreground text-xs sm:text-sm">
                  Most Popular
                </Badge>
              )}
              <div className="text-center mb-6">
                <h3 className="text-lg sm:text-xl font-semibold mb-2">{plan.name}</h3>
                <div className="text-2xl sm:text-3xl font-bold text-primary mb-1">{plan.price}</div>
                <div className="text-sm text-muted-foreground">{plan.vehicles}</div>
              </div>
              <ul className="space-y-3 mb-6">
                {plan.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-center text-sm sm:text-base">
                    <CheckCircle2 className="h-4 w-4 text-success mr-2 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button 
                className={`w-full h-11 sm:h-12 text-sm sm:text-base ${plan.popular ? 'btn-premium' : ''}`} 
                variant={plan.popular ? 'default' : 'outline'}
                onClick={onGetStarted}
              >
                Get Started
              </Button>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};