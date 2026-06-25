-- 1. Add ref column and backfill
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS ref text;

UPDATE public.notifications
SET ref = data->>'ref'
WHERE ref IS NULL AND data ? 'ref';

-- 2. Cleanup stale fleet-alert spam older than 7 days
DELETE FROM public.notifications
WHERE created_at < now() - interval '7 days'
  AND type IN ('late_return','pending_pickup','payment_overdue','maintenance_due');

-- 3. Deduplicate remaining rows (keep oldest per user/type/ref)
DELETE FROM public.notifications n
USING public.notifications keeper
WHERE n.user_id = keeper.user_id
  AND n.type = keeper.type
  AND n.ref IS NOT NULL
  AND keeper.ref IS NOT NULL
  AND n.ref = keeper.ref
  AND n.id <> keeper.id
  AND (keeper.created_at < n.created_at
       OR (keeper.created_at = n.created_at AND keeper.id < n.id));

-- 4. Unique index to enforce dedup at DB level
CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedup_user_type_ref
  ON public.notifications (user_id, type, ref)
  WHERE ref IS NOT NULL;

-- 5. Reconcile onboarding state — forward-only
UPDATE public.onboarding_progress op
SET completed_at = COALESCE(op.completed_at, now()),
    current_step = GREATEST(COALESCE(op.current_step, 1), 4),
    last_activity_at = now()
FROM public.profiles p
WHERE p.id = op.user_id
  AND p.onboarding_completed = true
  AND op.completed_at IS NULL;

UPDATE public.profiles p
SET onboarding_completed = true,
    updated_at = now()
FROM public.onboarding_progress op
WHERE op.user_id = p.id
  AND op.current_step >= 4
  AND COALESCE(p.onboarding_completed, false) = false;