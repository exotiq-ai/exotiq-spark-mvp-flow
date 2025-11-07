-- Fix function search path security issue
DROP TRIGGER IF EXISTS update_user_dashboard_preferences_updated_at ON public.user_dashboard_preferences;
DROP FUNCTION IF EXISTS public.update_dashboard_preferences_updated_at();

CREATE OR REPLACE FUNCTION public.update_dashboard_preferences_updated_at()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_user_dashboard_preferences_updated_at
  BEFORE UPDATE ON public.user_dashboard_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_dashboard_preferences_updated_at();