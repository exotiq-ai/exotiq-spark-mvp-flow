import { useState, useEffect } from 'react';
import { Clock, Users, Zap } from 'lucide-react';
import { founderDeadline, founderSpotsRemaining, founderSpotsTotal } from './PricingData';

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

  return (
    <div className="bg-gradient-to-r from-primary via-primary-dark to-primary text-primary-foreground py-3 px-4">
      <div className="container mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Urgency Message */}
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-warning" />
            <span className="font-semibold">Founder Pricing Ends March 31, 2025</span>
          </div>

          {/* Countdown Timer */}
          <div className="flex items-center gap-4">
            <Clock className="h-4 w-4 opacity-80" />
            <div className="flex gap-3 text-sm">
              <div className="text-center">
                <span className="font-bold text-lg">{timeLeft.days}</span>
                <span className="text-xs opacity-80 ml-1">days</span>
              </div>
              <span className="opacity-50">:</span>
              <div className="text-center">
                <span className="font-bold text-lg">{String(timeLeft.hours).padStart(2, '0')}</span>
                <span className="text-xs opacity-80 ml-1">hrs</span>
              </div>
              <span className="opacity-50">:</span>
              <div className="text-center">
                <span className="font-bold text-lg">{String(timeLeft.minutes).padStart(2, '0')}</span>
                <span className="text-xs opacity-80 ml-1">min</span>
              </div>
              <span className="opacity-50">:</span>
              <div className="text-center">
                <span className="font-bold text-lg">{String(timeLeft.seconds).padStart(2, '0')}</span>
                <span className="text-xs opacity-80 ml-1">sec</span>
              </div>
            </div>
          </div>

          {/* Spots Remaining */}
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 opacity-80" />
            <span className="font-medium">
              <span className="text-warning font-bold">{founderSpotsRemaining}</span> of {founderSpotsTotal} spots remaining
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
