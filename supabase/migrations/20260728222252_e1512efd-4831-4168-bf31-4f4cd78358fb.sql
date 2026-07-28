CREATE OR REPLACE FUNCTION public.guard_marketplace_confirm_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.status = 'confirmed'
     AND NEW.booking_source = 'marketplace' THEN
    -- requested → confirmed: always blocked, must flow through approval + payment.
    IF OLD.status = 'requested' THEN
      RAISE EXCEPTION
        'Marketplace bookings cannot be confirmed directly from requested — approval must go through rent-approve-booking (→ pending_payment → payment webhook → confirmed).'
        USING ERRCODE = 'check_violation';
    END IF;
    -- pending_documents → confirmed: allowed ONLY when payment already captured
    -- (the payment-first / ID-second race handled by identity-webhook).
    IF OLD.status = 'pending_documents' AND NEW.paid_at IS NULL THEN
      RAISE EXCEPTION
        'Marketplace bookings cannot be confirmed from pending_documents without a captured payment.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;