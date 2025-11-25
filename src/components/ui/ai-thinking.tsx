import { Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface AIThinkingProps {
  variant?: "gradient" | "dots" | "wave" | "minimal";
  className?: string;
  text?: string;
}

export const AIThinking = ({ 
  variant = "gradient", 
  className,
  text = "Rari is thinking..."
}: AIThinkingProps) => {
  
  if (variant === "gradient") {
    return (
      <div className={cn("flex items-center gap-3 p-4 rounded-lg bg-gradient-to-r from-gulf-blue/10 via-accent/10 to-gulf-blue/10 bg-[length:200%_100%] animate-gradient-flow", className)}>
        <Sparkles className="w-5 h-5 text-gulf-blue animate-pulse-soft" />
        <span className="text-sm font-medium text-foreground">{text}</span>
        <div className="flex gap-1 ml-auto">
          <span className="w-2 h-2 bg-gulf-blue rounded-full animate-wave" />
          <span className="w-2 h-2 bg-gulf-blue rounded-full animate-wave" style={{ animationDelay: '0.2s' }} />
          <span className="w-2 h-2 bg-gulf-blue rounded-full animate-wave" style={{ animationDelay: '0.4s' }} />
        </div>
      </div>
    );
  }

  if (variant === "dots") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <span className="text-sm text-muted-foreground">{text}</span>
        <div className="flex gap-1">
          <span className="w-1.5 h-1.5 bg-gulf-blue rounded-full animate-wave" />
          <span className="w-1.5 h-1.5 bg-gulf-blue rounded-full animate-wave" style={{ animationDelay: '0.2s' }} />
          <span className="w-1.5 h-1.5 bg-gulf-blue rounded-full animate-wave" style={{ animationDelay: '0.4s' }} />
        </div>
      </div>
    );
  }

  if (variant === "wave") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="flex items-end gap-0.5 h-6">
          {[...Array(5)].map((_, i) => (
            <span 
              key={i}
              className="w-1 bg-gulf-blue rounded-full animate-wave"
              style={{ 
                animationDelay: `${i * 0.1}s`,
                height: '50%'
              }}
            />
          ))}
        </div>
        <span className="text-sm text-muted-foreground">{text}</span>
      </div>
    );
  }

  // minimal variant
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Loader2 className="w-4 h-4 text-gulf-blue animate-spin" />
      <span className="text-sm text-muted-foreground">{text}</span>
    </div>
  );
};
