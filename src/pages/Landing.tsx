
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SEOHead } from "@/components/common/SEOHead";
import { Navigation } from "@/components/landing/Navigation";
import { HeroSection } from "@/components/landing/HeroSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { TestimonialsSection } from "@/components/landing/TestimonialsSection";
import { CTASection } from "@/components/landing/CTASection";
import { Footer } from "@/components/landing/Footer";

const Landing = () => {
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleRequestAccess = () => {
    window.open('https://exotiq.ai/contact', '_blank');
  };

  const handleGetStarted = () => {
    toast({
      title: "Coming Soon",
      description: "We're preparing your premium experience!",
    });
  };

  const handleTryDemo = () => {
    navigate('/demo-landing');
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
        description="Transform your luxury fleet operations with ExotIQ.ai's comprehensive AI-driven platform. Optimize profitability, streamline bookings, and ensure compliance with cutting-edge technology."
        keywords={['luxury fleet management', 'AI optimization', 'fleet analytics', 'booking platform', 'compliance tracking']}
        url="/"
      />
      <Navigation 
        onRequestAccess={handleRequestAccess}
        onTryDemo={handleTryDemo}
        scrollToSection={scrollToSection}
      />
      <HeroSection 
        onRequestAccess={handleRequestAccess}
        onGetStarted={handleGetStarted}
        onTryDemo={handleTryDemo}
      />
      <FeaturesSection />
      <PricingSection onGetStarted={handleGetStarted} />
      <TestimonialsSection />
      <CTASection 
        onRequestAccess={handleRequestAccess}
        onGetStarted={handleGetStarted}
        onTryDemo={handleTryDemo}
      />
      <Footer />
    </div>
  );
};

export default Landing;
