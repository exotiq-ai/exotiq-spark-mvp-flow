import { Card } from "@/components/ui/card";
import { features } from "./LandingData";

export const FeaturesSection = () => {
  return (
    <section id="features" className="py-12 sm:py-16 lg:py-20 px-4 sm:px-6 bg-muted/30">
      <div className="container mx-auto">
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 px-4">Five Intelligent Modules</h2>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto px-4">
            Each module powered by AI to automate and optimize your rental operations
          </p>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 px-4">
          {features.map((feature, index) => (
            <Card key={index} className="card-module group p-6 sm:p-8 hover-scale">
              <feature.icon className={`h-10 w-10 sm:h-12 sm:w-12 ${feature.color} mb-4 group-hover:scale-110 transition-smooth`} />
              <h3 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-2">{feature.title}</h3>
              <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">{feature.description}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};