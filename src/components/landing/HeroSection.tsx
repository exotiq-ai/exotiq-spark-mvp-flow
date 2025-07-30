import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, ArrowRight } from "lucide-react";

interface HeroSectionProps {
  onRequestAccess: () => void;
  onGetStarted: () => void;
  onTryDemo: () => void;
}

export const HeroSection = ({ onRequestAccess, onGetStarted, onTryDemo }: HeroSectionProps) => {
  return (
    <section className="py-12 sm:py-16 lg:py-20 px-4 sm:px-6">
      <div className="container mx-auto text-center">
        <Badge className="mb-4 sm:mb-6 bg-primary/10 text-primary border-primary/20 text-sm sm:text-base px-3 py-1.5">
          <Zap className="w-4 h-4 mr-2" />
          AI-Powered Vehicle Rental Operations
        </Badge>
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 sm:mb-8 leading-tight px-2">
          AI Fleet Intelligence That Saves Time and <span className="bg-gradient-primary bg-clip-text text-transparent">Accelerates Growth</span>
        </h1>
        <p className="text-xl sm:text-2xl text-muted-foreground mb-8 sm:mb-10 max-w-3xl mx-auto px-4 leading-relaxed">
          Exotiq automates the heavy lifting of fleet management – from pricing optimization to guest communication – so you can focus on growing your business. Our AI handles the details while you capture more revenue with less effort.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center mb-8 sm:mb-12 px-4">
          <Button size="lg" className="btn-premium h-12 sm:h-14 text-base sm:text-lg px-6 sm:px-8" onClick={onRequestAccess}>
            Request Access
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <Button size="lg" variant="outline" className="h-12 sm:h-14 text-base sm:text-lg px-6 sm:px-8" onClick={onGetStarted}>
            Watch Demo
          </Button>
        </div>
        
        {/* Hero Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 lg:gap-8 max-w-4xl mx-auto px-4">
          <div className="text-center py-4">
            <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-primary">40%</div>
            <div className="text-sm sm:text-base text-muted-foreground mt-1">Profit Increase</div>
          </div>
          <div className="text-center py-4">
            <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-success">24/7</div>
            <div className="text-sm sm:text-base text-muted-foreground mt-1">AI Monitoring</div>
          </div>
          <div className="text-center py-4">
            <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-accent">200+</div>
            <div className="text-sm sm:text-base text-muted-foreground mt-1">Fleet Support</div>
          </div>
          <div className="text-center py-4">
            <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-warning">5min</div>
            <div className="text-sm sm:text-base text-muted-foreground mt-1">Setup Time</div>
          </div>
        </div>
      </div>
    </section>
  );
};