import { Button } from "@/components/ui/button";
import { ArrowRight, Calendar } from "lucide-react";
import { HomeVideo } from "./HomeVideo";

interface HeroSectionProps {
  onRequestAccess: () => void;
  onGetStarted: () => void;
  onTryDemo: () => void;
  onScheduleDemo?: () => void;
}

export const HeroSection = ({ onRequestAccess, onScheduleDemo }: HeroSectionProps) => {
  return (
    <section className="px-4 py-20 sm:px-6 lg:py-28">
      <div className="container mx-auto max-w-4xl text-center">
        {/* Headline */}
        <h1
          className="animate-fade-in mb-6 font-brand text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl"
          style={{ animationFillMode: "both" }}
        >
          The command center for
          <br />
          exotic and luxury rental fleets
        </h1>

        {/* Subheadline */}
        <p
          className="animate-fade-in mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl"
          style={{ animationDelay: "0.1s", animationFillMode: "both" }}
        >
          Exotiq runs the daily work of renting out high-value cars: pricing, availability,
          bookings, documents and payments — in one place, across every location.
        </p>

        {/* CTAs */}
        <div
          className="animate-fade-in mb-14 flex flex-col justify-center gap-4 sm:flex-row"
          style={{ animationDelay: "0.2s", animationFillMode: "both" }}
        >
          <Button
            size="lg"
            className="group h-14 rounded-full px-8 text-lg"
            onClick={onRequestAccess}
          >
            Start free trial
            <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Button>

          <Button
            size="lg"
            variant="outline"
            className="h-14 rounded-full border-border/60 px-8 text-lg"
            onClick={onScheduleDemo}
          >
            <Calendar className="mr-2 h-5 w-5" />
            Schedule demo
          </Button>
        </div>

        {/* Product video */}
        <div className="animate-fade-in" style={{ animationDelay: "0.3s", animationFillMode: "both" }}>
          <HomeVideo />
        </div>
      </div>
    </section>
  );
};
