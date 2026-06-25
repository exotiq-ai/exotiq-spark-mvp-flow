-- Phase 2: notifications index + read-only diagnostic helpers

-- 1. Composite index drives ORDER BY user_id, created_at DESC LIMIT N
--    (used by useNotifications.fetchNotifications and the realtime list).
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);

-- 2. Diagnostic helpers. Locked to service_role so they can never be hit
--    from the public API (anon/authenticated) — they exist only so we can
--    inspect rollback + table-churn snapshots from the read-query tool.
CREATE OR REPLACE FUNCTION public.lovable_rollback_snapshot()
RETURNS TABLE (
  datname text,
  xact_commit bigint,
  xact_rollback bigint,
  rollback_ratio numeric,
  captured_at timestamptz
)
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = public, pg_catalog
AS $$
  SELECT
    d.datname::text,
    d.xact_commit,
    d.xact_rollback,
    CASE WHEN (d.xact_commit + d.xact_rollback) > 0
      THEN round(d.xact_rollback::numeric / (d.xact_commit + d.xact_rollback) * 100, 3)
      ELSE 0 END AS rollback_ratio,
    now() AS captured_at
  FROM pg_stat_database d
  WHERE d.datname = current_database();
$$;

REVOKE ALL ON FUNCTION public.lovable_rollback_snapshot() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lovable_rollback_snapshot() TO service_role;

CREATE OR REPLACE FUNCTION public.lovable_table_churn_snapshot()
RETURNS TABLE (
  schemaname text,
  relname text,
  seq_scan bigint,
  idx_scan bigint,
  n_tup_ins bigint,
  n_tup_upd bigint,
  n_tup_del bigint,
  n_live_tup bigint,
  n_dead_tup bigint
)
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = public, pg_catalog
AS $$
  SELECT
    s.schemaname::text,
    s.relname::text,
    s.seq_scan, s.idx_scan,
    s.n_tup_ins, s.n_tup_upd, s.n_tup_del,
    s.n_live_tup, s.n_dead_tup
  FROM pg_stat_user_tables s
  WHERE s.schemaname = 'public'
  ORDER BY (s.n_tup_ins + s.n_tup_upd + s.n_tup_del) DESC
  LIMIT 50;
$$;

REVOKE ALL ON FUNCTION public.lovable_table_churn_snapshot() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lovable_table_churn_snapshot() TO service_role;