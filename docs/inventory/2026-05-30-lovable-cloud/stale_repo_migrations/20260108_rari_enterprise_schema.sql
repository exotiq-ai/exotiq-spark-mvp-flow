-- ============================================================
-- RARI ENTERPRISE SCHEMA MIGRATION
-- Adds tables for advanced business intelligence features
-- Date: January 8, 2026
-- ============================================================

-- 1. Vehicle Expenses Table (for P/L tracking)
CREATE TABLE IF NOT EXISTS public.vehicle_expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  team_id UUID REFERENCES public.teams(id),
  vehicle_id UUID NOT NULL, -- References vehicles table
  expense_type VARCHAR(50) NOT NULL CHECK (expense_type IN ('fuel', 'insurance', 'maintenance', 'cleaning', 'storage', 'registration', 'detailing', 'toll', 'parking', 'other')),
  amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
  description TEXT,
  vendor VARCHAR(255),
  receipt_url TEXT,
  expense_date TIMESTAMPTZ DEFAULT now(),
  recurring BOOLEAN DEFAULT false,
  recurring_interval VARCHAR(20) CHECK (recurring_interval IN ('weekly', 'monthly', 'quarterly', 'yearly')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vehicle_expenses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for vehicle_expenses
CREATE POLICY "Users can view own vehicle expenses"
  ON public.vehicle_expenses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own vehicle expenses"
  ON public.vehicle_expenses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own vehicle expenses"
  ON public.vehicle_expenses FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own vehicle expenses"
  ON public.vehicle_expenses FOR DELETE
  USING (auth.uid() = user_id);

-- Index for performance
CREATE INDEX idx_vehicle_expenses_user_id ON public.vehicle_expenses(user_id);
CREATE INDEX idx_vehicle_expenses_vehicle_id ON public.vehicle_expenses(vehicle_id);
CREATE INDEX idx_vehicle_expenses_date ON public.vehicle_expenses(expense_date);

-- 2. Rari Insights Table (Proactive AI Insights)
CREATE TABLE IF NOT EXISTS public.rari_insights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  team_id UUID REFERENCES public.teams(id),
  insight_type VARCHAR(50) NOT NULL CHECK (insight_type IN ('pricing', 'utilization', 'maintenance', 'revenue', 'customer', 'demand', 'compliance', 'opportunity')),
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  action_items JSONB DEFAULT '[]'::jsonb,
  related_entity_type VARCHAR(50) CHECK (related_entity_type IN ('vehicle', 'booking', 'customer', 'location', 'fleet')),
  related_entity_id UUID,
  metric_value DECIMAL(12,2), -- For tracking specific metrics
  metric_change DECIMAL(5,2), -- Percentage change
  is_read BOOLEAN DEFAULT false,
  is_dismissed BOOLEAN DEFAULT false,
  is_actioned BOOLEAN DEFAULT false,
  actioned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.rari_insights ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rari_insights
CREATE POLICY "Users can view own insights"
  ON public.rari_insights FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can create insights"
  ON public.rari_insights FOR INSERT
  WITH CHECK (true); -- Allow system to create insights

CREATE POLICY "Users can update own insights"
  ON public.rari_insights FOR UPDATE
  USING (auth.uid() = user_id);

-- Index for performance
CREATE INDEX idx_rari_insights_user_id ON public.rari_insights(user_id);
CREATE INDEX idx_rari_insights_type ON public.rari_insights(insight_type);
CREATE INDEX idx_rari_insights_priority ON public.rari_insights(priority);
CREATE INDEX idx_rari_insights_unread ON public.rari_insights(user_id, is_read) WHERE is_read = false;

-- 3. Customer Tags Table (for segmentation)
CREATE TABLE IF NOT EXISTS public.customer_tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  customer_id UUID NOT NULL, -- References customers table
  tag VARCHAR(50) NOT NULL CHECK (tag IN ('vip', 'corporate', 'repeat', 'high_value', 'at_risk', 'new', 'referral', 'influencer', 'blacklist', 'preferred')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(customer_id, tag)
);

-- Enable RLS
ALTER TABLE public.customer_tags ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customer_tags
CREATE POLICY "Users can view own customer tags"
  ON public.customer_tags FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own customer tags"
  ON public.customer_tags FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own customer tags"
  ON public.customer_tags FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own customer tags"
  ON public.customer_tags FOR DELETE
  USING (auth.uid() = user_id);

-- Index for performance
CREATE INDEX idx_customer_tags_user_id ON public.customer_tags(user_id);
CREATE INDEX idx_customer_tags_customer_id ON public.customer_tags(customer_id);
CREATE INDEX idx_customer_tags_tag ON public.customer_tags(tag);

-- 4. Lead Sources Table (for ROI tracking)
CREATE TABLE IF NOT EXISTS public.lead_sources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  team_id UUID REFERENCES public.teams(id),
  booking_id UUID, -- References bookings table
  customer_id UUID, -- References customers table
  source VARCHAR(50) NOT NULL CHECK (source IN ('turo', 'getaround', 'website', 'referral', 'instagram', 'facebook', 'google', 'direct', 'repeat', 'corporate', 'event', 'other')),
  campaign VARCHAR(100),
  referrer_name VARCHAR(255),
  referrer_customer_id UUID,
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(100),
  conversion_value DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lead_sources ENABLE ROW LEVEL SECURITY;

-- RLS Policies for lead_sources
CREATE POLICY "Users can view own lead sources"
  ON public.lead_sources FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own lead sources"
  ON public.lead_sources FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own lead sources"
  ON public.lead_sources FOR UPDATE
  USING (auth.uid() = user_id);

-- Index for performance
CREATE INDEX idx_lead_sources_user_id ON public.lead_sources(user_id);
CREATE INDEX idx_lead_sources_source ON public.lead_sources(source);
CREATE INDEX idx_lead_sources_booking_id ON public.lead_sources(booking_id);
CREATE INDEX idx_lead_sources_customer_id ON public.lead_sources(customer_id);

-- 5. Scheduled Alerts Table (for maintenance reminders, etc.)
CREATE TABLE IF NOT EXISTS public.scheduled_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  team_id UUID REFERENCES public.teams(id),
  alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('maintenance', 'insurance_expiry', 'registration', 'inspection', 'license_renewal', 'booking_reminder', 'payment_due', 'custom')),
  entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('vehicle', 'customer', 'booking', 'document')),
  entity_id UUID NOT NULL,
  trigger_date TIMESTAMPTZ,
  trigger_mileage INTEGER,
  message TEXT NOT NULL,
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  is_sent BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ,
  is_acknowledged BOOLEAN DEFAULT false,
  acknowledged_at TIMESTAMPTZ,
  recurring BOOLEAN DEFAULT false,
  recurring_interval VARCHAR(20) CHECK (recurring_interval IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scheduled_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for scheduled_alerts
CREATE POLICY "Users can view own scheduled alerts"
  ON public.scheduled_alerts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own scheduled alerts"
  ON public.scheduled_alerts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own scheduled alerts"
  ON public.scheduled_alerts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own scheduled alerts"
  ON public.scheduled_alerts FOR DELETE
  USING (auth.uid() = user_id);

-- Index for performance
CREATE INDEX idx_scheduled_alerts_user_id ON public.scheduled_alerts(user_id);
CREATE INDEX idx_scheduled_alerts_trigger_date ON public.scheduled_alerts(trigger_date);
CREATE INDEX idx_scheduled_alerts_pending ON public.scheduled_alerts(user_id, is_sent) WHERE is_sent = false;

-- 6. Rari User Preferences Table
CREATE TABLE IF NOT EXISTS public.rari_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) UNIQUE NOT NULL,
  default_location VARCHAR(50),
  preferred_metrics JSONB DEFAULT '["revenue", "utilization", "bookings"]'::jsonb,
  notification_frequency VARCHAR(20) DEFAULT 'daily' CHECK (notification_frequency IN ('realtime', 'hourly', 'daily', 'weekly', 'never')),
  voice_personality VARCHAR(20) DEFAULT 'professional' CHECK (voice_personality IN ('professional', 'casual', 'concise', 'detailed')),
  auto_insights BOOLEAN DEFAULT true,
  insight_types JSONB DEFAULT '["pricing", "utilization", "maintenance", "revenue"]'::jsonb,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  timezone VARCHAR(50) DEFAULT 'America/New_York',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rari_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rari_preferences
