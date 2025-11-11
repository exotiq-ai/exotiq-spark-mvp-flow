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
            "border-accent/30 hover:border-accent hover:bg-accent/10 transition-all",
            className
          )}
        >
          <Sparkles className="w-4 h-4 mr-2 text-accent" />
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
        onClick={() => setShowRari(true)}
        size="lg"
        className={cn(
          "fixed bottom-20 right-6 md:bottom-6 z-50",
          "bg-[#2596BE]/20 hover:bg-[#2596BE]/30 backdrop-blur-xl",
          "border border-[#2596BE]/30 hover:border-[#2596BE]/50",
          "text-[#2596BE] hover:text-[#1A7193]",
          "rounded-full w-12 h-12 md:w-14 md:h-14 p-0",
          "shadow-[0_0_20px_rgba(37,150,190,0.25)] hover:shadow-[0_0_30px_rgba(37,150,190,0.35)]",
          "hover:scale-105 active:scale-95 transition-all duration-300 ease-out",
          className
        )}
        aria-label="Ask Rari AI"
      >
        <Sparkles className="w-5 h-5 md:w-6 md:h-6" />
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
