-- ============================================================================
-- Migration: Add Hybrid Code Set Support
-- Purpose: Add columns to support anchor-based storage for large code sets
-- ============================================================================

-- Add new columns to saved_code_sets table (excluding source_type/source_metadata which already exist)
ALTER TABLE saved_code_sets
ADD
  build_type VARCHAR(20) NULL,                    -- 'hierarchical', 'direct', or 'labtest'
  anchor_concepts NVARCHAR(MAX) NULL,             -- JSON array of anchor concept IDs for rebuild
  build_parameters NVARCHAR(MAX) NULL,            -- JSON with combo_filter, domain_id, etc.
  is_materialized BIT NOT NULL DEFAULT 1;         -- 1 = full concepts saved, 0 = anchor-only (needs rebuild)

-- Add index for faster queries on materialized flag
CREATE INDEX idx_code_sets_materialized ON saved_code_sets(is_materialized);

-- Add comment explaining the hybrid approach
-- Small code sets (<500 concepts): is_materialized=1, concepts contains full data, anchor_concepts NULL
-- Large code sets (>=500 concepts): is_materialized=0, concepts NULL, anchor_concepts contains IDs for rebuild

GO
