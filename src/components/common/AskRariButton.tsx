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
            "border-gulf-blue/30 hover:border-gulf-blue hover:bg-gulf-blue/10",
            "transition-all duration-300 hover:scale-105 active:scale-95",
            "hover:shadow-[0_0_20px_rgba(37,150,190,0.2)]",
            className
          )}
        >
          <Sparkles className="w-4 h-4 mr-2 text-gulf-blue animate-pulse-soft" />
          Ask Rari AI
        </Button>
        
        <Dialog open={showRari} onOpenChange={setShowRari}>
          <DialogContent className="sm:max-w-[600px]">
            <FocusTrap active={showRari}>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-accent" aria-hidden="true" />
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
          "bg-gulf-blue/20 hover:bg-gulf-blue/30 backdrop-blur-xl",
          "border border-gulf-blue/30 hover:border-gulf-blue/50",
          "text-gulf-blue hover:text-gulf-blue-dark",
          "rounded-full w-14 h-14 md:w-16 md:h-16 p-0",
          "animate-breathing-glow",
          "hover:scale-105 active:scale-95 transition-all duration-300 ease-out",
          "will-change-transform",
          className
        )}
        aria-label="Ask Rari AI"
      >
        <Sparkles className="w-5 h-5 md:w-6 md:h-6 animate-pulse-soft" />
      </Button>

      <Dialog open={showRari} onOpenChange={setShowRari}>
        <DialogContent className="sm:max-w-[600px]">
          <FocusTrap active={showRari}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-accent" aria-hidden="true" />
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
