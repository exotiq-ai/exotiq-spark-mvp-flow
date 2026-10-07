-- Exact synthetic tenant previously created by concurrency-seed.sql only.
BEGIN;
UPDATE public.teams SET stripe_test_account_id='acct_synthetic' WHERE id='a1410000-0000-4000-8000-000000000001';
UPDATE public.bookings SET status='pending_payment',payment_due_at=clock_timestamp()-interval '1 minute',payment_stripe_mode='test',rental_checkout_attempt_key='synthetic-delayed-checkout',rental_checkout_kind='legacy',rental_checkout_mode='test',rental_checkout_origin='https://customer.example.invalid',rental_checkout_created_at=clock_timestamp()-interval '1 hour',rental_checkout_expires_at=clock_timestamp()-interval '1 minute',rental_checkout_session_ref='cs_test_synthetic' WHERE team_id='a1410000-0000-4000-8000-000000000001';
COMMIT;
