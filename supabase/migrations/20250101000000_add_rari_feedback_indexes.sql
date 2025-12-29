-- Add indexes for rari_feedback table to improve query performance
-- These indexes are essential for MCP server performance when logging feedback

-- Index on user_id for filtering by user
CREATE INDEX IF NOT EXISTS idx_rari_feedback_user_id 
ON public.rari_feedback(user_id);

-- Index on created_at for time-based queries and sorting
CREATE INDEX IF NOT EXISTS idx_rari_feedback_created_at 
ON public.rari_feedback(created_at DESC);

-- Index on feedback_type for filtering by type
CREATE INDEX IF NOT EXISTS idx_rari_feedback_type 
ON public.rari_feedback(feedback_type);

-- Composite index for common query pattern: user + type + date
CREATE INDEX IF NOT EXISTS idx_rari_feedback_user_type_created 
ON public.rari_feedback(user_id, feedback_type, created_at DESC);

-- Index on resolved status for filtering unresolved feedback
CREATE INDEX IF NOT EXISTS idx_rari_feedback_resolved 
ON public.rari_feedback(resolved) 
WHERE resolved = false;
