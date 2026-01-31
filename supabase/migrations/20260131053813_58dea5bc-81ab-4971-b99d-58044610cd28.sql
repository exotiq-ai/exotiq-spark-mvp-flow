-- Fix function search_path security issue
CREATE OR REPLACE FUNCTION public.update_onboarding_activity()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_activity_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;