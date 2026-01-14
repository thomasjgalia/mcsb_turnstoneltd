-- ============================================================================
-- Supabase Database Setup for Medical Code Set Builder
-- ============================================================================
-- Run this SQL in your Supabase SQL Editor
-- Location: https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new
-- ============================================================================

-- Enable UUID extension (required for primary keys)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Table 1: user_preferences
-- ============================================================================
-- Stores user UI preferences and default settings
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  default_domain TEXT CHECK (default_domain IN ('Condition', 'Drug', 'Procedure', 'Measurement', 'Observation', 'Device')),
  theme TEXT CHECK (theme IN ('light', 'dark')),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE user_preferences IS 'User preferences for UI settings';
COMMENT ON COLUMN user_preferences.user_id IS 'References auth.users - one row per user';
COMMENT ON COLUMN user_preferences.default_domain IS 'Default medical domain for searches';
COMMENT ON COLUMN user_preferences.theme IS 'UI theme preference';

-- ============================================================================
-- Table 2: saved_code_sets
-- ============================================================================
-- Stores user's saved shopping carts and code sets
CREATE TABLE IF NOT EXISTS saved_code_sets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  hierarchy_concept_ids BIGINT[] NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE saved_code_sets IS 'User saved code sets (shopping cart snapshots)';
COMMENT ON COLUMN saved_code_sets.id IS 'Unique identifier for saved code set';
COMMENT ON COLUMN saved_code_sets.user_id IS 'User who created this code set';
COMMENT ON COLUMN saved_code_sets.name IS 'User-provided name for the code set';
COMMENT ON COLUMN saved_code_sets.hierarchy_concept_ids IS 'Array of OMOP concept IDs in the cart';

-- ============================================================================
-- Table 3: search_history
-- ============================================================================
-- Tracks user's recent searches for quick access
CREATE TABLE IF NOT EXISTS search_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  search_term TEXT NOT NULL,
  domain TEXT NOT NULL CHECK (domain IN ('Condition', 'Drug', 'Procedure', 'Measurement', 'Observation', 'Device')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE search_history IS 'User search history for quick re-search';
COMMENT ON COLUMN search_history.user_id IS 'User who performed the search';
COMMENT ON COLUMN search_history.search_term IS 'The search term entered';
COMMENT ON COLUMN search_history.domain IS 'Medical domain selected';

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Index on saved_code_sets for user lookup
CREATE INDEX IF NOT EXISTS idx_saved_code_sets_user_id
  ON saved_code_sets(user_id);

CREATE INDEX IF NOT EXISTS idx_saved_code_sets_created_at
  ON saved_code_sets(created_at DESC);

-- Index on search_history for user lookup and recent searches
CREATE INDEX IF NOT EXISTS idx_search_history_user_id
  ON search_history(user_id);

CREATE INDEX IF NOT EXISTS idx_search_history_created_at
  ON search_history(created_at DESC);

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================
-- Enable RLS on all tables to ensure users can only access their own data

-- Enable RLS
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_code_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Policy: user_preferences
-- ============================================================================
-- Users can only view and manage their own preferences

CREATE POLICY "Users can view their own preferences"
  ON user_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences"
  ON user_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences"
  ON user_preferences
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own preferences"
  ON user_preferences
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- RLS Policy: saved_code_sets
-- ============================================================================
-- Users can only view and manage their own saved code sets

CREATE POLICY "Users can view their own code sets"
  ON saved_code_sets
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own code sets"
  ON saved_code_sets
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own code sets"
  ON saved_code_sets
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own code sets"
  ON saved_code_sets
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- RLS Policy: search_history
-- ============================================================================
-- Users can only view and manage their own search history

CREATE POLICY "Users can view their own search history"
  ON search_history
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own search history"
  ON search_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own search history"
  ON search_history
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- Automatic Timestamp Update Function
-- ============================================================================
-- Updates the updated_at column when a row is modified

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for user_preferences
CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Cleanup Function (Optional)
-- ============================================================================
-- Automatically delete old search history (older than 90 days)
-- Run this as a scheduled job in Supabase if desired

CREATE OR REPLACE FUNCTION cleanup_old_search_history()
RETURNS void AS $$
BEGIN
  DELETE FROM search_history
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- To manually clean up old searches, run:
-- SELECT cleanup_old_search_history();

-- ============================================================================
-- Verification Queries
-- ============================================================================
-- Run these after setup to verify tables were created correctly

-- Check all tables exist
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('user_preferences', 'saved_code_sets', 'search_history');

-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('user_preferences', 'saved_code_sets', 'search_history');

-- Check policies exist
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('user_preferences', 'saved_code_sets', 'search_history');

-- Check indexes exist
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('saved_code_sets', 'search_history');

-- ============================================================================
-- Sample Data (Optional - for testing)
-- ============================================================================
-- Uncomment to insert sample data for testing
-- NOTE: Replace 'YOUR_USER_ID' with an actual user_id from auth.users

/*
-- Insert sample preferences
INSERT INTO user_preferences (user_id, default_domain, theme)
VALUES ('YOUR_USER_ID', 'Drug', 'light');

-- Insert sample saved code set
INSERT INTO saved_code_sets (user_id, name, hierarchy_concept_ids)
VALUES ('YOUR_USER_ID', 'My First Code Set', ARRAY[1748921, 378427]::BIGINT[]);

-- Insert sample search history
INSERT INTO search_history (user_id, search_term, domain)
VALUES
  ('YOUR_USER_ID', 'ritonavir', 'Drug'),
  ('YOUR_USER_ID', 'diabetes', 'Condition');
*/

-- ============================================================================
-- SUCCESS!
-- ============================================================================
-- If no errors appeared, your Supabase database is ready!
--
-- Next steps:
-- 1. Enable Email authentication in Supabase Dashboard
-- 2. Configure your .env file with Supabase URL and keys
-- 3. Test authentication in your application
-- ============================================================================
