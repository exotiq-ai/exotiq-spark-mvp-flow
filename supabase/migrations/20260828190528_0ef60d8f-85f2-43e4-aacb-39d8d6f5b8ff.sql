CREATE OR REPLACE FUNCTION public.get_super_admin_marketplace_revenue(
  _from timestamptz DEFAULT (now() - interval '30 days'),
  _to timestamptz DEFAULT now()
)
RETURNS TABLE (
  team_id uuid,
  team_name text,
  is_demo boolean,
  paid_bookings bigint,
  gross_volume numeric,
  exotiq_revenue numeric,
  platform_fee numeric,
  protection_fee numeric,
  state_fee numeric,
  processing_fee numeric,
  uncollected_fees numeric,
  uncollected_bookings bigint,
  zero_fee_paid_bookings bigint,
  refunded_volume numeric,
  direct_bookings bigint,
  direct_volume numeric,
  marketplace_attempts bigint,
  last_paid_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  PERFORM public.log_admin_action(
    'view_marketplace_revenue',
    jsonb_build_object('from', _from, 'to', _to)
  );

  RETURN QUERY
  WITH scoped AS (
    SELECT b.*
    FROM public.bookings b
    WHERE b.created_at >= _from
      AND b.created_at <= _to
      AND coalesce(b.is_historical, false) = false
  ),
  mkt AS (
    SELECT
      s.team_id,
      count(*) FILTER (WHERE s.operator_payment_intent_id IS NOT NULL) AS paid_bookings,
      coalesce(sum(s.total_value) FILTER (WHERE s.operator_payment_intent_id IS NOT NULL), 0) AS gross_volume,
      coalesce(sum(
        (coalesce(s.platform_fee_cents,0) + coalesce(s.protection_total_cents,0)
         + coalesce(s.state_fee_cents,0) + coalesce(s.processing_fee_cents,0))::numeric / 100
      ) FILTER (
        WHERE s.exotiq_payment_intent_id IS NOT NULL
          AND s.exotiq_payment_intent_id <> 'none_required'
          AND s.status <> 'refunded'
      ), 0) AS exotiq_revenue,
      coalesce(sum(coalesce(s.platform_fee_cents,0)::numeric / 100) FILTER (
        WHERE s.exotiq_payment_intent_id IS NOT NULL
          AND s.exotiq_payment_intent_id <> 'none_required'
          AND s.status <> 'refunded'
      ), 0) AS platform_fee,
      coalesce(sum(coalesce(s.protection_total_cents,0)::numeric / 100) FILTER (
        WHERE s.exotiq_payment_intent_id IS NOT NULL
          AND s.exotiq_payment_intent_id <> 'none_required'
          AND s.status <> 'refunded'
      ), 0) AS protection_fee,
      coalesce(sum(coalesce(s.state_fee_cents,0)::numeric / 100) FILTER (
        WHERE s.exotiq_payment_intent_id IS NOT NULL
          AND s.exotiq_payment_intent_id <> 'none_required'
          AND s.status <> 'refunded'
      ), 0) AS state_fee,
      coalesce(sum(coalesce(s.processing_fee_cents,0)::numeric / 100) FILTER (
        WHERE s.exotiq_payment_intent_id IS NOT NULL
          AND s.exotiq_payment_intent_id <> 'none_required'
          AND s.status <> 'refunded'
      ), 0) AS processing_fee,
      coalesce(sum(
        (coalesce(s.platform_fee_cents,0) + coalesce(s.protection_total_cents,0)
         + coalesce(s.state_fee_cents,0) + coalesce(s.processing_fee_cents,0))::numeric / 100
      ) FILTER (
        WHERE s.operator_payment_intent_id IS NOT NULL
          AND (s.exotiq_payment_intent_id IS NULL OR s.exotiq_payment_intent_id = 'none_required')
          AND (coalesce(s.platform_fee_cents,0) + coalesce(s.protection_total_cents,0)
               + coalesce(s.state_fee_cents,0) + coalesce(s.processing_fee_cents,0)) > 0
      ), 0) AS uncollected_fees,
      count(*) FILTER (
        WHERE s.operator_payment_intent_id IS NOT NULL
          AND (s.exotiq_payment_intent_id IS NULL OR s.exotiq_payment_intent_id = 'none_required')
          AND (coalesce(s.platform_fee_cents,0) + coalesce(s.protection_total_cents,0)
               + coalesce(s.state_fee_cents,0) + coalesce(s.processing_fee_cents,0)) > 0
      ) AS uncollected_bookings,
      count(*) FILTER (
        WHERE s.operator_payment_intent_id IS NOT NULL
          AND (coalesce(s.platform_fee_cents,0) + coalesce(s.protection_total_cents,0)
               + coalesce(s.state_fee_cents,0) + coalesce(s.processing_fee_cents,0)) = 0
      ) AS zero_fee_paid_bookings,
      coalesce(sum(s.total_value) FILTER (WHERE s.status = 'refunded'), 0) AS refunded_volume,
      count(*) AS marketplace_attempts,
      max(s.paid_at) AS last_paid_at
    FROM scoped s
    WHERE s.booking_source = 'marketplace'
    GROUP BY s.team_id
  ),
  dir AS (
    SELECT
      s.team_id,
      count(*) AS direct_bookings,
      coalesce(sum(s.total_value), 0) AS direct_volume
    FROM scoped s
    WHERE coalesce(s.booking_source, 'direct') <> 'marketplace'
      AND s.status NOT IN ('cancelled', 'declined')
    GROUP BY s.team_id
  )
  SELECT
    t.id,
    t.name,
    coalesce(t.is_demo_account, false),
    coalesce(m.paid_bookings, 0),
    coalesce(m.gross_volume, 0),
    coalesce(m.exotiq_revenue, 0),
    coalesce(m.platform_fee, 0),
    coalesce(m.protection_fee, 0),
    coalesce(m.state_fee, 0),
    coalesce(m.processing_fee, 0),
    coalesce(m.uncollected_fees, 0),
    coalesce(m.uncollected_bookings, 0),
    coalesce(m.zero_fee_paid_bookings, 0),
    coalesce(m.refunded_volume, 0),
    coalesce(d.direct_bookings, 0),
    coalesce(d.direct_volume, 0),
    coalesce(m.marketplace_attempts, 0),
    m.last_paid_at
  FROM public.teams t
  LEFT JOIN mkt m ON m.team_id = t.id
  LEFT JOIN dir d ON d.team_id = t.id
  WHERE m.team_id IS NOT NULL OR d.team_id IS NOT NULL
  ORDER BY coalesce(m.exotiq_revenue, 0) DESC, t.name ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_super_admin_marketplace_revenue(timestamptz, timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_super_admin_marketplace_bookings(
  _team_id uuid,
  _from timestamptz DEFAULT (now() - interval '30 days'),
  _to timestamptz DEFAULT now()
)
RETURNS TABLE (
  booking_id uuid,
  booking_ref text,
  team_name text,
  status text,
  created_at timestamptz,
  paid_at timestamptz,
  customer_name text,
  vehicle_name text,
  total_value numeric,
  platform_fee numeric,
  protection_fee numeric,
  state_fee numeric,
  processing_fee numeric,
  exotiq_total numeric,
  operator_payment_intent_id text,
  exotiq_payment_intent_id text,
  exotiq_leg_attempt integer,
  fee_state text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  PERFORM public.log_admin_action(
    'view_marketplace_revenue_bookings',
    jsonb_build_object('team_id', _team_id, 'from', _from, 'to', _to)
  );

  RETURN QUERY
  SELECT
    b.id,
    b.booking_ref,
    t.name,
    b.status,
    b.created_at,
    b.paid_at,
    b.customer_name,
    b.vehicle_name,
    b.total_value,
    coalesce(b.platform_fee_cents,0)::numeric / 100,
    coalesce(b.protection_total_cents,0)::numeric / 100,
    coalesce(b.state_fee_cents,0)::numeric / 100,
    coalesce(b.processing_fee_cents,0)::numeric / 100,
    (coalesce(b.platform_fee_cents,0) + coalesce(b.protection_total_cents,0)
     + coalesce(b.state_fee_cents,0) + coalesce(b.processing_fee_cents,0))::numeric / 100,
    b.operator_payment_intent_id,
    b.exotiq_payment_intent_id,
    coalesce(b.exotiq_leg_attempt, 0),
    CASE
      WHEN b.operator_payment_intent_id IS NULL THEN 'unpaid'
      WHEN b.status = 'refunded' THEN 'refunded'
      WHEN b.exotiq_payment_intent_id IS NOT NULL
        AND b.exotiq_payment_intent_id <> 'none_required' THEN 'collected'
      WHEN (coalesce(b.platform_fee_cents,0) + coalesce(b.protection_total_cents,0)
            + coalesce(b.state_fee_cents,0) + coalesce(b.processing_fee_cents,0)) = 0 THEN 'zero_fee'
      ELSE 'uncollected'
    END AS fee_state
  FROM public.bookings b
  JOIN public.teams t ON t.id = b.team_id
  WHERE b.booking_source = 'marketplace'
    AND coalesce(b.is_historical, false) = false
    AND b.created_at >= _from
    AND b.created_at <= _to
    AND (_team_id IS NULL OR b.team_id = _team_id)
  ORDER BY b.created_at DESC
  LIMIT 500;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_super_admin_marketplace_bookings(uuid, timestamptz, timestamptz) TO authenticated;