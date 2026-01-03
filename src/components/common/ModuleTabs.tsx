import { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ModuleTab {
  id: string;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
}

interface ModuleTabsProps {
  tabs: ModuleTab[];
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
  className?: string;
}

export const ModuleTabs = ({
  tabs,
  defaultValue,
  value,
  onValueChange,
  children,
  className,
}: ModuleTabsProps) => {
  return (
    <Tabs
      defaultValue={defaultValue}
      value={value}
      onValueChange={onValueChange}
      className={cn("w-full", className)}
    >
      {/* Unified tab header with improved spacing */}
      <div className="bg-background border-b border-border/40 -mx-4 px-4 sm:-mx-6 sm:px-6">
        <TabsList
          className={cn(
            "w-full h-auto p-0 bg-transparent rounded-none gap-0",
            `grid grid-cols-${tabs.length}`
          )}
          style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className={cn(
                  // Base styles - vertical on mobile, horizontal on desktop
                  "relative flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2",
                  "min-h-[52px] sm:min-h-[48px] px-1 sm:px-3 py-1.5 sm:py-2.5",
                  "rounded-none border-b-2 border-transparent",
                  "text-muted-foreground font-medium text-[10px] sm:text-sm",
                  "transition-all duration-200 ease-out",
                  // Hover state
                  "hover:text-foreground hover:bg-muted/30",
                  // Active state
                  "data-[state=active]:text-primary",
                  "data-[state=active]:border-primary",
                  "data-[state=active]:bg-primary/5",
                  // Focus state
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {/* Short label on mobile, full label on larger screens */}
                <span className="sm:hidden leading-tight">
                  {tab.shortLabel || tab.label}
                </span>
                <span className="hidden sm:inline">
                  {tab.label}
                </span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </div>
      
      {/* Tab content with consistent spacing */}
      <div className="mt-4 sm:mt-6">
        {children}
      </div>
    </Tabs>
  );
};

// Re-export TabsContent for convenience
export { TabsContent } from "@/components/ui/tabs";
