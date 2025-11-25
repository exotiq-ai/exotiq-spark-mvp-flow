import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { successCheckmark } from "@/lib/animations";
import { cn } from "@/lib/utils";

interface SuccessCheckmarkProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "h-6 w-6",
  md: "h-10 w-10",
  lg: "h-16 w-16"
};

const iconSizes = {
  sm: 16,
  md: 24,
  lg: 32
};

export const SuccessCheckmark = ({ 
  className, 
  size = "md" 
}: SuccessCheckmarkProps) => {
  return (
    <motion.div
      {...successCheckmark}
      className={cn(
        "rounded-full bg-success/20 flex items-center justify-center",
        sizeClasses[size],
        className
      )}
    >
      <Check 
        className="text-success" 
        size={iconSizes[size]}
        strokeWidth={3}
      />
    </motion.div>
  );
};
