import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, ArrowRight, Calendar, Play, MapPin } from "lucide-react";

interface HeroSectionProps {
  onRequestAccess: () => void;
  onGetStarted: () => void;
  onTryDemo: () => void;
  onScheduleDemo?: () => void;
}

export const HeroSection = ({ onRequestAccess, onGetStarted, onTryDemo, onScheduleDemo }: HeroSectionProps) => {
  return (
    <section className="relative min-h-[90vh] flex items-center py-20 lg:py-32 px-4 sm:px-6 overflow-hidden">
      {/* Premium background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/3 via-transparent to-transparent" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-primary/5 rounded-full blur-3xl opacity-50" />
      
      <div className="container mx-auto text-center relative z-10 max-w-5xl">
        {/* Pill badge */}
        <Badge className="mb-8 bg-primary/10 text-primary border-primary/20 text-sm px-4 py-2 animate-fade-in hover:bg-primary/15 transition-colors cursor-default">
          <Zap className="w-3.5 h-3.5 mr-2" />
          AI-Powered Fleet Intelligence
        </Badge>
        
        {/* Main headline - Apple style large typography */}
        <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold mb-8 leading-[0.95] tracking-tight px-2 animate-fade-in" style={{ animationDelay: '0.1s', animationFillMode: 'both' }}>
          Maximize Revenue.
          <br />
          <span className="bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
            Minimize Effort.
          </span>
        </h1>
        
        {/* Subheadline - clean and concise */}
        <p className="text-xl sm:text-2xl text-muted-foreground mb-12 max-w-2xl mx-auto px-4 leading-relaxed animate-fade-in font-light" style={{ animationDelay: '0.2s', animationFillMode: 'both' }}>
          The AI platform that optimizes pricing, automates operations, and grows your exotic car rental business.
        </p>
        
        {/* CTAs - prominent and clear */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16 px-4 animate-fade-in" style={{ animationDelay: '0.3s', animationFillMode: 'both' }}>
          <Button 
            size="lg" 
            className="h-14 text-lg px-8 rounded-full bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all group" 
            onClick={onRequestAccess}
          >
            Start Free Trial
            <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </Button>
          
          <Button 
            size="lg" 
            variant="outline" 
            className="h-14 text-lg px-8 rounded-full border-border/60 hover:bg-muted/50 transition-all group" 
            onClick={onScheduleDemo}
          >
            <Calendar className="mr-2 h-5 w-5" />
            Schedule Demo
          </Button>
        </div>

        {/* Launch announcement */}
        <div className="animate-fade-in" style={{ animationDelay: '0.4s', animationFillMode: 'both' }}>
          <p className="text-sm text-muted-foreground mb-6 inline-flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" />
            Launching now in Denver, Scottsdale, and Miami — 
            <span className="text-primary font-medium">Join the movement!</span>
          </p>
          
          {/* Demo button - secondary action */}
          <button 
            onClick={onTryDemo}
            className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors group"
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Play className="w-4 h-4 ml-0.5" />
            </div>
            <span className="text-sm font-medium">Try the interactive demo</span>
          </button>
        </div>
      </div>
    </section>
  );
};
