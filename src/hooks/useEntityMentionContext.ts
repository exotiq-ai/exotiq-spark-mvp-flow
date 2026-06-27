import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { MentionableMember, MentionableGroup, MentionContext } from "@/lib/mentions";

// Module-scoped cache: one fetch per teamId per session. Shared across all
// open EntityCommentThread instances so a list view with 20 badges doesn't
// fire 20 identical queries.
const cache = new Map<
  string,
  { members: MentionableMember[]; groups: MentionableGroup[] }
>();
const inflight = new Map<
  string,
  Promise<{ members: MentionableMember[]; groups: MentionableGroup[] }>
>();

const loadForTeam = async (teamId: string) => {
  if (cache.has(teamId)) return cache.get(teamId)!;
  if (inflight.has(teamId)) return inflight.get(teamId)!;

  const p = (async () => {
    const [membersRes, groupsRes] = await Promise.all([
      supabase
        .from("team_members")
        .select("user_id, role, is_active, profiles(id, full_name, email, avatar_url, handle)")
        .eq("team_id", teamId),
      supabase
        .from("team_groups")
        .select("id, name, slug, team_group_members(user_id)")
        .eq("team_id", teamId),
    ]);

    const members: MentionableMember[] = (membersRes.data || [])
      .filter((tm: any) => tm.profiles)
      .map((tm: any) => ({
        id: tm.profiles.id,
        name: tm.profiles.full_name || tm.profiles.email,
        email: tm.profiles.email,
        handle: tm.profiles.handle,
        avatar_url: tm.profiles.avatar_url,
        role: tm.role ?? null,
        is_active: tm.is_active !== false,
      }));

    const groups: MentionableGroup[] = (groupsRes.data || []).map((g: any) => ({
      slug: g.slug,
      name: g.name,
      member_ids: (g.team_group_members || []).map((m: any) => m.user_id),
    }));

    const value = { members, groups };
    cache.set(teamId, value);
    return value;
  })();

  inflight.set(teamId, p);
  try {
    return await p;
  } finally {
    inflight.delete(teamId);
  }
};

export const invalidateMentionContextCache = (teamId?: string) => {
  if (teamId) cache.delete(teamId);
  else cache.clear();
};

/**
 * Resolves the @mention context for a given team — used by EntityCommentThread.
 * `conversationMemberIds` is set to all team members so `@all` notifies the team.
 * (The edge function still re-validates entity access per recipient.)
 */
export const useEntityMentionContext = (
  teamId: string | null | undefined,
): { ctx: MentionContext | null; loading: boolean } => {
  const [ctx, setCtx] = useState<MentionContext | null>(
    teamId && cache.has(teamId)
      ? {
          teamMembers: cache.get(teamId)!.members,
          groups: cache.get(teamId)!.groups,
          conversationMemberIds: cache
            .get(teamId)!
            .members.filter((m) => m.is_active !== false)
            .map((m) => m.id),
        }
      : null,
  );
  const [loading, setLoading] = useState(!ctx && !!teamId);

  useEffect(() => {
    if (!teamId) {
      setCtx(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(!cache.has(teamId));
    loadForTeam(teamId)
      .then(({ members, groups }) => {
        if (cancelled) return;
        setCtx({
          teamMembers: members,
          groups,
          conversationMemberIds: members
            .filter((m) => m.is_active !== false)
            .map((m) => m.id),
        });
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  return { ctx, loading };
};
