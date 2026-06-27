import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { EntityType } from "@/lib/entityCommentRoutes";

export interface EntityComment {
  id: string;
  user_id: string;
  entity_type: string;
  entity_id: string;
  content: string;
  mentions: string[] | null;
  parent_id: string | null;
  is_resolved: boolean | null;
  created_at: string;
  updated_at: string | null;
  author?: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
    handle: string | null;
  } | null;
}

export interface PostCommentInput {
  content: string;
  mentions: string[];
  parentId?: string;
}

export const useEntityComments = (
  entityType: EntityType,
  entityId: string | null,
) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<EntityComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [lastReadAt, setLastReadAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!entityId) {
      setComments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("entity_comments")
      .select(
        "id, user_id, entity_type, entity_id, content, mentions, parent_id, is_resolved, created_at, updated_at, author:profiles!entity_comments_user_id_fkey(id, full_name, email, avatar_url, handle)",
      )
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[entity-comments] load failed", error);
      setLoading(false);
      return;
    }
    setComments((data as unknown as EntityComment[]) || []);
    setLoading(false);
  }, [entityType, entityId]);

  const loadReadReceipt = useCallback(async () => {
    if (!user || !entityId) return;
    const { data } = await supabase
      .from("entity_comment_reads")
      .select("last_read_at")
      .eq("user_id", user.id)
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .maybeSingle();
    setLastReadAt(data?.last_read_at ?? null);
  }, [user?.id, entityType, entityId]);

  const markRead = useCallback(async () => {
    if (!user || !entityId) return;
    const now = new Date().toISOString();
    await supabase
      .from("entity_comment_reads")
      .upsert(
        {
          user_id: user.id,
          entity_type: entityType,
          entity_id: entityId,
          last_read_at: now,
        },
        { onConflict: "user_id,entity_type,entity_id" },
      );
    setLastReadAt(now);
  }, [user?.id, entityType, entityId]);

  useEffect(() => {
    load();
    loadReadReceipt();
  }, [load, loadReadReceipt]);

  // Realtime: subscribe to changes for this specific entity thread
  useEffect(() => {
    if (!entityId) return;
    const channel = supabase
      .channel(`entity-comments-${entityType}-${entityId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "entity_comments",
          filter: `entity_id=eq.${entityId}`,
        },
        () => {
          load();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [entityType, entityId, load]);

  const post = useCallback(
    async ({ content, mentions, parentId }: PostCommentInput, teamId?: string) => {
      if (!user || !entityId || !content.trim()) return null;
      setPosting(true);
      try {
        const { data, error } = await supabase
          .from("entity_comments")
          .insert({
            user_id: user.id,
            entity_type: entityType,
            entity_id: entityId,
            content: content.trim(),
            mentions: mentions.length > 0 ? mentions : null,
            parent_id: parentId ?? null,
          })
          .select(
            "id, user_id, entity_type, entity_id, content, mentions, parent_id, is_resolved, created_at, updated_at",
          )
          .single();

        if (error) {
          toast.error("Couldn't post comment", { description: error.message });
          return null;
        }

        // Fire notification for mentioned users (non-blocking)
        if (mentions.length > 0 && teamId) {
          supabase.functions
            .invoke("entity-mention-notification", {
              body: {
                mentionedUserIds: mentions,
                entityType,
                entityId,
                teamId,
                commentId: data.id,
                content: content.trim(),
              },
            })
            .catch((e) => console.error("[entity-mention-notification] failed", e));
        }

        await load();
        await markRead();
        return data;
      } finally {
        setPosting(false);
      }
    },
    [user?.id, entityType, entityId, load, markRead],
  );

  const remove = useCallback(
    async (commentId: string) => {
      const { error } = await supabase
        .from("entity_comments")
        .delete()
        .eq("id", commentId);
      if (error) {
        toast.error("Couldn't delete comment", { description: error.message });
        return false;
      }
      await load();
      return true;
    },
    [load],
  );

  const toggleResolved = useCallback(
    async (commentId: string, resolved: boolean) => {
      const { error } = await supabase
        .from("entity_comments")
        .update({ is_resolved: resolved })
        .eq("id", commentId);
      if (error) {
        toast.error("Couldn't update comment", { description: error.message });
        return false;
      }
      await load();
      return true;
    },
    [load],
  );

  // Unread = comments newer than last read receipt that mention me
  const unreadForMe = user
    ? comments.filter(
        (c) =>
          c.user_id !== user.id &&
          (!lastReadAt || c.created_at > lastReadAt) &&
          (c.mentions || []).includes(user.id),
      ).length
    : 0;

  return {
    comments,
    loading,
    posting,
    post,
    remove,
    toggleResolved,
    markRead,
    unreadForMe,
    refresh: load,
  };
};
