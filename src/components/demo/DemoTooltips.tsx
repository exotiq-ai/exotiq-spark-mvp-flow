
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";

interface DemoTooltipProps {
  content: string;
  children: React.ReactNode;
}

export const DemoTooltip: React.FC<DemoTooltipProps> = ({ content, children }) => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative group">
            {children}
            <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="w-5 h-5 bg-primary/90 rounded-full flex items-center justify-center">
                <HelpCircle className="w-3 h-3 text-primary-foreground" />
              </div>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs text-sm">{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export const demoTooltips = {
  motoriq: "MotorIQ uses AI to analyze your fleet's profitability in real-time, suggesting optimal pricing and identifying revenue opportunities you might miss.",
  pulse: "Pulse provides live analytics and insights into your fleet operations, helping you make data-driven decisions instantly.",
  book: "Our direct booking system eliminates third-party fees and gives you complete control over customer relationships and pricing.",
  vault: "Vault automatically tracks all compliance requirements, insurance renewals, and documentation, preventing costly oversights.",
  core: "The AI command center automates routine tasks and provides intelligent recommendations to optimize your entire operation."
};
