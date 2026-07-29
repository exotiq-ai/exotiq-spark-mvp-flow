CREATE UNIQUE INDEX IF NOT EXISTS booking_extensions_one_pending_per_booking
  ON public.booking_extensions (booking_id)
  WHERE status = 'pending';