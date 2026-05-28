REVOKE EXECUTE ON FUNCTION public.is_super_admin(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.super_admin_has_permission(TEXT, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_super_admin_stats() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_super_admin_customers() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_super_admin_billing_tenants() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_super_admin_audit_logs() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_admin_action(TEXT, JSONB) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_super_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_has_permission(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_super_admin_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_super_admin_customers() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_super_admin_billing_tenants() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_super_admin_audit_logs() TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_admin_action(TEXT, JSONB) TO authenticated;