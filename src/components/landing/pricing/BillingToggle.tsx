import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface BillingToggleProps {
  isAnnual: boolean;
  onChange: (annual: boolean) => void;
  size?: "sm" | "default";
  className?: string;
}

export const BillingToggle = ({ isAnnual, onChange, size = "default", className }: BillingToggleProps) => {
  const isSmall = size === "sm";

  return (
    <div className={cn("inline-flex items-center gap-1 rounded-xl bg-muted/60 p-1", className)}>
      <button
        onClick={() => onChange(false)}
        className={cn(
          "rounded-lg font-medium transition-all",
          isSmall ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm",
          !isAnnual
            ? "bg-background text-foreground shadow-sm border border-border/40"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Monthly
      </button>
      <button
        onClick={() => onChange(true)}
        className={cn(
          "rounded-lg font-medium transition-all flex items-center gap-1.5",
          isSmall ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm",
          isAnnual
            ? "bg-background text-foreground shadow-sm border border-border/40"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Annual
        <Badge variant="secondary" className={cn("font-normal", isSmall ? "text-[10px] px-1.5 py-0" : "text-xs px-2 py-0")}>
          Save 2mo
        </Badge>
      </button>
    </div>
  );
};
