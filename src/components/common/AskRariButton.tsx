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
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-accent" />
                Rari AI Assistant - {moduleName}
              </DialogTitle>
              <DialogDescription>
                {getModuleContext()}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4">
              <RariVoiceInterface />
            </div>
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
          "fixed bottom-20 right-6 md:bottom-6 z-50 shadow-xl",
          "bg-accent hover:bg-accent/90 text-accent-foreground",
          "rounded-full w-14 h-14 p-0",
          "hover:scale-110 transition-all duration-200",
          "animate-pulse-glow",
          className
        )}
        aria-label="Ask Rari AI"
      >
        <Sparkles className="w-6 h-6" />
      </Button>

      <Dialog open={showRari} onOpenChange={setShowRari}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-accent" />
              Rari AI Assistant - {moduleName}
            </DialogTitle>
            <DialogDescription>
              {getModuleContext()}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <RariVoiceInterface />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
