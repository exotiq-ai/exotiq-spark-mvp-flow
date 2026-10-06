-- Clear the S8's verification jobs again so the final test runs fresh
-- against the calibrated QC checklist.
DELETE FROM public.hero_render_jobs
WHERE vehicle_id = '97178246-f4af-4aed-83a0-667b98407cb2';