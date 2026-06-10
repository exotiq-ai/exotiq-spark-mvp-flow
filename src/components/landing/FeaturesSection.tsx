import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, BarChart3, Calendar, Shield, Users, Brain } from "lucide-react";

const modules = [
  {
    icon: BarChart3,
    name: "Core",
    description: "Fleet overview & status",
  },
  {
    icon: Sparkles,
    name: "Pulse",
    description: "Revenue analytics",
  },
  {
    icon: Calendar,
    name: "Book",
    description: "Booking calendar",
  },
  {
    icon: Shield,
    name: "Vault",
    description: "Document management",
  },
  {
    icon: Users,
    name: "CRM",
    description: "Customer relationships",
  },
  {
    icon: Brain,
    name: "MotorIQ",
    description: "AI pricing engine",
  },
];

export const FeaturesSection = () => {
  return (
    <section id="features" className="py-24 lg:py-32 px-4 sm:px-6 bg-muted/30">
      <div className="container mx-auto max-w-5xl">
        {/* Header */}
        <div className="text-center mb-16">
          <p className="text-primary font-medium mb-4">Six Intelligent Modules</p>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6 tracking-tight">
            Everything you need to run
            <br className="hidden sm:block" />
            {" "}a world-class fleet
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            From AI-powered pricing to automated compliance, each module is designed to save time and increase revenue.
          </p>
        </div>
        
        {/* Module grid - minimal elegant cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 mb-12">
          {modules.map((module, index) => (
            <div 
              key={module.name}
              className="group p-6 sm:p-8 rounded-2xl bg-card border border-border/50 hover:border-primary/30 hover:shadow-lg transition-all duration-300"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <module.icon className="h-8 w-8 sm:h-10 sm:w-10 text-primary mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="text-lg sm:text-xl font-semibold mb-1">{module.name}</h3>
              <p className="text-sm text-muted-foreground">{module.description}</p>
            </div>
          ))}
        </div>

        {/* CTA scrolls back to the #features anchor on the landing page (FD-01: /features is not a route) */}
        <div className="text-center">
          <a href="#features">
            <Button
              variant="outline"
              size="lg"
              className="h-12 px-8 rounded-full group hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all"
            >
              Explore All Features
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </a>
        </div>
      </div>
    </section>
  );
};
