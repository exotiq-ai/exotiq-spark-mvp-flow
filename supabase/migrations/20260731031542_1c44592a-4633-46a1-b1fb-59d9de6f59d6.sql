-- 1. Fleet-alert dedupe: the existing unique index is PARTIAL (WHERE ref IS NOT NULL).
-- Postgres cannot infer a partial unique index from a bare ON CONFLICT (user_id, type, ref)
-- target, so every check-fleet-alerts insert failed with 42P10. Replace it with a
-- full unique index. NULL ref rows remain distinct under standard NULL semantics,
-- so behaviour for ref-less notifications is unchanged.
DROP INDEX IF EXISTS public.notifications_dedup_user_type_ref;

CREATE UNIQUE INDEX notifications_dedup_user_type_ref
  ON public.notifications (user_id, type, ref);

-- 2. Booking date-range lookups by team (dashboard, revenue analysis, Rari tools).
CREATE INDEX IF NOT EXISTS idx_bookings_team_dates
  ON public.bookings (team_id, start_date, end_date);