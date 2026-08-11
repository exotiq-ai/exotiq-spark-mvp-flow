DELETE FROM public.bookings WHERE customer_name IN ('CSV Past Renter','E2E QA Renter');
DELETE FROM public.customers WHERE email = 'csvpast@example.com';