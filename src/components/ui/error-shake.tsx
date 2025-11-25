import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ErrorShakeProps {
  children: React.ReactNode;
  trigger?: boolean;
  className?: string;
}

export const ErrorShake = ({ 
  children, 
  trigger = true,
  className 
}: ErrorShakeProps) => {
  return (
    <motion.div
      animate={trigger ? { x: [-10, 10, -8, 8, -5, 5, 0] } : undefined}
      transition={trigger ? { duration: 0.5 } : undefined}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
};
