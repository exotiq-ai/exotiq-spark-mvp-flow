import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface SegmentOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface SegmentControlProps {
  options: SegmentOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  size?: "sm" | "md";
}

export const SegmentControl = ({ 
  options, 
  value, 
  onChange, 
  className,
  size = "md" 
}: SegmentControlProps) => {
  const selectedIndex = options.findIndex(opt => opt.value === value);

  return (
    <div 
      className={cn(
        "relative inline-flex bg-muted/50 rounded-full p-1",
        className
      )}
      role="tablist"
    >
      {/* Animated background pill */}
      <motion.div
        className="absolute bg-background rounded-full shadow-sm border border-border/50"
        layoutId="segment-bg"
        initial={false}
        animate={{
          left: `${(selectedIndex * 100) / options.length}%`,
          width: `${100 / options.length}%`,
        }}
        style={{
          top: 4,
          bottom: 4,
        }}
        transition={{
          type: "spring",
          stiffness: 500,
          damping: 35,
        }}
      />

      {/* Options */}
      {options.map((option) => (
        <button
          key={option.value}
          role="tab"
          aria-selected={value === option.value}
          onClick={() => {
            if (navigator.vibrate) navigator.vibrate(5);
            onChange(option.value);
          }}
          className={cn(
            "relative z-10 flex items-center justify-center gap-1.5 rounded-full transition-colors",
            size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm",
            "font-medium whitespace-nowrap",
            value === option.value
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground/80"
          )}
        >
          {option.icon && <span className="flex-shrink-0">{option.icon}</span>}
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
};
