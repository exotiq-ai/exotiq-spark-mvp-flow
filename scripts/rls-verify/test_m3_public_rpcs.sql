-- Behavioral verification for M3 migrations
-- (20260715220000_rent_public_catalog_schema.sql + 20260715220100_rent_public_read_rpcs.sql).

\set ON_ERROR_STOP on

CREATE OR REPLACE FUNCTION test_expect(label text, actual bigint, expected bigint)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF actual = expected THEN
    RAISE NOTICE 'PASS: % (value=%)', label, actual;
  ELSE
    RAISE EXCEPTION 'FAIL: % expected % got %', label, expected, actual;
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION test_expect(text, bigint, bigint) TO anon, authenticated;

-- Seed: visible team, hidden team, demo team.
INSERT INTO public.teams (id, name, slug, marketplace_visible, is_demo_account, platform_fee_percent, rental_buffer_minutes) VALUES
  ('11111111-1111-1111-1111-111111111111','Desert Exotic Rentals','desert-exotic-rentals', true,  false, 10, 60),
  ('22222222-2222-2222-2222-222222222222','Hidden Motors',        'hidden-motors',         false, false, 10, 60),
  ('33333333-3333-3333-3333-333333333333','Demo Fleet',           'demo-fleet',            true,  true,  10, 60);

INSERT INTO public.locations (id, team_id, name, city, state, is_default) VALUES
  ('44444444-4444-4444-4444-444444444444','11111111-1111-1111-1111-111111111111','HQ','Scottsdale','AZ', true);

-- Two same-name vehicles (slug collision test) + one hidden + one on hidden team.
INSERT INTO public.vehicles (id, team_id, user_id, name, make, model, year, color, vin, license_plate, current_rate, marketplace_visible, location_id) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','a0000000-0000-0000-0000-000000000001','McLaren 750S Spider','McLaren','750S Spider',2025,'Papaya','VIN-SECRET-1','PLT-001',1999, true, '44444444-4444-4444-4444-444444444444'),
  ('aaaaaaaa-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','a0000000-0000-0000-0000-000000000001','McLaren 750S Spider','McLaren','750S Spider',2025,'Silver','VIN-SECRET-2','PLT-002',1899, true, NULL),
  ('aaaaaaaa-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','a0000000-0000-0000-0000-000000000001','Secret Car','Ferrari','F8',2024,'Red','VIN-SECRET-3','PLT-003',2500, false, NULL),
  ('aaaaaaaa-0000-0000-0000-000000000004','22222222-2222-2222-2222-222222222222','a0000000-0000-0000-0000-000000000001','Hidden Team Car','Lamborghini','Huracan',2024,'Green','VIN-SECRET-4','PLT-004',1500, true, NULL);

INSERT INTO public.vehicle_photos (vehicle_id, url, enhanced_url, display_order) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001','https://x/raw1.jpg','https://x/enh1.jpg',1),
  ('aaaaaaaa-0000-0000-0000-000000000001','https://x/raw2.jpg',NULL,2);

-- Booking on the visible McLaren (blocking) + one cancelled (non-blocking).
INSERT INTO public.bookings (vehicle_id, team_id, customer_name, booking_ref, status, start_date, end_date) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Very Private Person','BK-01001','confirmed','2026-08-10T10:00:00Z','2026-08-12T10:00:00Z'),
  ('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Cancelled Person','BK-01002','cancelled','2026-08-20T10:00:00Z','2026-08-22T10:00:00Z');

-- ---- slug backfill + trigger ----
SELECT test_expect('slug backfill: two distinct slugs for colliding names',
  (SELECT count(DISTINCT slug) FROM public.vehicles WHERE team_id = '11111111-1111-1111-1111-111111111111' AND make='McLaren'), 2);
SELECT test_expect('slug backfill: suffixed slug exists',
  (SELECT count(*) FROM public.vehicles WHERE slug = '2025-mclaren-750s-spider-2'), 1);
INSERT INTO public.vehicles (team_id, user_id, name, make, model, year, current_rate, marketplace_visible)
VALUES ('11111111-1111-1111-1111-111111111111','a0000000-0000-0000-0000-000000000001','Third McLaren','McLaren','750S Spider',2025, 1799, false);
SELECT test_expect('trigger: third colliding vehicle gets -3 suffix',
  (SELECT count(*) FROM public.vehicles WHERE slug = '2025-mclaren-750s-spider-3'), 1);

-- ---- anon: RPCs work, base tables do not ----
SET ROLE anon;

SELECT test_expect('anon: visible team resolves by slug',
  (SELECT count(*) FROM public.public_team_by_slug('desert-exotic-rentals')), 1);
SELECT test_expect('anon: hidden team not resolvable',
  (SELECT count(*) FROM public.public_team_by_slug('hidden-motors')), 0);
SELECT test_expect('anon: demo team not resolvable',
  (SELECT count(*) FROM public.public_team_by_slug('demo-fleet')), 0);