CREATE POLICY "Users can view own preferences"
  ON public.rari_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own preferences"
  ON public.rari_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON public.rari_preferences FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================
-- DATABASE VIEWS FOR ANALYTICS
-- ============================================================

-- Vehicle Profit/Loss View
CREATE OR REPLACE VIEW public.vehicle_profit_loss AS
SELECT 
  v.id as vehicle_id,
  v.user_id,
  v.name,
  v.make,
  v.model,
  v.year,
  v.location,
  v.current_rate,
  v.utilization,
  COALESCE(booking_revenue.total_revenue, 0) as total_revenue,
  COALESCE(expense_total.total_expenses, 0) as total_expenses,
  COALESCE(booking_revenue.total_revenue, 0) - COALESCE(expense_total.total_expenses, 0) as profit,
  CASE 
    WHEN COALESCE(booking_revenue.total_revenue, 0) > 0 
    THEN ((COALESCE(booking_revenue.total_revenue, 0) - COALESCE(expense_total.total_expenses, 0)) / COALESCE(booking_revenue.total_revenue, 0)) * 100
    ELSE 0 
  END as profit_margin_percent,
  COALESCE(booking_revenue.booking_count, 0) as booking_count
FROM public.vehicles v
LEFT JOIN (
  SELECT 
    vehicle_id,
    SUM(total_value) as total_revenue,
    COUNT(*) as booking_count
  FROM public.bookings
  WHERE status IN ('completed', 'active')
  GROUP BY vehicle_id
) booking_revenue ON v.id = booking_revenue.vehicle_id
LEFT JOIN (
  SELECT 
    vehicle_id,
    SUM(amount) as total_expenses
  FROM public.vehicle_expenses
  GROUP BY vehicle_id
) expense_total ON v.id = expense_total.vehicle_id;

