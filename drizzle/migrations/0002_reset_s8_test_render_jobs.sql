-- Remove the 3 test render jobs for the Exotiq team Audi S8 created during
-- pipeline verification, so the vehicle is not stuck in escalated state.
DELETE FROM public.hero_render_jobs
WHERE vehicle_id = '97178246-f4af-4aed-83a0-667b98407cb2';