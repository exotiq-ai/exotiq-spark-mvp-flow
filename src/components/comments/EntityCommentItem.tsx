import { useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check, MoreHorizontal, Trash2, RotateCcw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import type { EntityComment } from "@/hooks/useEntityComments";
import type { MentionContext } from "@/lib/mentions";
import { resolveMention } from "@/lib/mentions";

interface EntityCommentItemProps {
  comment: EntityComment;
  ctx: MentionContext;
  currentUserId?: string;
  immutable?: boolean;
  onDelete?: (id: string) => void;
  onToggleResolved?: (id: string, resolved: boolean) => void;
}

// Splits content into plain text + mention pill segments.
const renderContent = (
  content: string,
  ctx: MentionContext,
): React.ReactNode[] => {
  const parts: React.ReactNode[] = [];
  const re = /@([a-zA-Z0-9_.-]{1,32})/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(content)) !== null) {
    if (m.index > last) parts.push(content.slice(last, m.index));
    const token = resolveMention(m[1], ctx);
    if (!token) {
      parts.push(m[0]);
    } else {
      const user = ctx.teamMembers.find((u) => u.id === token.userIds[0]);
      const inactive = token.kind === "user" && user?.is_active === false;
      parts.push(
        <span
          key={`m-${key++}`}
          className={cn(
            "inline-flex items-baseline px-1.5 py-0.5 rounded text-[0.85em] font-medium",
            inactive && "bg-muted text-muted-foreground line-through",
            !inactive && token.kind === "user" && "bg-primary/15 text-primary",
            !inactive && token.kind === "role" && "bg-warning/15 text-warning",
            !inactive && token.kind === "all" && "bg-destructive/15 text-destructive",
            !inactive && token.kind === "group" && "bg-primary/15 text-primary",
          )}
          aria-label={
            inactive
              ? `Mention: ${user?.name} (inactive)`
              : `Mention: ${token.label}`
          }
        >
          {inactive ? `@${user?.name} (inactive)` : token.label}
        </span>,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < content.length) parts.push(content.slice(last));
  return parts;
};

export const EntityCommentItem = ({
  comment,
  ctx,
  currentUserId,
  immutable,
  onDelete,
  onToggleResolved,
}: EntityCommentItemProps) => {
  const [confirming, setConfirming] = useState(false);
  const isOwn = comment.user_id === currentUserId;
  const canModify = !immutable && (isOwn || false);
  const authorName = comment.author?.full_name || comment.author?.email || "Teammate";
  const rendered = useMemo(() => renderContent(comment.content, ctx), [comment.content, ctx]);

  return (
    <div
      className={cn(
        "group flex gap-3 py-2",
        comment.is_resolved && "opacity-60",
      )}
    >
      <Avatar className="h-7 w-7 mt-0.5 flex-shrink-0">
        <AvatarImage src={comment.author?.avatar_url || undefined} />
        <AvatarFallback className="text-[10px]">
          {authorName
            .split(" ")
            .map((n) => n[0])
            .join("")
            .slice(0, 2)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className="text-sm font-medium">{authorName}</span>
          <span className="text-[11px] text-muted-foreground">
            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
          </span>
          {comment.is_resolved && (
            <span className="text-[10px] text-success flex items-center gap-0.5">
              <Check className="h-3 w-3" /> Resolved
            </span>
          )}
        </div>
        <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
          {rendered}
        </div>
      </div>
      <div className="flex items-start opacity-0 group-hover:opacity-100 transition-opacity">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onToggleResolved && (
              <DropdownMenuItem
                onClick={() => onToggleResolved(comment.id, !comment.is_resolved)}
              >
                {comment.is_resolved ? (
                  <>
                    <RotateCcw className="h-3.5 w-3.5 mr-2" /> Reopen
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5 mr-2" /> Mark resolved
                  </>
                )}
              </DropdownMenuItem>
            )}
            {canModify && onDelete && (
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => {
                  if (confirming) {
                    onDelete(comment.id);
                  } else {
                    setConfirming(true);
                    setTimeout(() => setConfirming(false), 3000);
                  }
                }}
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" />
                {confirming ? "Click again to confirm" : "Delete"}
              </DropdownMenuItem>
            )}
            {immutable && isOwn && (
              <DropdownMenuItem disabled className="text-xs">
                Damage-claim comments are read-only
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};
