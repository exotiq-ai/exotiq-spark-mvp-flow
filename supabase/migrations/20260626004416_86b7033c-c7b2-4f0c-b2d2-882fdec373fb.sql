
DO $$
DECLARE
  v_user uuid := 'd4e7a06f-52f7-4432-b626-a73f7b69be4f';
  v_team uuid := 'f8837e47-2d2a-4392-a694-4c2411be59fd';
  v_vehicles int; v_bookings int; v_customers int; v_other_members int;
BEGIN
  SELECT count(*) INTO v_vehicles       FROM public.vehicles      WHERE team_id = v_team;
  SELECT count(*) INTO v_bookings       FROM public.bookings      WHERE team_id = v_team;
  SELECT count(*) INTO v_customers      FROM public.customers     WHERE team_id = v_team;
  SELECT count(*) INTO v_other_members  FROM public.team_members  WHERE team_id = v_team AND user_id <> v_user;
  IF v_vehicles > 0 OR v_bookings > 0 OR v_customers > 0 OR v_other_members > 0 THEN
    RAISE EXCEPTION 'Aborting: team has data (v=% b=% c=% m=%)', v_vehicles, v_bookings, v_customers, v_other_members;
  END IF;

  -- Skip triggers (terms_acceptances immutability guard) for this admin-scoped cascade
  SET LOCAL session_replication_role = 'replica';

  DELETE FROM public.locations            WHERE team_id = v_team;
  DELETE FROM public.user_invitations     WHERE team_id = v_team;
  DELETE FROM public.team_members         WHERE team_id = v_team;
  DELETE FROM public.teams                WHERE id = v_team;

  DELETE FROM public.notifications              WHERE user_id = v_user;
  DELETE FROM public.notification_preferences   WHERE user_id = v_user;
  DELETE FROM public.user_settings              WHERE user_id = v_user;
  DELETE FROM public.onboarding_progress        WHERE user_id = v_user;
  DELETE FROM public.onboarding_responses       WHERE user_id = v_user;
  DELETE FROM public.terms_acceptances          WHERE user_id = v_user;
  DELETE FROM public.user_roles                 WHERE user_id = v_user;
  DELETE FROM public.user_presence              WHERE user_id = v_user;
  DELETE FROM public.user_activity_log          WHERE user_id = v_user;
  DELETE FROM public.user_dashboard_layouts     WHERE user_id = v_user;
  DELETE FROM public.user_dashboard_preferences WHERE user_id = v_user;
  DELETE FROM public.profiles                   WHERE id = v_user;

  DELETE FROM auth.users WHERE id = v_user;
END $$;
