DELETE FROM public.user_activity_log WHERE entity_type = 'booking' AND entity_id = '3603cebe-230c-465a-af51-0c4450931e8a';
DELETE FROM public.bookings WHERE id = '3603cebe-230c-465a-af51-0c4450931e8a' AND booking_ref = 'BK-03490';
DELETE FROM public.customers WHERE email = 't10-idv-test@exotiq.ai' AND NOT EXISTS (SELECT 1 FROM public.bookings b WHERE b.customer_email = 't10-idv-test@exotiq.ai');