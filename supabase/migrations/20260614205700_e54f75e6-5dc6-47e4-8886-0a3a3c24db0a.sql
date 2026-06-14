
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS eu_representative_name text,
  ADD COLUMN IF NOT EXISTS eu_representative_address text,
  ADD COLUMN IF NOT EXISTS eu_representative_email text,
  ADD COLUMN IF NOT EXISTS uk_representative_name text,
  ADD COLUMN IF NOT EXISTS uk_representative_address text,
  ADD COLUMN IF NOT EXISTS uk_representative_email text;

ALTER TABLE public.deletion_requests
  ADD COLUMN IF NOT EXISTS preview_counts jsonb,
  ADD COLUMN IF NOT EXISTS executed_at timestamptz,
  ADD COLUMN IF NOT EXISTS receipt_id uuid;
