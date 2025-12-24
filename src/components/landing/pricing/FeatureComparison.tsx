import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { pricingTiers } from './PricingData';

interface FeatureRow {
  feature: string;
  starter: string | boolean;
  professional: string | boolean;
  business: string | boolean;
  enterprise: string | boolean;
}

const features: FeatureRow[] = [
  {
    feature: 'Vehicles',
    starter: '1-10',
    professional: '11-30',
    business: '31-75',
    enterprise: '76+',
  },
  {
    feature: 'Fleet Dashboard',
    starter: true,
    professional: true,
    business: true,
    enterprise: true,
  },
  {
    feature: 'Booking Calendar',
    starter: true,
    professional: true,
    business: true,
    enterprise: true,
  },
  {
    feature: 'Document Vault',
    starter: true,
    professional: true,
    business: true,
    enterprise: true,
  },
  {
    feature: 'Customer CRM',
    starter: true,
    professional: true,
    business: true,
    enterprise: true,
  },
  {
    feature: 'AI Pricing Engine (MotorIQ)',
    starter: false,
    professional: true,
    business: true,
    enterprise: true,
  },
  {
    feature: 'AI Forecasting',
    starter: '7-day',
    professional: '30-day',
    business: '90-day',
    enterprise: '365-day',
  },
  {
    feature: 'Rari AI Copilot',
    starter: false,
    professional: false,
    business: true,
    enterprise: true,
  },
  {
    feature: 'Advanced Analytics',
    starter: false,
    professional: true,
    business: true,
    enterprise: true,
  },
  {
    feature: 'API Access',
    starter: false,
    professional: true,
    business: true,
    enterprise: true,
  },
  {
    feature: 'Locations',
    starter: '1',
    professional: 'Up to 3',
    business: 'Unlimited',
    enterprise: 'Unlimited + Custom',
  },
  {
    feature: 'White-label Booking Portal',
    starter: false,
    professional: false,
    business: true,
    enterprise: true,
  },
  {
    feature: 'Custom Integrations',
    starter: false,
    professional: true,
    business: true,
    enterprise: true,
  },
  {
    feature: 'Support SLA',
    starter: 'Email (48hr)',
    professional: 'Chat (24hr)',
    business: 'Phone (4hr)',
    enterprise: 'Dedicated (1hr)',
  },
  {
    feature: 'Dedicated Success Manager',
    starter: false,
    professional: false,
    business: true,
    enterprise: true,
  },
  {
    feature: 'Custom AI Training',
    starter: false,
    professional: false,
    business: false,
    enterprise: true,
  },
  {
    feature: 'Quarterly Business Reviews',
    starter: false,
    professional: false,
    business: false,
    enterprise: true,
  },
  {
    feature: 'SLA Guarantee',
    starter: false,
    professional: false,
    business: '99.5%',
    enterprise: '99.9%',
  },
];

export const FeatureComparison = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const displayedFeatures = isExpanded ? features : features.slice(0, 8);

  const renderCell = (value: string | boolean) => {
    if (typeof value === 'boolean') {
      return value ? (
        <CheckCircle2 className="h-5 w-5 text-success mx-auto" />
      ) : (
        <XCircle className="h-5 w-5 text-muted-foreground/40 mx-auto" />
      );
    }
    return <span className="text-sm font-medium">{value}</span>;
  };

  return (
    <section className="py-16 px-4">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Compare Plans</h2>
          <p className="text-lg text-muted-foreground">
            Find the perfect plan for your fleet size and needs
          </p>
        </div>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left p-4 font-semibold">Feature</th>
                  {pricingTiers.map((tier) => (
                    <th key={tier.id} className="text-center p-4 font-semibold min-w-[120px]">
                      <div className="space-y-1">
                        <span className={tier.popular ? 'text-primary' : ''}>{tier.name}</span>
                        <p className="text-xs font-normal text-muted-foreground">
                          ${tier.founderPrice}/veh/mo
                        </p>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayedFeatures.map((row, index) => (
                  <tr
                    key={row.feature}
                    className={`border-t border-border ${index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}
                  >
                    <td className="p-4 font-medium">{row.feature}</td>
                    <td className="p-4 text-center">{renderCell(row.starter)}</td>
                    <td className="p-4 text-center bg-primary/5">{renderCell(row.professional)}</td>
                    <td className="p-4 text-center">{renderCell(row.business)}</td>
                    <td className="p-4 text-center">{renderCell(row.enterprise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {features.length > 8 && (
            <div className="p-4 border-t border-border text-center">
              <Button
                variant="ghost"
                onClick={() => setIsExpanded(!isExpanded)}
                className="gap-2"
              >
                {isExpanded ? (
                  <>
                    Show Less <ChevronUp className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    Show All Features ({features.length}) <ChevronDown className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          )}
        </Card>
      </div>
    </section>
  );
};
