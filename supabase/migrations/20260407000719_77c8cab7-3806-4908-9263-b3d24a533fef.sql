-- 1. demand_intelligence_cache: drop redundant service_role policy (service role bypasses RLS anyway)
DROP POLICY IF EXISTS "Service role can manage cache" ON demand_intelligence_cache;

-- 2. rari_insights: drop overly permissive INSERT (no TO clause = PUBLIC), add user-scoped INSERT + SELECT
DROP POLICY IF EXISTS "Service role can insert insights" ON rari_insights;

CREATE POLICY "Users can insert own insights"
ON rari_insights FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own insights"
ON rari_insights FOR SELECT TO authenticated
USING (auth.uid() = user_id);