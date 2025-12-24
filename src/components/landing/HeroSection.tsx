import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, ArrowRight, Calendar } from "lucide-react";

interface HeroSectionProps {
  onRequestAccess: () => void;
  onGetStarted: () => void;
  onTryDemo: () => void;
  onScheduleDemo?: () => void;
}

export const HeroSection = ({ onRequestAccess, onGetStarted, onTryDemo, onScheduleDemo }: HeroSectionProps) => {
  return (
    <section className="relative py-12 sm:py-16 lg:py-20 px-4 sm:px-6 overflow-hidden">
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 animate-pulse" style={{ animationDuration: '8s' }} />
      
      <div className="container mx-auto text-center relative z-10">
        <Badge className="mb-4 sm:mb-6 bg-primary/10 text-primary border-primary/20 text-sm sm:text-base px-3 py-1.5 animate-fade-in hover:scale-105 transition-transform">
          <Zap className="w-4 h-4 mr-2" />
          AI-Powered Vehicle Rental Operations
        </Badge>
        
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 sm:mb-8 leading-tight px-2 animate-fade-in" style={{ animationDelay: '0.1s', animationFillMode: 'both' }}>
          AI Fleet Intelligence That Saves Time and{' '}
          <span className="bg-gradient-primary bg-clip-text text-transparent inline-block animate-pulse" style={{ animationDuration: '3s' }}>
            Accelerates Growth
          </span>
        </h1>
        
        <p className="text-xl sm:text-2xl text-muted-foreground mb-8 sm:mb-10 max-w-3xl mx-auto px-4 leading-relaxed animate-fade-in" style={{ animationDelay: '0.2s', animationFillMode: 'both' }}>
          Exotiq automates the heavy lifting of fleet management – from pricing optimization to guest communication – so you can focus on growing your business. Our AI handles the details while you capture more revenue with less effort.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center mb-12 sm:mb-16 px-4 animate-fade-in" style={{ animationDelay: '0.3s', animationFillMode: 'both' }}>
          <Button 
            size="lg" 
            className="btn-premium h-12 sm:h-14 text-base sm:text-lg px-6 sm:px-8 hover:scale-105 transition-all shadow-elegant relative overflow-hidden group" 
            onClick={onRequestAccess}
          >
            <span className="relative z-10">Start Free Trial</span>
            <ArrowRight className="ml-2 h-5 w-5 relative z-10 group-hover:translate-x-1 transition-transform" />
            <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary-glow to-primary opacity-0 group-hover:opacity-100 transition-opacity" />
          </Button>
          
          <Button 
            size="lg" 
            variant="outline" 
            className="h-12 sm:h-14 text-base sm:text-lg px-6 sm:px-8 hover:scale-105 transition-all group" 
            onClick={onScheduleDemo}
          >
            <Calendar className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" />
            Schedule Demo
          </Button>
        </div>

        {/* Enhanced Hero Stats with staggered animation */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 lg:gap-8 max-w-4xl mx-auto px-4">
          {[
            { value: '40%', label: 'Profit Increase', color: 'text-primary', delay: '0.4s' },
            { value: '24/7', label: 'AI Monitoring', color: 'text-success', delay: '0.5s' },
            { value: '200+', label: 'Fleet Support', color: 'text-accent', delay: '0.6s' },
            { value: '5min', label: 'Setup Time', color: 'text-warning', delay: '0.7s' }
          ].map((stat, index) => (
            <div 
              key={index}
              className="text-center py-6 px-4 rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 hover:border-border transition-all hover:scale-105 hover:shadow-lg animate-fade-in"
              style={{ animationDelay: stat.delay, animationFillMode: 'both' }}
            >
              <div className={`text-2xl sm:text-3xl lg:text-4xl font-bold ${stat.color} mb-2`}>
                {stat.value}
              </div>
              <div className="text-sm sm:text-base text-muted-foreground">
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Social proof section */}
        <div className="mt-12 sm:mt-16 animate-fade-in" style={{ animationDelay: '0.8s', animationFillMode: 'both' }}>
          <p className="text-sm text-muted-foreground mb-4">Trusted by leading luxury fleet operators</p>
          <div className="flex justify-center items-center gap-8 opacity-60">
            {/* Placeholder for customer logos */}
            <div className="h-8 w-24 bg-muted/20 rounded" />
            <div className="h-8 w-24 bg-muted/20 rounded" />
            <div className="h-8 w-24 bg-muted/20 rounded" />
          </div>
        </div>
      </div>
    </section>
  );
};