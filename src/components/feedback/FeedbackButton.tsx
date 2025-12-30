import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeedbackSubmissionDialog } from "./FeedbackSubmissionDialog";

interface FeedbackButtonProps {
  context?: Record<string, any>;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export function FeedbackButton({ context, variant = "outline", size = "default", className }: FeedbackButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setOpen(true)}
        className={className}
      >
        <MessageSquare className="w-4 h-4 mr-2" />
        Feedback
      </Button>
      <FeedbackSubmissionDialog
        open={open}
        onOpenChange={setOpen}
        initialContext={context}
      />
    </>
  );
}
