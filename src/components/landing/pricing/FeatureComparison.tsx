import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2 } from 'lucide-react';
import { pricingTiers } from './PricingData';

interface FeatureRow {
  feature: string;
  pro: string;
  business: string;
  enterprise: string;
}

const includedInAllPlans = [
  'Fleet Dashboard',
  'MotorIQ AI Pricing Engine',
  'AI Forecasting (30-day)',
  'Booking Calendar',
  'Customer CRM',
  'Document Vault',
  'Stripe Connect Payments',
  'Drive Exotiq Marketplace',
  'Analytics & Reports',
  'Team Management',
  'Mobile Responsive',
];

const differentiators: FeatureRow[] = [
  { feature: 'Vehicles',              pro: '1–15',        business: '16–50',            enterprise: '51+' },
  { feature: 'Locations',             pro: 'Up to 2',     business: 'Up to 5',          enterprise: 'Unlimited' },
  { feature: 'Support',               pro: 'Chat (24hr)', business: 'Priority + phone', enterprise: 'Dedicated (1hr)' },
  { feature: 'Marketplace Placement', pro: 'Listed',      business: 'Featured',         enterprise: 'Premium + priority leads' },
  { feature: 'Onboarding',            pro: 'Self-serve',  business: 'White-glove',      enterprise: 'Custom' },
  { feature: 'API Access',            pro: '—',           business: '—',                enterprise: 'Full API' },
  { feature: 'Custom AI Training',    pro: '—',           business: '—',                enterprise: 'Included' },
  { feature: 'SLA Guarantee',         pro: '—',           business: '—',                enterprise: '99.9%' },
];

export const FeatureComparison = () => {
  const priceLabel = (tier: typeof pricingTiers[number]) => {
    if (tier.id === 'enterprise') return 'Custom';
    if (tier.priceType === 'per-vehicle') return `$${tier.perVehicleRate}/veh/mo`;
    return `$${tier.price}/mo`;
  };

  return (
    <section className="py-16 px-4">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">All Features. Every Plan.</h2>
          <p className="text-lg text-muted-foreground">
            Every plan includes the full platform. Here's what differs.
          </p>
        </div>

        {/* Included in All Plans */}
        <Card className="p-6 mb-8 bg-muted/30">
          <h3 className="font-semibold mb-4 text-center text-sm uppercase tracking-wide text-muted-foreground">
            Included in All Plans
          </h3>
          <div className="flex flex-wrap justify-center gap-2">
            {includedInAllPlans.map((feature) => (
              <Badge key={feature} variant="secondary" className="gap-1.5 py-1.5 px-3 font-normal">
                <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                {feature}
              </Badge>
            ))}
          </div>
        </Card>

        {/* Plan Differences */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left p-4 font-semibold">Plan Differences</th>
                  {pricingTiers.map((tier) => (
                    <th key={tier.id} className="text-center p-4 font-semibold min-w-[140px]">
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
                {differentiators.map((row, index) => (
                  <tr
                    key={row.feature}
                    className={`border-t border-border ${index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}
                  >
                    <td className="p-4 font-medium">{row.feature}</td>
                    <td className="p-4 text-center text-sm">{row.pro}</td>
                    <td className="p-4 text-center text-sm bg-primary/5">{row.business}</td>
                    <td className="p-4 text-center text-sm">{row.enterprise}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </section>
  );
};
