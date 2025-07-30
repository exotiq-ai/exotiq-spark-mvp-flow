import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export const Logo = ({ className, size = "md" }: LogoProps) => {
  const sizeClasses = {
    sm: "h-8",
    md: "h-12 sm:h-10", 
    lg: "h-16 sm:h-12"
  };

  return (
    <img 
      src="/lovable-uploads/ea741db3-49ad-45fc-8c13-a2e2dcb69d75.png" 
      alt="ExotIQ Logo" 
      className={cn("w-auto", sizeClasses[size], className)}
      onError={(e) => {
        console.warn("Logo failed to load, using fallback");
        e.currentTarget.style.display = "none";
      }}
    />
  );
};