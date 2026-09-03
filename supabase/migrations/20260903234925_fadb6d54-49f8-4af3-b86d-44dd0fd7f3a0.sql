CREATE OR REPLACE FUNCTION public._tmp_m7f_rollback_test()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  r jsonb := '{}'::jsonb;
  v_owner uuid;
  v_team uuid;
  v_veh uuid;
BEGIN
  BEGIN
    SELECT owner_id INTO v_owner FROM public.teams WHERE slug = 'exotiq';

    INSERT INTO public.teams (name, slug, owner_id, marketplace_listed, marketplace_visible,
                              marketplace_request_status, is_demo_account, is_deleted, timezone, currency,
                              platform_fee_percent, platform_fee_confirmed_at)
    VALUES ('ZZ Test Marketplace', 'zz-test-marketplace', v_owner, true, true,
            'approved', false, false, 'America/Phoenix', 'USD', 20, now())
    RETURNING id INTO v_team;

    INSERT INTO public.vehicles (name, make, model, year, user_id, team_id, slug, status,
                                 current_rate, marketplace_visible, marketplace_unlisted, image_url)
    VALUES ('ZZ Test Car', 'Test', 'Car', 2024, v_owner, v_team, 'zz-test-car', 'available',
            123, true, false, 'https://example.com/zz.jpg')
    RETURNING id INTO v_veh;

    r := r || jsonb_build_object(
      't3_listed_team_present', (SELECT count(*) FROM public_marketplace_teams() WHERE slug='zz-test-marketplace'),
      't3_listed_vehicle_present', (SELECT count(*) FROM public_marketplace_fleet() WHERE team_slug='zz-test-marketplace'));

    UPDATE public.teams SET marketplace_listed = false WHERE id = v_team;
    r := r || jsonb_build_object(
      't3_unlisted_team', (SELECT count(*) FROM public_marketplace_teams() WHERE slug='zz-test-marketplace'),
      't3_unlisted_vehicle', (SELECT count(*) FROM public_marketplace_fleet() WHERE team_slug='zz-test-marketplace'));

    UPDATE public.teams SET marketplace_listed = true, marketplace_visible = false WHERE id = v_team;
    r := r || jsonb_build_object(
      't3_invisible_team', (SELECT count(*) FROM public_marketplace_teams() WHERE slug='zz-test-marketplace'),
      't3_invisible_vehicle', (SELECT count(*) FROM public_marketplace_fleet() WHERE team_slug='zz-test-marketplace'));

    UPDATE public.teams SET marketplace_visible = true WHERE id = v_team;
    UPDATE public.vehicles SET marketplace_unlisted = true WHERE id = v_veh;
    r := r || jsonb_build_object(
      't4_unlisted_vehicle_in_marketplace', (SELECT count(*) FROM public_marketplace_fleet() WHERE vehicle_slug='zz-test-car'),
      't4_unlisted_vehicle_by_slug', (SELECT count(*) FROM public_vehicle_by_slug('zz-test-marketplace','zz-test-car')),
      't4_unlisted_vehicle_in_team_fleet', (SELECT count(*) FROM public_team_fleet('zz-test-marketplace')));

    RAISE EXCEPTION 'rollback_sentinel';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'rollback_sentinel' THEN
      r := r || jsonb_build_object('error', SQLERRM);
    END IF;
  END;

  r := r || jsonb_build_object(
    'residue_team', (SELECT count(*) FROM public.teams WHERE slug='zz-test-marketplace'),
    'residue_vehicle', (SELECT count(*) FROM public.vehicles WHERE slug='zz-test-car'));
  RETURN r;
END
$fn$;

REVOKE ALL ON FUNCTION public._tmp_m7f_rollback_test() FROM PUBLIC;
REVOKE ALL ON FUNCTION public._tmp_m7f_rollback_test() FROM anon;
REVOKE ALL ON FUNCTION public._tmp_m7f_rollback_test() FROM authenticated;