
ALTER TABLE public.data_subject_requests
  ADD COLUMN IF NOT EXISTS preview_counts jsonb,
  ADD COLUMN IF NOT EXISTS executed_at timestamptz,
  ADD COLUMN IF NOT EXISTS receipt_id uuid;
