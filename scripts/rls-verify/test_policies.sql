-- Behavioral verification of 20260715211500 migration.
-- Users: alice+bob on team1 (bob manager), carol on team2, sam super admin.

\set ON_ERROR_STOP on

INSERT INTO storage.buckets (id, name, public) VALUES ('vehicle-photos','vehicle-photos', false);

INSERT INTO public.teams (id, name) VALUES
  ('11111111-1111-1111-1111-111111111111','Team One'),
  ('22222222-2222-2222-2222-222222222222','Team Two');

-- alice: a0..., bob: b0..., carol: c0..., sam: 5a...
INSERT INTO public.team_members (team_id, user_id, role, is_active) VALUES
  ('11111111-1111-1111-1111-111111111111','a0000000-0000-0000-0000-000000000001','operator', true),
  ('11111111-1111-1111-1111-111111111111','b0000000-0000-0000-0000-000000000002','manager',  true),
  ('22222222-2222-2222-2222-222222222222','c0000000-0000-0000-0000-000000000003','admin',    true);

INSERT INTO public.super_admins (user_id) VALUES ('5a000000-0000-0000-0000-00000000000a');

-- Seed one photo uploaded by alice (path convention: <user_id>/<folder>/<file>).
INSERT INTO storage.objects (bucket_id, name) VALUES
  ('vehicle-photos','a0000000-0000-0000-0000-000000000001/vehicles/car1.jpg');

INSERT INTO public.stripe_webhook_events (stripe_event_id, event_type, payload)
VALUES ('evt_test_1','payment_intent.succeeded','{"secret":"stuff"}');

CREATE OR REPLACE FUNCTION test_expect(label text, actual bigint, expected bigint)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF actual = expected THEN
    RAISE NOTICE 'PASS: % (rows=%)', label, actual;
  ELSE
    RAISE EXCEPTION 'FAIL: % expected % got %', label, expected, actual;
  END IF;
END $$;

-- ---- alice (uploader) ----
SET ROLE authenticated;
SET test.uid = 'a0000000-0000-0000-0000-000000000001';
SELECT test_expect('uploader can read own photo',
  (SELECT count(*) FROM storage.objects WHERE bucket_id='vehicle-photos'), 1);
SELECT test_expect('uploader cannot read stripe_webhook_events',
  (SELECT count(*) FROM public.stripe_webhook_events), 0);
RESET ROLE;

-- ---- bob (same-team manager) ----
SET ROLE authenticated;
SET test.uid = 'b0000000-0000-0000-0000-000000000002';
SELECT test_expect('teammate can read team photo (finding 5 fix)',
  (SELECT count(*) FROM storage.objects WHERE bucket_id='vehicle-photos'), 1);
UPDATE storage.objects SET owner = NULL WHERE bucket_id='vehicle-photos';
SELECT test_expect('manager update allowed (manage path)',
  (SELECT count(*) FROM storage.objects WHERE bucket_id='vehicle-photos'), 1);
-- bob uploads under his own folder: allowed
INSERT INTO storage.objects (bucket_id, name) VALUES
  ('vehicle-photos','b0000000-0000-0000-0000-000000000002/vehicles/car2.jpg');
SELECT test_expect('teammate sees both team photos',
  (SELECT count(*) FROM storage.objects WHERE bucket_id='vehicle-photos'), 2);
RESET ROLE;

-- ---- carol (other team) ----
SET ROLE authenticated;
SET test.uid = 'c0000000-0000-0000-0000-000000000003';
SELECT test_expect('cross-team user sees zero photos',
  (SELECT count(*) FROM storage.objects WHERE bucket_id='vehicle-photos'), 0);
SELECT test_expect('cross-team user cannot read stripe_webhook_events',
  (SELECT count(*) FROM public.stripe_webhook_events), 0);
-- carol attempts upload into alice's folder: must fail
DO $$ BEGIN
  BEGIN
    INSERT INTO storage.objects (bucket_id, name) VALUES
      ('vehicle-photos','a0000000-0000-0000-0000-000000000001/vehicles/evil.jpg');
    RAISE EXCEPTION 'FAIL: cross-team insert into foreign folder was allowed';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: cross-team insert into foreign folder denied';
  END;
END $$;
RESET ROLE;

-- ---- alice attempts to DELETE bob's photo (non-manager on manage path) ----
SET ROLE authenticated;
SET test.uid = 'a0000000-0000-0000-0000-000000000001';
DELETE FROM storage.objects WHERE name LIKE 'b0000000%';
SELECT test_expect('non-manager cannot delete teammate photo (0 deleted, still visible)',
  (SELECT count(*) FROM storage.objects WHERE bucket_id='vehicle-photos'), 2);
RESET ROLE;

-- ---- sam (super admin) ----
SET ROLE authenticated;
SET test.uid = '5a000000-0000-0000-0000-00000000000a';
SELECT test_expect('super admin can read stripe_webhook_events (finding 6 fix)',
  (SELECT count(*) FROM public.stripe_webhook_events), 1);
RESET ROLE;

SELECT 'ALL TESTS PASSED' AS result;
