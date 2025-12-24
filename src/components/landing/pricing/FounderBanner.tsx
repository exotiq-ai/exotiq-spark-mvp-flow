import { useState } from 'react';
import { Clock, Users, Zap, ChevronDown } from 'lucide-react';
import { founderDeadline, founderSpotsRemaining, founderSpotsTotal } from './PricingData';
import { useEffect } from 'react';

export const FounderBanner = () => {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const difference = founderDeadline.getTime() - now.getTime();

      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        });
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, []);

  const scrollToPricing = () => {
    const pricingSection = document.getElementById('pricing-cards');
    if (pricingSection) {
      pricingSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 text-white py-3 px-4 sticky top-0 z-50">
      <div className="container mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8">
          {/* Timer Section */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5">
              <Zap className="h-4 w-4 text-amber-400" />
              <span className="text-sm font-medium">Founder Pricing</span>
            </div>
            
            <div className="flex items-center gap-1 font-mono text-sm">
              <div className="bg-white/10 px-2 py-1 rounded">
                <span className="font-bold">{timeLeft.days}</span>
                <span className="text-white/60 ml-1 text-xs">d</span>
              </div>
              <span className="text-white/40">:</span>
              <div className="bg-white/10 px-2 py-1 rounded">
                <span className="font-bold">{String(timeLeft.hours).padStart(2, '0')}</span>
                <span className="text-white/60 ml-1 text-xs">h</span>
              </div>
              <span className="text-white/40">:</span>
              <div className="bg-white/10 px-2 py-1 rounded">
                <span className="font-bold">{String(timeLeft.minutes).padStart(2, '0')}</span>
                <span className="text-white/60 ml-1 text-xs">m</span>
              </div>
              <span className="text-white/40">:</span>
              <div className="bg-white/10 px-2 py-1 rounded">
                <span className="font-bold">{String(timeLeft.seconds).padStart(2, '0')}</span>
                <span className="text-white/60 ml-1 text-xs">s</span>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="hidden md:block w-px h-4 bg-white/20" />

          {/* Spots Remaining */}
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-white/60" />
            <span>
              <span className="text-amber-400 font-bold">{founderSpotsRemaining}</span>
              <span className="text-white/60"> of {founderSpotsTotal} spots left</span>
            </span>
          </div>

          {/* CTA */}
          <button 
            onClick={scrollToPricing}
            className="hidden md:flex items-center gap-1 text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors"
          >
            Lock in your rate
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
