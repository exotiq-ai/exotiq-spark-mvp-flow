import { useState, useEffect, ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface CollapsibleSectionProps {
  id: string;
  title: string;
  icon?: ReactNode;
  badge?: string | number;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  headerClassName?: string;
  actions?: ReactNode;
}

export const CollapsibleSection = ({
  id,
  title,
  icon,
  badge,
  badgeVariant = "secondary",
  children,
  defaultOpen = true,
  className,
  headerClassName,
  actions
}: CollapsibleSectionProps) => {
  const storageKey = `pulse-section-${id}`;
  
  const [isOpen, setIsOpen] = useState(() => {
    const stored = localStorage.getItem(storageKey);
    return stored !== null ? stored === "true" : defaultOpen;
  });

  useEffect(() => {
    localStorage.setItem(storageKey, String(isOpen));
  }, [isOpen, storageKey]);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className={cn("overflow-hidden", className)}>
        <CollapsibleTrigger asChild>
          <div 
            className={cn(
              "flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors",
              headerClassName
            )}
          >
            <div className="flex items-center gap-2">
              {icon}
              <h3 className="font-semibold">{title}</h3>
              {badge !== undefined && (
                <Badge variant={badgeVariant} className="ml-1">
                  {badge}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {actions && (
                <div onClick={(e) => e.stopPropagation()}>
                  {actions}
                </div>
              )}
              <Button variant="ghost" size="icon" className="h-8 w-8">
                {isOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4">
            {children}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
