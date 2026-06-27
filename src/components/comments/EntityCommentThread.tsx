import { useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, BellOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useEntityComments } from "@/hooks/useEntityComments";
import { useEntityMentionContext } from "@/hooks/useEntityMentionContext";
import { EntityCommentItem } from "./EntityCommentItem";
import { EntityCommentComposer } from "./EntityCommentComposer";
import type { EntityType } from "@/lib/entityCommentRoutes";
import { isImmutableEntityType, ENTITY_LABELS } from "@/lib/entityCommentRoutes";
import { cn } from "@/lib/utils";

interface EntityCommentThreadProps {
  entityType: EntityType;
  entityId: string;
  teamId: string;
  recordLabel?: string;
  density?: "compact" | "comfortable";
  className?: string;
  /** Mark the thread as read whenever it is visible. Default: true. */
  autoMarkRead?: boolean;
}

export const EntityCommentThread = ({
  entityType,
  entityId,
  teamId,
  recordLabel,
  density = "comfortable",
  className,
  autoMarkRead = true,
}: EntityCommentThreadProps) => {
  const { user } = useAuth();
  const { isOwner, isAdmin } = useUserRole();
  const { ctx, loading: ctxLoading } = useEntityMentionContext(teamId);
  const { comments, loading, posting, post, remove, toggleResolved, markRead } =
    useEntityComments(entityType, entityId);

  const immutable = isImmutableEntityType(entityType);

  // Mark read when comments load + on unmount
  useEffect(() => {
    if (autoMarkRead && !loading && comments.length > 0) {
      markRead();
    }
  }, [autoMarkRead, loading, comments.length, markRead]);

  const handleSubmit = async ({
    content,
    mentions,
  }: {
    content: string;
    mentions: string[];
  }) => {
    await post({ content, mentions }, teamId);
  };

  const showLoading = loading || ctxLoading || !ctx;

  return (
    <div className={cn("flex flex-col gap-2", className)} aria-live="polite">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <MessageSquare className="h-3.5 w-3.5" />
        <span>
          Activity {comments.length > 0 && `· ${comments.length}`}
          {recordLabel ? ` on ${recordLabel}` : ` on this ${ENTITY_LABELS[entityType]}`}
        </span>
        {immutable && (
          <span className="ml-auto text-[10px] flex items-center gap-1">
            <BellOff className="h-3 w-3" /> Read-only audit log
          </span>
        )}
      </div>

      <div
        className={cn(
          "flex flex-col divide-y divide-border/50 max-h-[360px] overflow-y-auto rounded-md border border-border/60 bg-card",
          density === "compact" && "max-h-[240px]",
        )}
      >
        {showLoading ? (
          <div className="p-3 space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-3/4" />
          </div>
        ) : comments.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            <AtIcon />
            <p className="mt-2">
              Tag a teammate with{" "}
              <span className="font-mono text-foreground">@</span> to start a
              conversation about this {ENTITY_LABELS[entityType]}.
            </p>
          </div>
        ) : (
          <div className="px-3">
            {comments.map((c) => (
              <EntityCommentItem
                key={c.id}
                comment={c}
                ctx={ctx!}
                currentUserId={user?.id}
                immutable={immutable}
                onDelete={remove}
                onToggleResolved={toggleResolved}
              />
            ))}
          </div>
        )}
      </div>

      {ctx && (
        <EntityCommentComposer
          ctx={ctx}
          currentUserId={user?.id}
          canMentionAll={isOwner || isAdmin}
          posting={posting}
          onSubmit={handleSubmit}
          placeholder={`Comment on this ${ENTITY_LABELS[entityType]}…`}
        />
      )}
    </div>
  );
};

const AtIcon = () => (
  <span className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-muted text-muted-foreground">
    @
  </span>
);
