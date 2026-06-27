import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface EntityCommentBadgeProps {
  count: number;
  unread?: number;
  className?: string;
  iconOnly?: boolean;
}

export const EntityCommentBadge = ({
  count,
  unread = 0,
  className,
  iconOnly,
}: EntityCommentBadgeProps) => {
  if (count === 0 && unread === 0) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs text-muted-foreground",
        unread > 0 && "text-warning font-medium",
        className,
      )}
    >
      <span className="relative">
        <MessageSquare className="h-3.5 w-3.5" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 h-1.5 w-1.5 rounded-full bg-warning animate-pulse" />
        )}
      </span>
      {!iconOnly && <span>{count}</span>}
    </span>
  );
};
