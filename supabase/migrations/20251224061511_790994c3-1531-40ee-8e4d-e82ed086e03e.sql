-- Create notifications table for real-time user notifications
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  data JSONB DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
ON public.notifications FOR DELETE
USING (auth.uid() = user_id);

-- Allow system to insert notifications (via triggers with SECURITY DEFINER)
CREATE POLICY "System can insert notifications"
ON public.notifications FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Function to create notification on new booking
CREATE OR REPLACE FUNCTION public.notify_new_booking()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, data)
  VALUES (
    NEW.user_id,
    'booking',
    'New Booking Created',
    'Booking for ' || NEW.customer_name || ' has been created',
    jsonb_build_object('booking_id', NEW.id, 'vehicle_id', NEW.vehicle_id, 'customer_name', NEW.customer_name)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to create notification on booking status change
CREATE OR REPLACE FUNCTION public.notify_booking_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.notifications (user_id, type, title, message, data)
    VALUES (
      NEW.user_id,
      'booking_update',
      'Booking Status Updated',
      'Booking for ' || NEW.customer_name || ' is now ' || NEW.status,
      jsonb_build_object('booking_id', NEW.id, 'old_status', OLD.status, 'new_status', NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to create notification on new payment
CREATE OR REPLACE FUNCTION public.notify_new_payment()
RETURNS TRIGGER AS $$
DECLARE
  booking_record RECORD;
BEGIN
  SELECT customer_name INTO booking_record FROM public.bookings WHERE id = NEW.booking_id;
  
  INSERT INTO public.notifications (user_id, type, title, message, data)
  VALUES (
    NEW.user_id,
    'payment',
    'Payment Received',
    'Payment of $' || NEW.amount || ' received from ' || COALESCE(booking_record.customer_name, 'customer'),
    jsonb_build_object('payment_id', NEW.id, 'booking_id', NEW.booking_id, 'amount', NEW.amount)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to create notification on new damage claim
CREATE OR REPLACE FUNCTION public.notify_new_damage_claim()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, data)
  VALUES (
    NEW.user_id,
    'damage',
    'New Damage Report',
    'A ' || NEW.severity || ' severity damage has been reported',
    jsonb_build_object('claim_id', NEW.id, 'vehicle_id', NEW.vehicle_id, 'severity', NEW.severity)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create triggers
CREATE TRIGGER on_new_booking_notify
  AFTER INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_booking();

CREATE TRIGGER on_booking_status_change_notify
  AFTER UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_booking_status_change();

CREATE TRIGGER on_new_payment_notify
  AFTER INSERT ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_payment();

CREATE TRIGGER on_new_damage_claim_notify
  AFTER INSERT ON public.damage_claims
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_damage_claim();