-- Location Comparison View
CREATE OR REPLACE VIEW public.location_comparison AS
SELECT 
  v.location,
  v.user_id,
  COUNT(DISTINCT v.id) as vehicle_count,
  COUNT(DISTINCT b.id) as booking_count,
  COALESCE(SUM(b.total_value), 0) as total_revenue,
  AVG(v.utilization) as avg_utilization,
  AVG(v.current_rate) as avg_daily_rate,
  COUNT(DISTINCT CASE WHEN v.status = 'available' THEN v.id END) as available_vehicles,
  COUNT(DISTINCT CASE WHEN v.status = 'rented' THEN v.id END) as rented_vehicles
FROM public.vehicles v
LEFT JOIN public.bookings b ON v.id = b.vehicle_id AND b.status IN ('completed', 'active', 'confirmed')
GROUP BY v.location, v.user_id;

-- Customer RFM Scoring View
CREATE OR REPLACE VIEW public.customer_rfm AS
SELECT 
  c.id as customer_id,
  c.user_id,
  c.full_name,
  c.email,
  c.customer_status,
  COUNT(b.id) as frequency,
  COALESCE(SUM(b.total_value), 0) as monetary,
  MAX(b.created_at) as last_booking,
  EXTRACT(DAY FROM NOW() - MAX(b.created_at)) as days_since_last_booking,
  CASE 
    WHEN EXTRACT(DAY FROM NOW() - MAX(b.created_at)) < 30 THEN 'active'
    WHEN EXTRACT(DAY FROM NOW() - MAX(b.created_at)) < 90 THEN 'warm'
    WHEN EXTRACT(DAY FROM NOW() - MAX(b.created_at)) < 180 THEN 'cooling'
    WHEN COUNT(b.id) > 0 THEN 'at_risk'
    ELSE 'new'
  END as engagement_status,
  CASE 
    WHEN COALESCE(SUM(b.total_value), 0) >= 50000 OR COUNT(b.id) >= 10 THEN 'vip'
    WHEN COALESCE(SUM(b.total_value), 0) >= 20000 OR COUNT(b.id) >= 5 THEN 'high_value'
    WHEN COALESCE(SUM(b.total_value), 0) >= 5000 OR COUNT(b.id) >= 2 THEN 'regular'
    ELSE 'new'
  END as value_segment
FROM public.customers c
LEFT JOIN public.bookings b ON c.id = b.customer_id
GROUP BY c.id;

-- ============================================================
-- ENABLE REALTIME FOR NEW TABLES
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.rari_insights;
ALTER PUBLICATION supabase_realtime ADD TABLE public.scheduled_alerts;

-- Set REPLICA IDENTITY for realtime updates
ALTER TABLE public.rari_insights REPLICA IDENTITY FULL;
ALTER TABLE public.scheduled_alerts REPLICA IDENTITY FULL;

-- ============================================================
-- FUNCTIONS FOR INSIGHT GENERATION
-- ============================================================

-- Function to mark insight as read
CREATE OR REPLACE FUNCTION public.mark_insight_read(insight_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.rari_insights
  SET is_read = true
  WHERE id = insight_id AND user_id = auth.uid();
END;
$$;

-- Function to dismiss insight
CREATE OR REPLACE FUNCTION public.dismiss_insight(insight_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.rari_insights
  SET is_dismissed = true
  WHERE id = insight_id AND user_id = auth.uid();
END;
$$;

-- Function to mark insight as actioned
CREATE OR REPLACE FUNCTION public.action_insight(insight_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.rari_insights
  SET is_actioned = true, actioned_at = now()
  WHERE id = insight_id AND user_id = auth.uid();
END;
$$;

-- Function to get unread insight count
CREATE OR REPLACE FUNCTION public.get_unread_insight_count()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  count_result INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO count_result
  FROM public.rari_insights
  WHERE user_id = auth.uid() 
    AND is_read = false 
    AND is_dismissed = false
    AND (expires_at IS NULL OR expires_at > now());
  
  RETURN count_result;
END;
$$;

-- ============================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================

COMMENT ON TABLE public.vehicle_expenses IS 'Tracks all expenses associated with vehicles for P/L analysis';
COMMENT ON TABLE public.rari_insights IS 'AI-generated proactive insights for fleet optimization';
COMMENT ON TABLE public.customer_tags IS 'Customer segmentation tags for targeted marketing';
COMMENT ON TABLE public.lead_sources IS 'Tracks booking sources for ROI analysis';
COMMENT ON TABLE public.scheduled_alerts IS 'Scheduled alerts for maintenance, renewals, etc.';
COMMENT ON TABLE public.rari_preferences IS 'User preferences for Rari AI assistant behavior';

COMMENT ON VIEW public.vehicle_profit_loss IS 'Real-time vehicle profit/loss calculations';
COMMENT ON VIEW public.location_comparison IS 'Location-wise fleet performance comparison';
COMMENT ON VIEW public.customer_rfm IS 'Customer RFM (Recency, Frequency, Monetary) analysis';
