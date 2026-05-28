import { Card } from '@/components/ui/card';
import { Shield, Lock, XCircle, Clock } from 'lucide-react';

export const PricingGuarantee = () => {
  const guarantees = [
    {
      icon: Lock,
      title: 'Rate Locked for Life',
      description: 'Your per-vehicle rate is locked for the lifetime of your subscription. Planned increases only apply to new customers.',
    },
    {
      icon: Shield,
      title: 'No Hidden Fees',
      description: 'The price you see is the price you pay. No surprise charges, no sneaky add-ons.',
    },
    {
      icon: XCircle,
      title: 'Cancel Anytime',
      description: 'No long-term contracts. Cancel your subscription at any time with no penalties.',
    },
    {
      icon: Clock,
      title: '30-Day Guarantee',
      description: 'If you are not satisfied within the first 30 days, get a full refund. No questions asked.',
    },
  ];

  return (
    <section className="py-16 px-4 bg-muted/30">
      <div className="container mx-auto max-w-5xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Our Pricing Promise</h2>
          <p className="text-lg text-muted-foreground">
            We believe in transparent, fair pricing with no surprises
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {guarantees.map((item, index) => (
            <Card key={index} className="p-6 text-center hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <item.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">{item.title}</h3>
              <p className="text-sm text-muted-foreground">{item.description}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
