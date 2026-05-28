import { Sparkles, ArrowRight } from 'lucide-react';

export const FounderBanner = () => {
  const scrollToPricing = () => {
    const pricingSection = document.getElementById('pricing-cards');
    pricingSection?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 text-white py-3 px-4 sticky top-0 z-50">
      <div className="container mx-auto">
        <button
          onClick={scrollToPricing}
          className="w-full flex flex-col md:flex-row items-center justify-center gap-2 md:gap-6 text-sm hover:text-amber-300 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-400" />
            <span className="font-medium">Launch pricing</span>
          </div>
          <span className="text-white/70 hidden md:inline">·</span>
          <span className="text-white/80">
            From <span className="text-amber-400 font-bold">$29/vehicle/mo</span> · 14-day free trial · No credit card
          </span>
          <span className="hidden md:flex items-center gap-1 text-amber-400 font-medium">
            Lock in your rate <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </button>
      </div>
    </div>
  );
};
