
DELETE FROM public.team_members
WHERE user_id NOT IN (SELECT id FROM public.profiles);

ALTER TABLE public.team_members
  ADD CONSTRAINT team_members_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
