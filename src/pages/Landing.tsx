import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SEOHead } from "@/components/common/SEOHead";
import { Navigation } from "@/components/landing/Navigation";
import { HeroSection } from "@/components/landing/HeroSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { PricingSectionNew } from "@/components/landing/PricingSectionNew";
import { TestimonialsSection } from "@/components/landing/TestimonialsSection";
import { Footer } from "@/components/landing/Footer";
import { CalendlyModal } from "@/components/landing/CalendlyModal";

const Landing = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [calendlyOpen, setCalendlyOpen] = useState(false);

  const handleRequestAccess = () => {
    // Scroll to pricing
    const pricingSection = document.getElementById('pricing-cards');
    if (pricingSection) {
      pricingSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleGetStarted = () => {
    navigate('/auth?trial=true');
  };

  const handleTryDemo = () => {
    navigate('/auth');
  };

  const handleScheduleDemo = () => {
    setCalendlyOpen(true);
  };

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="AI-Powered Fleet Management Platform"
        description="Transform your luxury fleet operations with Exotiq.ai's comprehensive AI-driven platform. Optimize profitability, streamline bookings, and ensure compliance with cutting-edge technology."
        keywords={['luxury fleet management', 'AI optimization', 'fleet analytics', 'booking platform', 'compliance tracking']}
        url="/"
      />
      <Navigation 
        onRequestAccess={handleRequestAccess}
        onTryDemo={handleTryDemo}
        scrollToSection={scrollToSection}
        onScheduleDemo={handleScheduleDemo}
      />
      <HeroSection 
        onRequestAccess={handleRequestAccess}
        onGetStarted={handleGetStarted}
        onTryDemo={handleTryDemo}
        onScheduleDemo={handleScheduleDemo}
      />
      <CalendlyModal 
        open={calendlyOpen} 
        onOpenChange={setCalendlyOpen} 
      />
      <FeaturesSection />
      <section id="pricing">
        <PricingSectionNew />
      </section>
      <TestimonialsSection />
      <Footer />
    </div>
  );
};

export default Landing;
