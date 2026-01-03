import { useEffect, useRef, useState } from 'react';

interface UseCountUpOptions {
  start?: number;
  end: number;
  duration?: number; // in milliseconds
  delay?: number; // delay before starting
  decimals?: number;
  prefix?: string;
  suffix?: string;
}

export const useCountUp = ({
  start = 0,
  end,
  duration = 2000,
  delay = 0,
  decimals = 0,
  prefix = '',
  suffix = ''
}: UseCountUpOptions) => {
  const [count, setCount] = useState(start);
  const [isComplete, setIsComplete] = useState(false);
  const frameRef = useRef<number>();
  const startTimeRef = useRef<number>();

  useEffect(() => {
    const startAnimation = () => {
      const animate = (timestamp: number) => {
        if (!startTimeRef.current) {
          startTimeRef.current = timestamp;
        }

        const progress = timestamp - startTimeRef.current;
        const percentage = Math.min(progress / duration, 1);
        
        // Easing function (ease-out)
        const easeOut = 1 - Math.pow(1 - percentage, 3);
        const currentCount = start + (end - start) * easeOut;

        setCount(currentCount);

        if (percentage < 1) {
          frameRef.current = requestAnimationFrame(animate);
        } else {
          setIsComplete(true);
        }
      };

      frameRef.current = requestAnimationFrame(animate);
    };

    const timer = setTimeout(startAnimation, delay);

    return () => {
      clearTimeout(timer);
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [start, end, duration, delay]);

  const formattedNumber = count.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const formattedValue = prefix + formattedNumber + suffix;

  return { value: formattedValue, isComplete };
};