import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SEOHead } from "@/components/common/SEOHead";
import { Navigation } from "@/components/landing/Navigation";
import { HeroSection } from "@/components/landing/HeroSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { ProofSection } from "@/components/landing/ProofSection";
import { PricingSectionNew } from "@/components/landing/PricingSectionNew";
import { Footer } from "@/components/landing/Footer";
import { CalendlyModal } from "@/components/landing/CalendlyModal";

const Landing = () => {
  const navigate = useNavigate();
  const [calendlyOpen, setCalendlyOpen] = useState(false);

  const scrollToSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" });
  };

  const handleRequestAccess = () => scrollToSection("pricing-cards");
  const handleGetStarted = () => navigate("/auth?trial=true");
  const handleTryDemo = () => navigate("/auth");
  const handleScheduleDemo = () => setCalendlyOpen(true);

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Fleet Management Software for Exotic Car Rentals"
        description="Exotiq is the command center for exotic and luxury car rental operators: fleet status, availability, direct bookings, documents, demand-based pricing and Stripe payments in one platform."
        keywords={[
          "exotic car rental software",
          "luxury fleet management",
          "car rental booking software",
          "fleet pricing software",
          "rental fleet operations",
        ]}
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
      <FeaturesSection onViewPricing={handleRequestAccess} />
      <ProofSection />
      <section id="pricing">
        <PricingSectionNew />
      </section>
      <Footer />
      <CalendlyModal open={calendlyOpen} onOpenChange={setCalendlyOpen} />
    </div>
  );
};

export default Landing;
