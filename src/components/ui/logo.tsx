import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export const Logo = ({ className, size = "md" }: LogoProps) => {
  const sizeClasses = {
    sm: "h-8",
    md: "h-10", 
    lg: "h-12"
  };

  return (
    <img 
      src="/exotiq-logo.png" 
      alt="ExotIQ Logo" 
      className={cn("w-auto", sizeClasses[size], className)}
      onError={(e) => {
        console.warn("Logo failed to load, using fallback");
        e.currentTarget.style.display = "none";
      }}
    />
  );
};