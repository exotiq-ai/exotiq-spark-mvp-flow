import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

interface CTASectionProps {
  onRequestAccess: () => void;
  onGetStarted: () => void;
}

export const CTASection = ({ onRequestAccess, onGetStarted }: CTASectionProps) => {
  return (
    <section className="py-12 sm:py-16 lg:py-20 px-4 sm:px-6">
      <div className="container mx-auto text-center">
        <Card className="card-premium max-w-4xl mx-auto bg-gradient-hero text-primary-foreground p-8 sm:p-12">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6 px-4">Ready to Transform Your Fleet?</h2>
          <p className="text-lg sm:text-xl mb-6 sm:mb-8 opacity-90 px-4">
            Join the revolution in AI-powered vehicle rental operations
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center px-4">
            <Button size="lg" variant="secondary" className="bg-white text-primary hover:bg-white/90 h-12 sm:h-14 text-base sm:text-lg px-6 sm:px-8" onClick={onRequestAccess}>
              Request Early Access
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-primary h-12 sm:h-14 text-base sm:text-lg px-6 sm:px-8" onClick={onGetStarted}>
              Schedule Demo
            </Button>
          </div>
        </Card>
      </div>
    </section>
  );
};