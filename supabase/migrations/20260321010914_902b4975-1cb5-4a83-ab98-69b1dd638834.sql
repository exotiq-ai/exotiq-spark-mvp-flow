ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS google_calendar_event_id TEXT;

-- Add unique constraint on team_integrations for upsert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'team_integrations_team_id_integration_type_key'
  ) THEN
    ALTER TABLE public.team_integrations ADD CONSTRAINT team_integrations_team_id_integration_type_key UNIQUE (team_id, integration_type);
  END IF;
END $$;