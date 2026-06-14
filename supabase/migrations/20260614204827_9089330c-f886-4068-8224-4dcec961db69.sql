
REVOKE EXECUTE ON FUNCTION public.log_pii_read(text, uuid, text[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_customer_full(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_document(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_inspection_photo_meta(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_rari_message(uuid) FROM anon;
