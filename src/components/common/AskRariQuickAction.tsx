import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RariVoiceInterface } from "@/components/rari/RariVoiceInterface";
import { MessageSquare, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface AskRariQuickActionProps {
  prompt: string;
  label?: string;
  variant?: 'icon' | 'button' | 'badge';
  moduleId?: string;
  className?: string;
}

export const AskRariQuickAction = ({ 
  prompt, 
  label = "Ask Rari", 
  variant = "button",
  moduleId,
  className 
}: AskRariQuickActionProps) => {
  const [showRari, setShowRari] = useState(false);

  if (variant === 'icon') {
    return (
      <>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowRari(true)}
          className={cn("h-8 w-8 p-0", className)}
          title={prompt}
        >
          <Sparkles className="h-4 w-4 text-primary" />
        </Button>

        <Dialog open={showRari} onOpenChange={setShowRari}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Rari FleetCopilot™
              </DialogTitle>
            </DialogHeader>
            <div className="text-sm text-muted-foreground mb-4">
              {prompt}
            </div>
            <RariVoiceInterface />
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (variant === 'badge') {
    return (
      <>
        <button
          onClick={() => setShowRari(true)}
          className={cn(
            "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
            "bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer",
            className
          )}
        >
          <Sparkles className="h-3 w-3" />
          {label}
        </button>

        <Dialog open={showRari} onOpenChange={setShowRari}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Rari FleetCopilot™
              </DialogTitle>
            </DialogHeader>
            <div className="text-sm text-muted-foreground mb-4">
              {prompt}
            </div>
            <RariVoiceInterface />
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setShowRari(true)}
        className={cn("gap-2", className)}
      >
        <MessageSquare className="h-4 w-4" />
        {label}
      </Button>

      <Dialog open={showRari} onOpenChange={setShowRari}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Rari FleetCopilot™
            </DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground mb-4">
            {prompt}
          </div>
          <RariVoiceInterface />
        </DialogContent>
      </Dialog>
    </>
  );
};
