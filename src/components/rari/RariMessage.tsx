import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bot, User, Copy, Check } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";

interface RariMessageProps {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  avatarUrl?: string;
}

export const RariMessage = ({ role, content, timestamp, avatarUrl }: RariMessageProps) => {
  const [copied, setCopied] = useState(false);
  const isAssistant = role === "assistant";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div
      className={cn(
        "group flex gap-3 animate-in slide-in-from-bottom-2 duration-300",
        isAssistant ? "justify-start" : "justify-end"
      )}
    >
      {/* Assistant Avatar */}
      {isAssistant && (
        <Avatar className="h-8 w-8 shrink-0 border border-gulf-blue/20 shadow-sm">
          <AvatarImage src={avatarUrl || "/lovable-uploads/ea741db3-49ad-45fc-8c13-a2e2dcb69d75.png"} alt="Rari" />
          <AvatarFallback className="bg-gulf-blue/10 text-gulf-blue">
            <Bot className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      )}

      {/* Message Bubble */}
      <div
        className={cn(
          "relative max-w-[80%] rounded-2xl px-4 py-3 shadow-sm transition-all",
          isAssistant
            ? "bg-muted/80 backdrop-blur-sm border border-border/50 rounded-tl-md"
            : "bg-gulf-blue text-white rounded-tr-md"
        )}
      >
        {/* Content */}
        <div
          className={cn(
            "text-sm leading-relaxed",
            isAssistant ? "prose prose-sm dark:prose-invert max-w-none" : ""
          )}
        >
          {isAssistant ? (
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                li: ({ children }) => <li className="text-sm">{children}</li>,
                strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                code: ({ children }) => (
                  <code className="bg-background/50 px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>
                ),
              }}
            >
              {content}
            </ReactMarkdown>
          ) : (
            content
          )}
        </div>

        {/* Timestamp & Actions */}
        <div
          className={cn(
            "flex items-center gap-2 mt-2 text-xs",
            isAssistant ? "text-muted-foreground" : "text-white/70"
          )}
        >
          <span>{formatTime(timestamp)}</span>
          
          {/* Copy button - shown on hover */}
          <button
            onClick={handleCopy}
            className={cn(
              "opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-black/10",
              copied && "opacity-100"
            )}
            title="Copy message"
          >
            {copied ? (
              <Check className="h-3 w-3" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </button>
        </div>
      </div>

      {/* User Avatar */}
      {!isAssistant && (
        <Avatar className="h-8 w-8 shrink-0 border border-primary/20 shadow-sm">
          <AvatarFallback className="bg-primary/10 text-primary">
            <User className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
};
