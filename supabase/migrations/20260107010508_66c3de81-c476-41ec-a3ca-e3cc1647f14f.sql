-- Add new columns to profiles table for enhanced business information
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS website text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS business_address jsonb;
-- Structure: { street, city, state, zip, country, formatted, lat, lng }

-- Add number_of_locations column to track expected locations
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS number_of_locations integer DEFAULT 1;

-- Create index on business_address for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_business_address ON public.profiles USING gin(business_address);

-- Note: The locations table already exists in the schema, so we don't need to create it
-- We just need to ensure it has proper RLS policies for onboarding

-- Create policy for users to insert their own locations during onboarding
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'locations' 
    AND policyname = 'Users can insert locations for their team'
  ) THEN
    CREATE POLICY "Users can insert locations for their team"
      ON public.locations FOR INSERT
      WITH CHECK (
        team_id IN (
          SELECT tm.team_id FROM team_members tm WHERE tm.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Create policy for users to view their team's locations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'locations' 
    AND policyname = 'Users can view locations for their team'
  ) THEN
    CREATE POLICY "Users can view locations for their team"
      ON public.locations FOR SELECT
      USING (
        team_id IN (
          SELECT tm.team_id FROM team_members tm WHERE tm.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Create policy for users to update their team's locations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'locations' 
    AND policyname = 'Users can update locations for their team'
  ) THEN
    CREATE POLICY "Users can update locations for their team"
      ON public.locations FOR UPDATE
      USING (
        team_id IN (
          SELECT tm.team_id FROM team_members tm WHERE tm.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Create policy for users to delete their team's locations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'locations' 
    AND policyname = 'Users can delete locations for their team'
  ) THEN
    CREATE POLICY "Users can delete locations for their team"
      ON public.locations FOR DELETE
      USING (
        team_id IN (
          SELECT tm.team_id FROM team_members tm WHERE tm.user_id = auth.uid()
        )
      );
  END IF;
END $$;