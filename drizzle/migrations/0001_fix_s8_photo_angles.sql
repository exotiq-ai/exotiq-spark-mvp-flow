-- The S8's 'front_quarter' photo is actually a head-on portrait collage;
-- the true 45° shot was mislabeled 'unknown'. Correct both so the studio
-- hero picker (and marketplace readiness) use the right source.
UPDATE public.vehicle_photos
SET detected_angle = 'front'
WHERE id = '01fbda89-b8b4-4f67-b769-b8b963f38bb2';

UPDATE public.vehicle_photos
SET detected_angle = 'front_quarter'
WHERE id = '93c0fada-921c-48de-a1bb-59d55e00537f';