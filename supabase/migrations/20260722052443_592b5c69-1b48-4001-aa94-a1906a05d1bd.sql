-- PostgREST cannot disambiguate two overloads of public_team_fleet.
-- Drop the older single-arg version; the new 2-arg version with a default
-- covers both call patterns (no args changed for existing callers).

DROP FUNCTION IF EXISTS public.public_team_fleet(text);