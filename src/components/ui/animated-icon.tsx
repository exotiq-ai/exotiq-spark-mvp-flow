import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface AnimatedIconProps {
  icon: LucideIcon;
  className?: string;
  size?: number;
  hoverScale?: number;
  hoverRotate?: number;
  tapScale?: number;
}

export const AnimatedIcon = ({
  icon: Icon,
  className,
  size = 20,
  hoverScale = 1.15,
  hoverRotate = 0,
  tapScale = 0.9,
}: AnimatedIconProps) => {
  return (
    <motion.div
      whileHover={{ scale: hoverScale, rotate: hoverRotate }}
      whileTap={{ scale: tapScale }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      className={cn("inline-flex items-center justify-center", className)}
    >
      <Icon size={size} />
    </motion.div>
  );
};

interface PulsingDotProps {
  color?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const PulsingDot = ({ 
  color = "bg-success", 
  size = "md",
  className 
}: PulsingDotProps) => {
  const sizeClasses = {
    sm: "w-2 h-2",
    md: "w-3 h-3",
    lg: "w-4 h-4",
  };

  return (
    <span className={cn("relative inline-flex", className)}>
      <span className={cn(
        "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
        color
      )} />
      <span className={cn(
        "relative inline-flex rounded-full",
        color,
        sizeClasses[size]
      )} />
    </span>
  );
};

interface RippleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export const RippleButton = React.forwardRef<HTMLButtonElement, RippleButtonProps>(
  ({ children, className, onClick, ...props }, ref) => {
    const [ripples, setRipples] = React.useState<Array<{ x: number; y: number; id: number }>>([]);

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const id = Date.now();

      setRipples((prev) => [...prev, { x, y, id }]);
      setTimeout(() => {
        setRipples((prev) => prev.filter((ripple) => ripple.id !== id));
      }, 600);

      onClick?.(e);
    };

    return (
      <button
        ref={ref}
        className={cn(
          "relative overflow-hidden",
          className
        )}
        onClick={handleClick}
        {...props}
      >
        {children}
        {ripples.map((ripple) => (
          <span
            key={ripple.id}
            className="absolute bg-white/30 rounded-full animate-scale-in pointer-events-none"
            style={{
              left: ripple.x - 50,
              top: ripple.y - 50,
              width: 100,
              height: 100,
              transform: "scale(0)",
              animation: "ripple 0.6s ease-out forwards",
            }}
          />
        ))}
      </button>
    );
  }
);
RippleButton.displayName = "RippleButton";

interface FloatingLabelInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export const FloatingLabelInput = React.forwardRef<HTMLInputElement, FloatingLabelInputProps>(
  ({ label, className, ...props }, ref) => {
    const [isFocused, setIsFocused] = React.useState(false);
    const [hasValue, setHasValue] = React.useState(false);

    return (
      <div className="relative">
        <input
          ref={ref}
          className={cn(
            "peer w-full px-4 pt-5 pb-2 border-2 border-border rounded-lg bg-background text-foreground transition-all duration-200",
            "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
            className
          )}
          onFocus={() => setIsFocused(true)}
          onBlur={(e) => {
            setIsFocused(false);
            setHasValue(!!e.target.value);
          }}
          {...props}
        />
        <label
          className={cn(
            "absolute left-4 transition-all duration-200 pointer-events-none text-muted-foreground",
            (isFocused || hasValue || props.value)
              ? "top-2 text-xs text-primary"
              : "top-1/2 -translate-y-1/2 text-sm"
          )}
        >
          {label}
        </label>
      </div>
    );
  }
);
FloatingLabelInput.displayName = "FloatingLabelInput";

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
}

export const AnimatedCounter = ({
  value,
  duration = 1000,
  className,
  prefix = "",
  suffix = "",
}: AnimatedCounterProps) => {
  const [displayValue, setDisplayValue] = React.useState(0);

  React.useEffect(() => {
    const startTime = Date.now();
    const startValue = displayValue;
    const diff = value - startValue;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease out cubic
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = startValue + diff * easeOut;
      
      setDisplayValue(Math.round(current));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [value, duration]);

  return (
    <span className={className}>
      {prefix}{displayValue.toLocaleString()}{suffix}
    </span>
  );
};

interface ShimmerProps {
  className?: string;
  width?: string;
  height?: string;
}

export const Shimmer = ({ 
  className, 
  width = "100%", 
  height = "1rem" 
}: ShimmerProps) => {
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-muted rounded-md",
        className
      )}
      style={{ width, height }}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
    </div>
  );
};