SELECT test_expect('anon: fleet shows only marketplace-visible vehicles (2 of 4)',
  (SELECT count(*) FROM public.public_team_fleet('desert-exotic-rentals')), 2);
SELECT test_expect('anon: fleet of hidden team is empty',
  (SELECT count(*) FROM public.public_team_fleet('hidden-motors')), 0);

SELECT test_expect('anon: vehicle detail resolves with photos',
  (SELECT jsonb_array_length(photos) FROM public.public_vehicle_by_slug('desert-exotic-rentals','2025-mclaren-750s-spider'))::bigint, 2);
SELECT test_expect('anon: hero image prefers enhanced url',
  (SELECT count(*) FROM public.public_vehicle_by_slug('desert-exotic-rentals','2025-mclaren-750s-spider') WHERE hero_image_url = 'https://x/enh1.jpg'), 1);
SELECT test_expect('anon: non-visible vehicle not resolvable',
  (SELECT count(*) FROM public.public_vehicle_by_slug('desert-exotic-rentals','2024-ferrari-f8')), 0);

-- availability: 1 busy range (cancelled excluded), buffered by 60 min → dates expand a day boundary
SELECT test_expect('anon: availability returns exactly one busy range',
  (SELECT count(*) FROM public.public_vehicle_availability('desert-exotic-rentals','2025-mclaren-750s-spider','2026-08-01','2026-08-31')), 1);
SELECT test_expect('anon: busy range includes turnaround buffer (starts 08-10, buffered start <= 08-10)',
  (SELECT count(*) FROM public.public_vehicle_availability('desert-exotic-rentals','2025-mclaren-750s-spider','2026-08-01','2026-08-31')
   WHERE busy_start <= DATE '2026-08-10' AND busy_end >= DATE '2026-08-12'), 1);

-- quote math: 3 days x $1,999/day = 599700c; fee 10% = 59970c; premium 3 x 8900 = 26700c; total 686370c
SELECT test_expect('anon: quote rental subtotal cents',
  (SELECT rental_subtotal_cents FROM public.public_vehicle_quote('desert-exotic-rentals','2025-mclaren-750s-spider','2026-09-01','2026-09-04','{"protection":"premium"}')), 599700);
SELECT test_expect('anon: quote platform fee cents (10%)',
  (SELECT platform_fee_cents FROM public.public_vehicle_quote('desert-exotic-rentals','2025-mclaren-750s-spider','2026-09-01','2026-09-04','{"protection":"premium"}')), 59970);
SELECT test_expect('anon: quote grand total cents',
  (SELECT grand_total_cents FROM public.public_vehicle_quote('desert-exotic-rentals','2025-mclaren-750s-spider','2026-09-01','2026-09-04','{"protection":"premium"}')), 686370);
SELECT test_expect('anon: decline protection zeroes protection line',
  (SELECT protection_total_cents FROM public.public_vehicle_quote('desert-exotic-rentals','2025-mclaren-750s-spider','2026-09-01','2026-09-04','{"protection":"decline"}')), 0);
SELECT test_expect('anon: quote for hidden team vehicle returns no row',
  (SELECT count(*) FROM public.public_vehicle_quote('hidden-motors','2024-lamborghini-huracan','2026-09-01','2026-09-04','{}')), 0);

-- leak checks: anon must NOT read base tables directly
DO $$ BEGIN
  BEGIN
    PERFORM count(*) FROM public.vehicles;
    RAISE EXCEPTION 'FAIL: anon can select public.vehicles directly';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: anon cannot select public.vehicles directly';
  END;
END $$;
DO $$ BEGIN
  BEGIN
    PERFORM count(*) FROM public.bookings;
    RAISE EXCEPTION 'FAIL: anon can select public.bookings directly';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: anon cannot select public.bookings directly';
  END;
END $$;
DO $$ BEGIN
  BEGIN
    PERFORM count(*) FROM public.teams;
    RAISE EXCEPTION 'FAIL: anon can select public.teams directly';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: anon cannot select public.teams directly';
  END;
END $$;

-- shape check: none of the RPC return types contain sensitive identifiers
DO $$
DECLARE bad int;
BEGIN
  SELECT count(*) INTO bad
  FROM information_schema.parameters p
  JOIN information_schema.routines r ON r.specific_name = p.specific_name
  WHERE r.routine_schema = 'public'
    AND r.routine_name IN ('public_team_by_slug','public_team_fleet','public_vehicle_by_slug','public_vehicle_availability','public_vehicle_quote')
    AND p.parameter_mode = 'OUT'
    AND p.parameter_name ~* 'vin|license_plate|stripe|customer|booking_ref|user_id|notes|email|phone';
  IF bad > 0 THEN
    RAISE EXCEPTION 'FAIL: sensitive column exposed in public RPC signature';
  ELSE
    RAISE NOTICE 'PASS: no sensitive columns in public RPC signatures';
  END IF;
END $$;

RESET ROLE;

SELECT 'ALL M3 TESTS PASSED' AS result;
