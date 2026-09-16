import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, BarChart3, Calendar, Shield, Users, Brain } from "lucide-react";

const modules = [
  {
    icon: BarChart3,
    name: "Core",
    description: "See every car, its status and what needs doing today.",
  },
  {
    icon: Sparkles,
    name: "Pulse",
    description: "Revenue, utilisation and trends without building a spreadsheet.",
  },
  {
    icon: Calendar,
    name: "Book",
    description: "Take direct bookings, approve requests and collect payment.",
  },
  {
    icon: Shield,
    name: "Vault",
    description: "Insurance, registrations and signed agreements kept in order.",
  },
  {
    icon: Users,
    name: "CRM",
    description: "Renter history, verification and lifetime value in one profile.",
  },
  {
    icon: Brain,
    name: "MotorIQ",
    description: "Daily rate suggestions per car based on real demand.",
  },
];

interface FeaturesSectionProps {
  onViewPricing?: () => void;
}

export const FeaturesSection = ({ onViewPricing }: FeaturesSectionProps) => {
  return (
    <section id="features" className="bg-muted/30 px-4 py-24 sm:px-6 lg:py-28">
      <div className="container mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-14 text-center">
          <p className="mb-4 font-medium text-primary">Six connected modules</p>
          <h2 className="mb-5 font-brand text-3xl font-bold tracking-tight sm:text-4xl">
            Everything you need to run a fleet
          </h2>
          <p className="mx-auto max-w-xl text-lg text-muted-foreground">
            Each module shares the same fleet, calendar and customer records, so nothing has to be
            entered twice.
          </p>
        </div>

        {/* Module grid */}
        <div className="mb-12 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
          {modules.map((module) => (
            <div
              key={module.name}
              className="group rounded-2xl border border-border/50 bg-card p-6 transition-colors hover:border-primary/30 sm:p-8"
            >
              <module.icon className="mb-4 h-8 w-8 text-primary" />
              <h3 className="mb-1 font-brand text-lg font-semibold">{module.name}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{module.description}</p>
            </div>
          ))}
        </div>

        <div className="text-center">
          <Button
            variant="outline"
            size="lg"
            className="group h-12 rounded-full px-8"
            onClick={onViewPricing}
          >
            See pricing
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Button>
        </div>
      </div>
    </section>
  );
};
