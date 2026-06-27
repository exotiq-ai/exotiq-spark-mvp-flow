import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTeam } from "@/contexts/TeamContext";
import { toast } from "sonner";

export interface TeamGroup {
  id: string;
  team_id: string;
  name: string;
  slug: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
  member_ids: string[];
}

export const useTeamGroups = () => {
  const { user } = useAuth();
  const { currentTeam } = useTeam();
  const teamId = currentTeam?.id || null;
  const [groups, setGroups] = useState<TeamGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!teamId) {
      setGroups([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data: groupRows, error } = await supabase
        .from("team_groups")
        .select("*")
        .eq("team_id", teamId)
        .order("name");
      if (error) throw error;
      const ids = (groupRows || []).map((g) => g.id);
      let members: { group_id: string; user_id: string }[] = [];
      if (ids.length) {
        const { data: memberRows } = await supabase
          .from("team_group_members")
          .select("group_id, user_id")
          .in("group_id", ids);
        members = memberRows || [];
      }
      const byGroup = new Map<string, string[]>();
      for (const m of members) {
        const arr = byGroup.get(m.group_id) || [];
        arr.push(m.user_id);
        byGroup.set(m.group_id, arr);
      }
      setGroups(
        (groupRows || []).map((g) => ({
          ...g,
          member_ids: byGroup.get(g.id) || [],
        })) as TeamGroup[],
      );
    } catch (e) {
      console.error("Failed to load groups", e);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const createGroup = useCallback(
    async (name: string, slug: string, description?: string) => {
      if (!teamId || !user) return null;
      const { data, error } = await supabase
        .from("team_groups")
        .insert({
          team_id: teamId,
          name,
          slug,
          description: description || null,
          created_by: user.id,
        })
        .select()
        .single();
      if (error) {
        toast.error(error.message);
        return null;
      }
      await fetch();
      return data;
    },
    [teamId, user, fetch],
  );

  const deleteGroup = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("team_groups").delete().eq("id", id);
      if (error) {
        toast.error(error.message);
        return false;
      }
      await fetch();
      return true;
    },
    [fetch],
  );

  const setGroupMembers = useCallback(
    async (groupId: string, userIds: string[]) => {
      // Replace strategy: delete missing, insert new
      const current = groups.find((g) => g.id === groupId);
      const before = new Set(current?.member_ids || []);
      const after = new Set(userIds);
      const toRemove = [...before].filter((id) => !after.has(id));
      const toAdd = [...after].filter((id) => !before.has(id));
      if (toRemove.length) {
        const { error } = await supabase
          .from("team_group_members")
          .delete()
          .eq("group_id", groupId)
          .in("user_id", toRemove);
        if (error) toast.error(error.message);
      }
      if (toAdd.length && user) {
        const { error } = await supabase.from("team_group_members").insert(
          toAdd.map((uid) => ({
            group_id: groupId,
            user_id: uid,
            added_by: user.id,
          })),
        );
        if (error) toast.error(error.message);
      }
      await fetch();
    },
    [groups, user, fetch],
  );

  return { groups, loading, refresh: fetch, createGroup, deleteGroup, setGroupMembers };
};
