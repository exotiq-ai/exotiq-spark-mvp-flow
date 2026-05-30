-- Add white-label banner customization fields to user_dashboard_preferences
-- This enables world-class company branding on the dashboard banner

ALTER TABLE user_dashboard_preferences
ADD COLUMN IF NOT EXISTS company_name TEXT,
ADD COLUMN IF NOT EXISTS company_tagline TEXT,
ADD COLUMN IF NOT EXISTS show_company_branding BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS banner_height TEXT DEFAULT 'standard' CHECK (banner_height IN ('compact', 'standard', 'showcase')),
ADD COLUMN IF NOT EXISTS banner_text_position TEXT DEFAULT 'left' CHECK (banner_text_position IN ('left', 'center')),
ADD COLUMN IF NOT EXISTS show_carbon_fiber BOOLEAN DEFAULT false;

-- Add helpful comments
COMMENT ON COLUMN user_dashboard_preferences.company_name IS 'Company name displayed on banner (e.g., "Miami Exotic Rentals")';
COMMENT ON COLUMN user_dashboard_preferences.company_tagline IS 'Company tagline/subtitle (e.g., "Luxury Redefined")';
COMMENT ON COLUMN user_dashboard_preferences.show_company_branding IS 'Show company name instead of generic welcome message';
COMMENT ON COLUMN user_dashboard_preferences.banner_height IS 'Banner height preset: compact (128px), standard (192px), showcase (256px)';
COMMENT ON COLUMN user_dashboard_preferences.banner_text_position IS 'Text alignment on banner: left or center';
COMMENT ON COLUMN user_dashboard_preferences.show_carbon_fiber IS 'Show subtle carbon fiber texture overlay';
