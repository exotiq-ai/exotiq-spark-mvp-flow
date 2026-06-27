
-- citext for case-insensitive unique handles
CREATE EXTENSION IF NOT EXISTS citext;

-- 1) profiles.handle + handle_changed_at
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS handle citext,
  ADD COLUMN IF NOT EXISTS handle_changed_at timestamptz;

-- format guard: 2-24 chars, [a-z0-9_.], must start with a letter or number
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_handle_format_chk;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_handle_format_chk
  CHECK (handle IS NULL OR handle ~ '^[a-z0-9][a-z0-9_.]{1,23}$');

CREATE UNIQUE INDEX IF NOT EXISTS profiles_handle_unique_idx
  ON public.profiles (handle)
  WHERE handle IS NOT NULL;

-- Backfill handles for existing users (slugified full_name or email prefix, with numeric collision suffix)
DO $$
DECLARE
  r record;
  base text;
  candidate text;
  n int;
BEGIN
  FOR r IN SELECT id, full_name, email FROM public.profiles WHERE handle IS NULL LOOP
    base := lower(regexp_replace(
      coalesce(nullif(trim(r.full_name), ''), split_part(r.email, '@', 1)),
      '[^a-z0-9_.]+', '', 'g'
    ));
    IF base IS NULL OR length(base) < 2 THEN
      base := 'user' || substr(replace(r.id::text, '-', ''), 1, 6);
    END IF;
    base := substr(base, 1, 20);
    IF base !~ '^[a-z0-9]' THEN
      base := 'u' || base;
    END IF;
    candidate := base;
    n := 1;
    WHILE EXISTS (SELECT 1 FROM public.profiles WHERE handle = candidate::citext) LOOP
      n := n + 1;
      candidate := substr(base, 1, 22) || n::text;
    END LOOP;
    UPDATE public.profiles SET handle = candidate::citext WHERE id = r.id;
  END LOOP;
END $$;

-- 2) team_groups
CREATE TABLE IF NOT EXISTS public.team_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug citext NOT NULL,
  description text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, slug),
  CONSTRAINT team_groups_slug_format_chk CHECK (slug ~ '^[a-z0-9][a-z0-9_-]{1,30}$')
);
CREATE INDEX IF NOT EXISTS team_groups_team_idx ON public.team_groups(team_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_groups TO authenticated;
GRANT ALL ON public.team_groups TO service_role;
ALTER TABLE public.team_groups ENABLE ROW LEVEL SECURITY;

-- helper: is the current user on this team?
CREATE OR REPLACE FUNCTION public.is_team_member(_team_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = _team_id
      AND user_id = auth.uid()
      AND is_active = true
  );
$$;

-- helper: can manage groups (owner/admin/manager)
CREATE OR REPLACE FUNCTION public.can_manage_team_groups(_team_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = _team_id
      AND user_id = auth.uid()
      AND is_active = true
      AND role IN ('owner', 'admin', 'manager')
  );
$$;

CREATE POLICY "Team members can view groups"
  ON public.team_groups FOR SELECT TO authenticated
  USING (public.is_team_member(team_id));

CREATE POLICY "Managers can create groups"
  ON public.team_groups FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_team_groups(team_id));

CREATE POLICY "Managers can update groups"
  ON public.team_groups FOR UPDATE TO authenticated
  USING (public.can_manage_team_groups(team_id))
  WITH CHECK (public.can_manage_team_groups(team_id));

CREATE POLICY "Managers can delete groups"
  ON public.team_groups FOR DELETE TO authenticated
  USING (public.can_manage_team_groups(team_id));

-- 3) team_group_members
CREATE TABLE IF NOT EXISTS public.team_group_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid NOT NULL REFERENCES public.team_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);
CREATE INDEX IF NOT EXISTS team_group_members_group_idx ON public.team_group_members(group_id);
CREATE INDEX IF NOT EXISTS team_group_members_user_idx ON public.team_group_members(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_group_members TO authenticated;
GRANT ALL ON public.team_group_members TO service_role;
ALTER TABLE public.team_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view group members"
  ON public.team_group_members FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.team_groups g
    WHERE g.id = team_group_members.group_id
      AND public.is_team_member(g.team_id)
  ));

CREATE POLICY "Managers can add group members"
  ON public.team_group_members FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.team_groups g
    WHERE g.id = team_group_members.group_id
      AND public.can_manage_team_groups(g.team_id)
  ));

CREATE POLICY "Managers can remove group members"
  ON public.team_group_members FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.team_groups g
    WHERE g.id = team_group_members.group_id
      AND public.can_manage_team_groups(g.team_id)
  ));

-- 4) mention_notifications_log (server-only, used for 60s dedupe)
CREATE TABLE IF NOT EXISTS public.mention_notifications_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid NOT NULL,
  message_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  channel text NOT NULL,  -- 'email' or 'slack'
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mention_notif_dedupe_idx
  ON public.mention_notifications_log (recipient_id, conversation_id, sender_id, channel, created_at DESC);

GRANT ALL ON public.mention_notifications_log TO service_role;
ALTER TABLE public.mention_notifications_log ENABLE ROW LEVEL SECURITY;
-- no policies for authenticated/anon: only service_role (edge function) reads/writes

-- 5) updated_at trigger for team_groups
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_team_groups_updated_at ON public.team_groups;
CREATE TRIGGER update_team_groups_updated_at
  BEFORE UPDATE ON public.team_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6) handle change guard: 30-day rate limit (set handle_changed_at on update)
CREATE OR REPLACE FUNCTION public.profiles_handle_change_guard()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.handle IS DISTINCT FROM OLD.handle THEN
    IF OLD.handle_changed_at IS NOT NULL AND OLD.handle_changed_at > now() - interval '30 days' THEN
      RAISE EXCEPTION 'You can only change your handle once every 30 days.';
    END IF;
    NEW.handle_changed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_handle_change_guard_trg ON public.profiles;
CREATE TRIGGER profiles_handle_change_guard_trg
  BEFORE UPDATE OF handle ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_handle_change_guard();
