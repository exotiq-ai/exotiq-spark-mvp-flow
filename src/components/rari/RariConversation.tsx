import { useStickToBottom } from "use-stick-to-bottom";
import { cn } from "@/lib/utils";
import { RariMessage } from "./RariMessage";
import { Bot, ChevronDown, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface RariConversationProps {
  messages: Message[];
  className?: string;
}

export const RariConversation = ({ messages, className }: RariConversationProps) => {
  const { scrollRef, contentRef, isAtBottom, scrollToBottom } = useStickToBottom();

  // Empty state
  if (messages.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center py-8 text-center space-y-3",
          className
        )}
      >
        <div className="p-4 rounded-full bg-gulf-blue/10 border border-gulf-blue/20">
          <Bot className="h-8 w-8 text-gulf-blue" />
        </div>
        <div className="space-y-1">
          <h4 className="font-medium text-foreground">Start a Conversation</h4>
          <p className="text-sm text-muted-foreground max-w-[250px]">
            Click the button below to connect with Rari and manage your fleet with voice
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      {/* Scrollable Container */}
      <div
        ref={scrollRef}
        className="h-[280px] overflow-y-auto rounded-lg border bg-background/50 backdrop-blur-sm"
      >
        <div ref={contentRef} className="p-4 space-y-4">
          {messages.map((msg, idx) => (
            <RariMessage
              key={idx}
              role={msg.role}
              content={msg.content}
              timestamp={msg.timestamp}
            />
          ))}
        </div>
      </div>

      {/* Scroll to Bottom Button */}
      {!isAtBottom && (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => scrollToBottom()}
          className={cn(
            "absolute bottom-4 left-1/2 -translate-x-1/2 shadow-lg",
            "flex items-center gap-1 px-3 py-1 h-auto text-xs",
            "animate-in fade-in slide-in-from-bottom-2 duration-200"
          )}
        >
          <ChevronDown className="h-3 w-3" />
          New messages
        </Button>
      )}

      {/* Message count indicator */}
      <div className="flex items-center justify-between mt-2 px-1">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MessageSquare className="h-3 w-3" />
          <span>{messages.length} message{messages.length !== 1 ? "s" : ""}</span>
        </div>
      </div>
    </div>
  );
};
