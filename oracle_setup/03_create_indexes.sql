-- ============================================================================
-- Index Creation Script for OMOP Vocabulary Tables
-- ============================================================================
-- This script creates indexes optimized for the Medical Code Set Builder
-- queries (Step 1: Search, Step 2: Hierarchy, Step 3: Build Code Set)
--
-- **RUN THIS AFTER DATA IS FULLY LOADED**
--
-- Index strategy:
-- - Primary keys already have unique indexes (auto-created)
-- - Additional indexes for WHERE clauses, JOINs, and ORDER BY columns
-- - Function-based indexes for case-insensitive searches
-- ============================================================================

-- ============================================================================
-- CONCEPT TABLE INDEXES
-- ============================================================================

-- Index for Step 1 search query (vocabulary_id, domain_id filters)
CREATE INDEX IDX_CONCEPT_VOCAB_DOMAIN
ON CONCEPT (VOCABULARY_ID, DOMAIN_ID, CONCEPT_CLASS_ID);

-- Index for concept name searches (used in Step 1)
CREATE INDEX IDX_CONCEPT_NAME
ON CONCEPT (CONCEPT_NAME);

-- Function-based index for case-insensitive name searches
CREATE INDEX IDX_CONCEPT_NAME_UPPER
ON CONCEPT (UPPER(CONCEPT_NAME));

-- Index for concept code searches
CREATE INDEX IDX_CONCEPT_CODE
ON CONCEPT (CONCEPT_CODE, VOCABULARY_ID);

-- Index for standard concept filtering
CREATE INDEX IDX_CONCEPT_STANDARD
ON CONCEPT (STANDARD_CONCEPT, VOCABULARY_ID);

-- Composite index for Step 1 query optimization
CREATE INDEX IDX_CONCEPT_SEARCH
ON CONCEPT (DOMAIN_ID, VOCABULARY_ID, CONCEPT_CLASS_ID, STANDARD_CONCEPT);

-- ============================================================================
-- CONCEPT_RELATIONSHIP TABLE INDEXES
-- ============================================================================

-- Index for "Maps to" relationships (Step 1 query)
CREATE INDEX IDX_CR_CONCEPT1_REL
ON CONCEPT_RELATIONSHIP (CONCEPT_ID_1, RELATIONSHIP_ID);

-- Index for reverse lookups
CREATE INDEX IDX_CR_CONCEPT2_REL
ON CONCEPT_RELATIONSHIP (CONCEPT_ID_2, RELATIONSHIP_ID);

-- Index for Step 3 query (descendant to source mapping)
CREATE INDEX IDX_CR_CONCEPT2_CONCEPT1
ON CONCEPT_RELATIONSHIP (CONCEPT_ID_2, CONCEPT_ID_1, RELATIONSHIP_ID);

-- ============================================================================
-- CONCEPT_ANCESTOR TABLE INDEXES
-- ============================================================================

-- Index for Step 2 query (finding ancestors/parents)
CREATE INDEX IDX_CA_DESCENDANT
ON CONCEPT_ANCESTOR (DESCENDANT_CONCEPT_ID, ANCESTOR_CONCEPT_ID);

-- Index for Step 2 query (finding descendants/children)
CREATE INDEX IDX_CA_ANCESTOR
ON CONCEPT_ANCESTOR (ANCESTOR_CONCEPT_ID, DESCENDANT_CONCEPT_ID);

-- Index including separation levels for hierarchy queries
CREATE INDEX IDX_CA_DESC_LEVELS
ON CONCEPT_ANCESTOR (DESCENDANT_CONCEPT_ID, MIN_LEVELS_OF_SEPARATION);

-- Index for Step 3 query (finding all descendants)
CREATE INDEX IDX_CA_ANCESTOR_LEVELS
ON CONCEPT_ANCESTOR (ANCESTOR_CONCEPT_ID, MIN_LEVELS_OF_SEPARATION);

-- ============================================================================
-- Gather Index Statistics
-- ============================================================================
-- This helps Oracle's query optimizer choose the best execution plans

BEGIN
    -- Gather statistics on all indexes
    DBMS_STATS.GATHER_SCHEMA_STATS(
        ownname => USER,
        options => 'GATHER AUTO',
        estimate_percent => DBMS_STATS.AUTO_SAMPLE_SIZE,
        method_opt => 'FOR ALL INDEXED COLUMNS SIZE AUTO',
        cascade => TRUE
    );
END;
/

-- ============================================================================
-- Verify Index Creation
-- ============================================================================

-- Check all indexes created
SELECT
    INDEX_NAME,
    TABLE_NAME,
    UNIQUENESS,
    STATUS,
    NUM_ROWS,
    DISTINCT_KEYS,
    LEAF_BLOCKS,
    CLUSTERING_FACTOR
FROM USER_INDEXES
WHERE TABLE_NAME IN ('CONCEPT', 'CONCEPT_RELATIONSHIP', 'CONCEPT_ANCESTOR')
ORDER BY TABLE_NAME, INDEX_NAME;

-- Check index columns
SELECT
    IC.INDEX_NAME,
    IC.TABLE_NAME,
    IC.COLUMN_NAME,
    IC.COLUMN_POSITION,
    I.UNIQUENESS,
    I.STATUS
FROM USER_IND_COLUMNS IC
JOIN USER_INDEXES I ON I.INDEX_NAME = IC.INDEX_NAME
WHERE IC.TABLE_NAME IN ('CONCEPT', 'CONCEPT_RELATIONSHIP', 'CONCEPT_ANCESTOR')
ORDER BY IC.TABLE_NAME, IC.INDEX_NAME, IC.COLUMN_POSITION;

-- Check index sizes
SELECT
    SEGMENT_NAME AS INDEX_NAME,
    ROUND(BYTES/1024/1024, 2) AS SIZE_MB
FROM USER_SEGMENTS
WHERE SEGMENT_TYPE = 'INDEX'
  AND SEGMENT_NAME LIKE 'IDX_%'
ORDER BY BYTES DESC;

-- ============================================================================
-- Test Index Usage (Optional)
-- ============================================================================
-- Run EXPLAIN PLAN on your queries to verify indexes are being used

-- Example: Check if Step 1 search uses indexes
EXPLAIN PLAN FOR
SELECT *
FROM CONCEPT
WHERE DOMAIN_ID = 'Drug'
  AND VOCABULARY_ID = 'RxNorm'
  AND UPPER(CONCEPT_NAME) LIKE '%RITONAVIR%';

SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY);

-- Look for "INDEX RANGE SCAN" or "INDEX UNIQUE SCAN" in the execution plan
-- If you see "TABLE ACCESS FULL", the index is not being used

-- ============================================================================
-- Performance Tuning Notes
-- ============================================================================
-- 1. If queries are still slow after indexing:
--    - Run DBMS_STATS.GATHER_TABLE_STATS again
--    - Check execution plans with EXPLAIN PLAN
--    - Consider partitioning large tables (advanced)
--
-- 2. Index maintenance:
--    - Oracle automatically maintains indexes on INSERT/UPDATE/DELETE
--    - Periodically rebuild fragmented indexes:
--      ALTER INDEX <index_name> REBUILD ONLINE;
--
-- 3. Monitoring index usage:
--    - Enable index monitoring to see which indexes are used:
--      ALTER INDEX <index_name> MONITORING USAGE;
--    - Check usage with:
--      SELECT * FROM V$OBJECT_USAGE;
-- ============================================================================

COMMIT;
