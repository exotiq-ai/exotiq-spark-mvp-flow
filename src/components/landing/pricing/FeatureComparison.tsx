import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { pricingTiers } from './PricingData';

interface FeatureRow {
  feature: string;
  pro: string | boolean;
  business: string | boolean;
  enterprise: string | boolean;
}

const features: FeatureRow[] = [
  { feature: 'Vehicles',                       pro: '1–15',           business: '16–50',         enterprise: '51+' },
  { feature: 'Fleet Dashboard',                pro: true,             business: true,            enterprise: true },
  { feature: 'Booking Calendar',               pro: true,             business: true,            enterprise: true },
  { feature: 'Document Vault',                 pro: true,             business: true,            enterprise: true },
  { feature: 'Customer CRM',                   pro: true,             business: true,            enterprise: true },
  { feature: 'AI Pricing Engine (MotorIQ)',    pro: true,             business: true,            enterprise: true },
  { feature: 'AI Forecasting',                 pro: '30-day',         business: '90-day',        enterprise: '365-day' },
  { feature: 'Rari AI Copilot',                pro: true,             business: true,            enterprise: true },
  { feature: 'Advanced Analytics',             pro: true,             business: true,            enterprise: true },
  { feature: 'API Access',                     pro: false,            business: true,            enterprise: true },
  { feature: 'Locations',                      pro: 'Up to 2',        business: 'Unlimited',     enterprise: 'Unlimited + Custom' },
  { feature: 'White-label Booking Portal',     pro: false,            business: true,            enterprise: true },
  { feature: 'Custom Integrations',            pro: false,            business: true,            enterprise: true },
  { feature: 'Support SLA',                    pro: 'Chat (24hr)',    business: 'Phone (4hr)',   enterprise: 'Dedicated (1hr)' },
  { feature: 'Dedicated Success Manager',      pro: false,            business: true,            enterprise: true },
  { feature: 'Custom AI Training',             pro: false,            business: false,           enterprise: true },
  { feature: 'Quarterly Business Reviews',     pro: false,            business: false,           enterprise: true },
  { feature: 'SLA Guarantee',                  pro: false,            business: '99.5%',         enterprise: '99.9%' },
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

  const priceLabel = (tier: typeof pricingTiers[number]) => {
    if (tier.id === 'enterprise') return 'Custom';
    if (tier.priceType === 'per-vehicle') return `$${tier.perVehicleRate}/veh/mo`;
    return `$${tier.price}/mo`;
  };

  return (
    <section className="py-16 px-4">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Compare Plans</h2>
          <p className="text-lg text-muted-foreground">
            Find the right plan for your fleet size and needs
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
                          {priceLabel(tier)}
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
                    <td className="p-4 text-center">{renderCell(row.pro)}</td>
                    <td className="p-4 text-center bg-primary/5">{renderCell(row.business)}</td>
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
