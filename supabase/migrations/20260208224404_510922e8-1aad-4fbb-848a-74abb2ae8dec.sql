
-- Update notify_new_booking to notify all team members
CREATE OR REPLACE FUNCTION public.notify_new_booking()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  member_id UUID;
BEGIN
  IF NEW.team_id IS NOT NULL THEN
    FOR member_id IN
      SELECT user_id FROM team_members WHERE team_id = NEW.team_id AND is_active = true
    LOOP
      INSERT INTO public.notifications (user_id, type, title, message, data)
      VALUES (
        member_id,
        'booking',
        'New Booking Created',
        'Booking for ' || NEW.customer_name || ' has been created',
        jsonb_build_object('booking_id', NEW.id, 'vehicle_id', NEW.vehicle_id, 'customer_name', NEW.customer_name)
      );
    END LOOP;
  ELSE
    INSERT INTO public.notifications (user_id, type, title, message, data)
    VALUES (
      NEW.user_id,
      'booking',
      'New Booking Created',
      'Booking for ' || NEW.customer_name || ' has been created',
      jsonb_build_object('booking_id', NEW.id, 'vehicle_id', NEW.vehicle_id, 'customer_name', NEW.customer_name)
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- Update notify_booking_status_change to notify all team members
CREATE OR REPLACE FUNCTION public.notify_booking_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  member_id UUID;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.team_id IS NOT NULL THEN
      FOR member_id IN
        SELECT user_id FROM team_members WHERE team_id = NEW.team_id AND is_active = true
      LOOP
        INSERT INTO public.notifications (user_id, type, title, message, data)
        VALUES (
          member_id,
          'booking_update',
          'Booking Status Updated',
          'Booking for ' || NEW.customer_name || ' is now ' || NEW.status,
          jsonb_build_object('booking_id', NEW.id, 'old_status', OLD.status, 'new_status', NEW.status)
        );
      END LOOP;
    ELSE
      INSERT INTO public.notifications (user_id, type, title, message, data)
      VALUES (
        NEW.user_id,
        'booking_update',
        'Booking Status Updated',
        'Booking for ' || NEW.customer_name || ' is now ' || NEW.status,
        jsonb_build_object('booking_id', NEW.id, 'old_status', OLD.status, 'new_status', NEW.status)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Update notify_new_payment to notify all team members
CREATE OR REPLACE FUNCTION public.notify_new_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  booking_record RECORD;
  member_id UUID;
BEGIN
  SELECT customer_name, team_id INTO booking_record FROM public.bookings WHERE id = NEW.booking_id;

  IF booking_record.team_id IS NOT NULL THEN
    FOR member_id IN
      SELECT user_id FROM team_members WHERE team_id = booking_record.team_id AND is_active = true
    LOOP
      INSERT INTO public.notifications (user_id, type, title, message, data)
      VALUES (
        member_id,
        'payment',
        'Payment Received',
        'Payment of $' || NEW.amount || ' received from ' || COALESCE(booking_record.customer_name, 'customer'),
        jsonb_build_object('payment_id', NEW.id, 'booking_id', NEW.booking_id, 'amount', NEW.amount)
      );
    END LOOP;
  ELSE
    INSERT INTO public.notifications (user_id, type, title, message, data)
    VALUES (
      NEW.user_id,
      'payment',
      'Payment Received',
      'Payment of $' || NEW.amount || ' received from ' || COALESCE(booking_record.customer_name, 'customer'),
      jsonb_build_object('payment_id', NEW.id, 'booking_id', NEW.booking_id, 'amount', NEW.amount)
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- Update notify_new_damage_claim to notify all team members
CREATE OR REPLACE FUNCTION public.notify_new_damage_claim()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  member_id UUID;
BEGIN
  IF NEW.team_id IS NOT NULL THEN
    FOR member_id IN
      SELECT user_id FROM team_members WHERE team_id = NEW.team_id AND is_active = true
    LOOP
      INSERT INTO public.notifications (user_id, type, title, message, data)
      VALUES (
        member_id,
        'damage',
        'New Damage Report',
        'A ' || NEW.severity || ' severity damage has been reported',
        jsonb_build_object('claim_id', NEW.id, 'vehicle_id', NEW.vehicle_id, 'severity', NEW.severity)
      );
    END LOOP;
  ELSE
    INSERT INTO public.notifications (user_id, type, title, message, data)
    VALUES (
      NEW.user_id,
      'damage',
      'New Damage Report',
      'A ' || NEW.severity || ' severity damage has been reported',
      jsonb_build_object('claim_id', NEW.id, 'vehicle_id', NEW.vehicle_id, 'severity', NEW.severity)
    );
  END IF;
  RETURN NEW;
END;
$function$;
