CREATE OR REPLACE FUNCTION public.fn_transition_payout(
  p_payout_id uuid,
  p_action text,
  p_paid_at timestamptz DEFAULT NULL,
  p_reference text DEFAULT NULL,
  p_method text DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS public.partner_payouts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.partner_payouts;
  v_is_manager boolean;
  v_is_admin boolean;
BEGIN
  SELECT * INTO v_row FROM public.partner_payouts WHERE id = p_payout_id;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Payout not found';
  END IF;

  -- Authorization: must be an active team member with the right role
  IF NOT public.is_team_member_of_record(auth.uid(), v_row.team_id) THEN
    RAISE EXCEPTION 'Not authorized for this team';
  END IF;

  v_is_admin := public.has_role(auth.uid(), 'owner'::app_role)
             OR public.has_role(auth.uid(), 'admin'::app_role);
  v_is_manager := v_is_admin OR public.has_role(auth.uid(), 'manager'::app_role);

  IF NOT v_is_manager THEN
    RAISE EXCEPTION 'Manager role or higher required';
  END IF;

  IF p_action = 'mark_paid' THEN
    IF v_row.status NOT IN ('pending', 'scheduled') THEN
      RAISE EXCEPTION 'Only pending payouts can be marked paid (current: %)', v_row.status;
    END IF;
    UPDATE public.partner_payouts
    SET status = 'paid',
        paid_at = COALESCE(p_paid_at, now()),
        payout_reference = p_reference,
        payout_method = p_method,
        void_reason = NULL,
        voided_at = NULL,
        updated_at = now()
    WHERE id = p_payout_id
    RETURNING * INTO v_row;

  ELSIF p_action = 'void' THEN
    IF v_row.status = 'voided' THEN
      RAISE EXCEPTION 'Payout is already voided';
    END IF;
    IF COALESCE(btrim(p_reason), '') = '' THEN
      RAISE EXCEPTION 'A reason is required to void a payout';
    END IF;
    UPDATE public.partner_payouts
    SET status = 'voided',
        voided_at = now(),
        void_reason = p_reason,
        updated_at = now()
    WHERE id = p_payout_id
    RETURNING * INTO v_row;

  ELSIF p_action = 'reopen' THEN
    IF NOT v_is_admin THEN
      RAISE EXCEPTION 'Only Owners or Admins can re-open a payout';
    END IF;
    IF v_row.status <> 'voided' THEN
      RAISE EXCEPTION 'Only voided payouts can be re-opened (current: %)', v_row.status;
    END IF;
    UPDATE public.partner_payouts
    SET status = 'pending',
        voided_at = NULL,
        void_reason = NULL,
        paid_at = NULL,
        payout_reference = NULL,
        payout_method = NULL,
        updated_at = now()
    WHERE id = p_payout_id
    RETURNING * INTO v_row;

  ELSE
    RAISE EXCEPTION 'Unknown action: %', p_action;
  END IF;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_transition_payout(uuid, text, timestamptz, text, text, text) TO authenticated;