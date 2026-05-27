
REVOKE EXECUTE ON FUNCTION public.set_billing_dunning_stage(UUID, TEXT, TEXT, INTEGER, BOOLEAN, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.clear_billing_dunning(UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.auto_clear_billing_dunning_for_email(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_billing_dunning_stage(UUID, TEXT, TEXT, INTEGER, BOOLEAN, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_billing_dunning(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auto_clear_billing_dunning_for_email(TEXT) TO service_role;
