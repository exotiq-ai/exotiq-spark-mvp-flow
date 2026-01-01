import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { RariVoiceInterface } from "@/components/rari/RariVoiceInterface";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FocusTrap } from "@/components/ui/focus-trap";
import { cn } from "@/lib/utils";

interface AskRariButtonProps {
  moduleId: string;
  moduleName: string;
  contextPrompt?: string;
  className?: string;
  variant?: "floating" | "inline";
}

export const AskRariButton = ({ 
  moduleId, 
  moduleName, 
  contextPrompt,
  className,
  variant = "floating"
}: AskRariButtonProps) => {
  const [showRari, setShowRari] = useState(false);

  const getModuleContext = () => {
    const contexts: { [key: string]: string } = {
      motoriq: "Ask me about pricing strategies, utilization optimization, or revenue opportunities for your fleet.",
      pulse: "Ask me about driver performance, live metrics, or real-time analytics.",
      book: "Ask me about bookings, availability, schedule conflicts, or customer information.",
      vault: "Ask me about compliance status, expiring documents, or insurance requirements.",
      core: "Ask me anything about your fleet operations, analytics, or business insights."
    };
    return contextPrompt || contexts[moduleId] || "How can I help you with your fleet?";
  };

  if (variant === "inline") {
    return (
      <>
        <Button
          onClick={() => setShowRari(true)}
          variant="outline"
          className={cn(
            "border-rari-teal/30 hover:border-rari-teal hover:bg-rari-teal/10",
            "transition-all duration-300 hover:scale-105 active:scale-95",
            "hover:shadow-[0_0_20px_hsl(var(--rari-teal)/0.25)]",
            "backdrop-blur-sm",
            className
          )}
        >
          <Sparkles className="w-4 h-4 mr-2 text-rari-teal animate-pulse-soft" />
          Ask Rari AI
        </Button>
        
        <Dialog open={showRari} onOpenChange={setShowRari}>
          <DialogContent className="sm:max-w-[600px]">
            <FocusTrap active={showRari}>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-rari-teal" aria-hidden="true" />
                  Rari AI Assistant - {moduleName}
                </DialogTitle>
                <DialogDescription>
                  {getModuleContext()}
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4">
                <RariVoiceInterface />
              </div>
            </FocusTrap>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <Button
        data-tour="rari-button"
        onClick={() => setShowRari(true)}
        size="lg"
        className={cn(
          "fixed bottom-[88px] right-4 md:bottom-6 md:right-6 z-50",
          "bg-rari-teal/20 hover:bg-rari-teal/30 backdrop-blur-xl",
          "border border-rari-teal/30 hover:border-rari-teal/50",
          "text-rari-teal hover:text-rari-teal-dark",
          "rounded-full w-14 h-14 md:w-16 md:h-16 p-0",
          "shadow-[0_8px_30px_hsl(var(--rari-teal)/0.25),0_0_60px_hsl(var(--rari-teal)/0.12)]",
          "hover:shadow-[0_12px_40px_hsl(var(--rari-teal)/0.35),0_0_80px_hsl(var(--rari-teal)/0.18)]",
          "hover:scale-105 active:scale-95 transition-all duration-300 ease-out",
          "will-change-transform animate-pulse-subtle",
          className
        )}
        style={{
          boxShadow: '0 8px 30px hsla(var(--rari-teal), 0.25), 0 0 60px hsla(var(--rari-teal), 0.12), inset 0 1px 1px rgba(255,255,255,0.1)'
        }}
        aria-label="Ask Rari AI"
      >
        <Sparkles className="w-5 h-5 md:w-6 md:h-6 animate-pulse-soft" />
      </Button>

      <Dialog open={showRari} onOpenChange={setShowRari}>
        <DialogContent className="sm:max-w-[600px]">
          <FocusTrap active={showRari}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-rari-teal" aria-hidden="true" />
                Rari AI Assistant - {moduleName}
              </DialogTitle>
              <DialogDescription>
                {getModuleContext()}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4">
              <RariVoiceInterface />
            </div>
          </FocusTrap>
        </DialogContent>
      </Dialog>
    </>
  );
};
