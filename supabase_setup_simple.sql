-- ============================================================================
-- Supabase Setup - SIMPLIFIED VERSION
-- ============================================================================
-- Copy and paste this entire script into Supabase SQL Editor and click RUN
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create tables
CREATE TABLE user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  default_domain TEXT,
  theme TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE saved_code_sets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  hierarchy_concept_ids BIGINT[] NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE search_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  search_term TEXT NOT NULL,
  domain TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_saved_code_sets_user_id ON saved_code_sets(user_id);
CREATE INDEX idx_search_history_user_id ON search_history(user_id);

-- Enable Row Level Security
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_code_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies (users can only access their own data)
CREATE POLICY "Users manage own preferences" ON user_preferences FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own code sets" ON saved_code_sets FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own search history" ON search_history FOR ALL USING (auth.uid() = user_id);

-- Done! Verify it worked:
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('user_preferences', 'saved_code_sets', 'search_history');
