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
        "relative inline-flex bg-muted/60 rounded-xl p-1",
        className
      )}
      role="tablist"
    >
      {/* Animated background pill */}
      <motion.div
        className="absolute bg-background rounded-lg shadow-sm border border-border/40"
        layoutId="segment-bg"
        initial={false}
        animate={{
          left: `calc(${(selectedIndex * 100) / options.length}% + 4px)`,
          width: `calc(${100 / options.length}% - 8px)`,
        }}
        style={{
          top: 4,
          bottom: 4,
        }}
        transition={{
          type: "spring",
          stiffness: 400,
          damping: 30,
        }}
      />

      {/* Options */}
      {options.map((option) => {
        const isSelected = value === option.value;
        return (
          <button
            key={option.value}
            role="tab"
            aria-selected={isSelected}
            onClick={() => {
              if (navigator.vibrate) navigator.vibrate(5);
              onChange(option.value);
            }}
            className={cn(
              "relative z-10 flex items-center justify-center gap-1.5 rounded-lg transition-colors",
              size === "sm" ? "px-3 py-2 text-xs min-h-[36px]" : "px-4 py-2.5 text-sm min-h-[40px]",
              "font-medium whitespace-nowrap flex-1",
              isSelected
                ? "text-foreground"
                : "text-muted-foreground active:text-foreground/70"
            )}
          >
            {option.icon && <span className="flex-shrink-0">{option.icon}</span>}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
};
