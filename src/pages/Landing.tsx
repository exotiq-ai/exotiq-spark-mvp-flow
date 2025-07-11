import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Navigation } from "@/components/landing/Navigation";
import { HeroSection } from "@/components/landing/HeroSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { TestimonialsSection } from "@/components/landing/TestimonialsSection";
import { CTASection } from "@/components/landing/CTASection";
import { Footer } from "@/components/landing/Footer";

const Landing = () => {
  const { toast } = useToast();

  const handleRequestAccess = () => {
    toast({
      title: "Access Request Submitted",
      description: "We'll contact you soon with early access details!",
    });
  };

  const handleGetStarted = () => {
    toast({
      title: "Coming Soon",
      description: "We're preparing your premium experience!",
    });
  };

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation 
        onRequestAccess={handleRequestAccess}
        scrollToSection={scrollToSection}
      />
      <HeroSection 
        onRequestAccess={handleRequestAccess}
        onGetStarted={handleGetStarted}
      />
      <FeaturesSection />
      <PricingSection onGetStarted={handleGetStarted} />
      <TestimonialsSection />
      <CTASection 
        onRequestAccess={handleRequestAccess}
        onGetStarted={handleGetStarted}
      />
      <Footer />
    </div>
  );
};

export default Landing;