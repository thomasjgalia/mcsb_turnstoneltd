-- ============================================================================
-- Test Queries for OMOP Vocabulary Data Validation
-- ============================================================================
-- Run these queries AFTER loading data to verify everything works correctly
-- These test the actual queries that the Medical Code Set Builder will use
-- ============================================================================

-- ============================================================================
-- PART 1: Basic Data Validation
-- ============================================================================

-- Check row counts (should match your source CSV files)
SELECT 'CONCEPT' AS table_name, COUNT(*) AS row_count FROM CONCEPT
UNION ALL
SELECT 'CONCEPT_RELATIONSHIP', COUNT(*) FROM CONCEPT_RELATIONSHIP
UNION ALL
SELECT 'CONCEPT_ANCESTOR', COUNT(*) FROM CONCEPT_ANCESTOR;

-- Expected results (approximate):
-- CONCEPT: ~7-8 million rows
-- CONCEPT_RELATIONSHIP: ~30-40 million rows
-- CONCEPT_ANCESTOR: ~60-70 million rows

-- Check for NULL values in critical columns
SELECT 'CONCEPT - Critical NULLs' AS check_name, COUNT(*) AS null_count
FROM CONCEPT
WHERE CONCEPT_ID IS NULL OR CONCEPT_NAME IS NULL OR VOCABULARY_ID IS NULL
UNION ALL
SELECT 'CONCEPT_RELATIONSHIP - Critical NULLs', COUNT(*)
FROM CONCEPT_RELATIONSHIP
WHERE CONCEPT_ID_1 IS NULL OR CONCEPT_ID_2 IS NULL OR RELATIONSHIP_ID IS NULL
UNION ALL
SELECT 'CONCEPT_ANCESTOR - Critical NULLs', COUNT(*)
FROM CONCEPT_ANCESTOR
WHERE ANCESTOR_CONCEPT_ID IS NULL OR DESCENDANT_CONCEPT_ID IS NULL;

-- Should return 0 for all checks

-- ============================================================================
-- PART 2: Vocabulary Distribution
-- ============================================================================

-- Check which vocabularies are present
SELECT
    VOCABULARY_ID,
    COUNT(*) AS concept_count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) AS percent_of_total
FROM CONCEPT
GROUP BY VOCABULARY_ID
ORDER BY COUNT(*) DESC
FETCH FIRST 20 ROWS ONLY;

-- Check domain distribution
SELECT
    DOMAIN_ID,
    COUNT(*) AS concept_count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) AS percent_of_total
FROM CONCEPT
GROUP BY DOMAIN_ID
ORDER BY COUNT(*) DESC;

-- Check standard concepts
SELECT
    STANDARD_CONCEPT,
    COUNT(*) AS count,
    CASE
        WHEN STANDARD_CONCEPT = 'S' THEN 'Standard'
        WHEN STANDARD_CONCEPT = 'C' THEN 'Classification'
        WHEN STANDARD_CONCEPT IS NULL THEN 'Non-standard'
    END AS description
FROM CONCEPT
GROUP BY STANDARD_CONCEPT
ORDER BY COUNT(*) DESC;

-- ============================================================================
-- PART 3: Test Step 1 Query (Search)
-- ============================================================================

PROMPT ============================================================
PROMPT Testing Step 1: Search Query
PROMPT Search term: 'ritonavir', Domain: 'Drug'
PROMPT Expected: ~75 results including RxNorm and NDC codes
PROMPT ============================================================

-- Test Drug domain search
WITH params AS (
  SELECT 'ritonavir' AS searchterm, 'Drug' AS domain_id FROM DUAL
),
vocab AS (
  SELECT vocabulary_id FROM (
    SELECT 'RxNorm' AS vocabulary_id FROM DUAL WHERE (SELECT domain_id FROM params) = 'Drug'
    UNION ALL SELECT 'NDC' FROM DUAL WHERE (SELECT domain_id FROM params) = 'Drug'
    UNION ALL SELECT 'CPT4' FROM DUAL WHERE (SELECT domain_id FROM params) = 'Drug'
    UNION ALL SELECT 'CVX' FROM DUAL WHERE (SELECT domain_id FROM params) = 'Drug'
    UNION ALL SELECT 'HCPCS' FROM DUAL WHERE (SELECT domain_id FROM params) = 'Drug'
    UNION ALL SELECT 'ATC' FROM DUAL WHERE (SELECT domain_id FROM params) = 'Drug'
  ) WHERE vocabulary_id IS NOT NULL
)
SELECT
  s.concept_name AS standard_name,
  s.concept_id AS std_concept_id,
  s.concept_code AS standard_code,
  s.vocabulary_id AS standard_vocabulary,
  c.concept_name AS search_result,
  c.vocabulary_id
FROM concept c
LEFT JOIN concept_relationship cr ON cr.concept_id_1 = c.concept_id AND cr.relationship_id = 'Maps to'
LEFT JOIN concept s ON s.concept_id = cr.concept_id_2 AND s.standard_concept = 'S'
WHERE UPPER(TO_CHAR(c.concept_id) || ' ' || c.concept_code || ' ' || c.concept_name)
      LIKE '%' || UPPER((SELECT searchterm FROM params)) || '%'
  AND c.vocabulary_id IN (SELECT vocabulary_id FROM vocab)
  AND c.domain_id = (SELECT domain_id FROM params)
  AND c.concept_class_id IN (
      'Clinical Drug', 'Branded Drug', 'Ingredient', 'Clinical Pack', 'Branded Pack',
      'Quant Clinical Drug', 'Quant Branded Drug', '11-digit NDC'
  )
ORDER BY (LENGTH((SELECT searchterm FROM params)) - 2 - LENGTH(c.concept_name)) DESC
FETCH FIRST 10 ROWS ONLY;

-- Test Condition domain search
PROMPT ============================================================
PROMPT Testing Step 1: Search Query
PROMPT Search term: 'diabetes', Domain: 'Condition'
PROMPT Expected: Results from ICD10CM, SNOMED, ICD9CM
PROMPT ============================================================

WITH params AS (
  SELECT 'diabetes' AS searchterm, 'Condition' AS domain_id FROM DUAL
),
vocab AS (
  SELECT vocabulary_id FROM (
    SELECT 'ICD10CM' AS vocabulary_id FROM DUAL WHERE (SELECT domain_id FROM params) = 'Condition'
    UNION ALL SELECT 'SNOMED' FROM DUAL WHERE (SELECT domain_id FROM params) = 'Condition'
    UNION ALL SELECT 'ICD9CM' FROM DUAL WHERE (SELECT domain_id FROM params) = 'Condition'
  ) WHERE vocabulary_id IS NOT NULL
)
SELECT
  s.concept_name AS standard_name,
  s.concept_id AS std_concept_id,
  s.vocabulary_id AS standard_vocabulary,
  c.concept_name AS search_result,
  c.vocabulary_id
FROM concept c
LEFT JOIN concept_relationship cr ON cr.concept_id_1 = c.concept_id AND cr.relationship_id = 'Maps to'
LEFT JOIN concept s ON s.concept_id = cr.concept_id_2 AND s.standard_concept = 'S'
WHERE UPPER(TO_CHAR(c.concept_id) || ' ' || c.concept_code || ' ' || c.concept_name)
      LIKE '%' || UPPER((SELECT searchterm FROM params)) || '%'
  AND c.vocabulary_id IN (SELECT vocabulary_id FROM vocab)
  AND c.domain_id = (SELECT domain_id FROM params)
ORDER BY (LENGTH((SELECT searchterm FROM params)) - 2 - LENGTH(c.concept_name)) DESC
FETCH FIRST 10 ROWS ONLY;

-- ============================================================================
-- PART 4: Test Step 2 Query (Hierarchy)
-- ============================================================================

PROMPT ============================================================
PROMPT Testing Step 2: Hierarchy Query
PROMPT Concept ID: 1748921 (Ritonavir - RxNorm Ingredient)
PROMPT Expected: Parents (ATC codes) and Children (Clinical Drugs)
PROMPT ============================================================

WITH params AS (
  SELECT
    1748921 AS concept,
    (SELECT domain_id FROM concept WHERE concept_id = 1748921) AS domain_id
  FROM DUAL
),
vocab AS (
  SELECT vocabulary_id FROM (
    SELECT 'RxNorm' AS vocabulary_id FROM DUAL WHERE (SELECT domain_id FROM params) = 'Drug'
    UNION ALL SELECT 'ATC' FROM DUAL WHERE (SELECT domain_id FROM params) = 'Drug'
  ) WHERE vocabulary_id IS NOT NULL
)
SELECT *
FROM (
  -- Parents
  SELECT
    ca.min_levels_of_separation AS steps_away,
    a.concept_name,
    a.concept_id AS hierarchy_concept_id,
    a.vocabulary_id,
    a.concept_class_id,
    c.concept_name AS root_term
  FROM concept c
  JOIN concept_ancestor ca ON ca.descendant_concept_id = c.concept_id
  JOIN concept a ON a.concept_id = ca.ancestor_concept_id
  WHERE c.concept_id = (SELECT concept FROM params)
    AND a.vocabulary_id IN (SELECT vocabulary_id FROM vocab)
    AND ((SELECT domain_id FROM params) = 'Drug' AND (
      (a.vocabulary_id = 'ATC' AND a.concept_class_id IN ('ATC 5th', 'ATC 4th'))
      OR (a.vocabulary_id = 'RxNorm' AND a.concept_class_id IN ('Clinical Drug', 'Ingredient'))
    ))

  UNION ALL

  -- Children
  SELECT
    ca.min_levels_of_separation * -1 AS steps_away,
    a.concept_name,
    a.concept_id AS hierarchy_concept_id,
    a.vocabulary_id,
    a.concept_class_id,
    c.concept_name AS root_term
  FROM concept c
  JOIN concept_ancestor ca ON ca.ancestor_concept_id = c.concept_id
  JOIN concept a ON a.concept_id = ca.descendant_concept_id
  WHERE c.concept_id = (SELECT concept FROM params)
    AND c.vocabulary_id IN (SELECT vocabulary_id FROM vocab)
    AND ((SELECT domain_id FROM params) = 'Drug' AND (
      (a.vocabulary_id = 'ATC' AND a.concept_class_id IN ('ATC 5th', 'ATC 4th'))
      OR (a.vocabulary_id = 'RxNorm' AND a.concept_class_id IN ('Clinical Drug', 'Ingredient'))
    ))
) t
ORDER BY steps_away DESC
FETCH FIRST 20 ROWS ONLY;

-- ============================================================================
-- PART 5: Test Step 3 Query (Build Code Set)
-- ============================================================================

PROMPT ============================================================
PROMPT Testing Step 3: Build Code Set Query
PROMPT Concept ID: 21600712 (RxNorm Clinical Drug)
PROMPT Expected: All descendant codes (RxNorm, NDC, etc.)
PROMPT ============================================================

WITH params AS (
  SELECT
    21600712 AS concept,
    'ALL' AS combo,
    (SELECT domain_id FROM concept WHERE concept_id = 21600712) AS domain_id
  FROM DUAL
),
vocab AS (
  SELECT vocabulary_id FROM (
    SELECT 'RxNorm' AS vocabulary_id FROM DUAL WHERE (SELECT domain_id FROM params) = 'Drug'
    UNION ALL SELECT 'NDC' FROM DUAL WHERE (SELECT domain_id FROM params) = 'Drug'
  ) WHERE vocabulary_id IS NOT NULL
)
SELECT
  c.concept_name AS root_concept_name,
  d.vocabulary_id AS child_vocabulary_id,
  d.concept_code AS child_code,
  d.concept_name AS child_name,
  d.concept_id AS child_concept_id,
  d.concept_class_id
FROM concept c
JOIN concept_ancestor ca ON ca.ancestor_concept_id = c.concept_id
JOIN concept_relationship cr ON cr.concept_id_2 = ca.descendant_concept_id AND cr.relationship_id = 'Maps to'
JOIN concept d ON d.concept_id = cr.concept_id_1 AND d.domain_id = (SELECT domain_id FROM params)
WHERE c.concept_id = (SELECT concept FROM params)
  AND d.vocabulary_id IN (SELECT vocabulary_id FROM vocab)
  AND (
    (SELECT domain_id FROM params) <> 'Drug'
    OR d.concept_class_id IN (
      'Clinical Drug', 'Branded Drug Form', 'Clinical Drug Form',
      'Quant Branded Drug', 'Quant Clinical Drug', '11-digit NDC'
    )
  )
ORDER BY d.vocabulary_id DESC
FETCH FIRST 20 ROWS ONLY;

-- ============================================================================
-- PART 6: Index Usage Validation
-- ============================================================================

PROMPT ============================================================
PROMPT Checking Index Usage
PROMPT Verifying that indexes are being used by queries
PROMPT ============================================================

-- Check if indexes exist
SELECT
    INDEX_NAME,
    TABLE_NAME,
    UNIQUENESS,
    STATUS
FROM USER_INDEXES
WHERE TABLE_NAME IN ('CONCEPT', 'CONCEPT_RELATIONSHIP', 'CONCEPT_ANCESTOR')
ORDER BY TABLE_NAME, INDEX_NAME;

-- ============================================================================
-- PART 7: Relationship Type Check
-- ============================================================================

PROMPT ============================================================
PROMPT Checking Relationship Types
PROMPT Key relationship: 'Maps to' (used in all 3 steps)
PROMPT ============================================================

-- Check "Maps to" relationships
SELECT
    RELATIONSHIP_ID,
    COUNT(*) AS relationship_count
FROM CONCEPT_RELATIONSHIP
GROUP BY RELATIONSHIP_ID
ORDER BY COUNT(*) DESC
FETCH FIRST 10 ROWS ONLY;

-- Verify "Maps to" exists
SELECT COUNT(*) AS maps_to_count
FROM CONCEPT_RELATIONSHIP
WHERE RELATIONSHIP_ID = 'Maps to';

-- Should be > 0

-- ============================================================================
-- PART 8: Sample Concept Checks
-- ============================================================================

PROMPT ============================================================
PROMPT Sample Concept Data Check
PROMPT Verifying well-known concepts exist
PROMPT ============================================================

-- Check for Ritonavir (commonly used drug in testing)
SELECT
    CONCEPT_ID,
    CONCEPT_NAME,
    VOCABULARY_ID,
    CONCEPT_CLASS_ID,
    STANDARD_CONCEPT
FROM CONCEPT
WHERE UPPER(CONCEPT_NAME) LIKE '%RITONAVIR%'
  AND VOCABULARY_ID = 'RxNorm'
  AND CONCEPT_CLASS_ID = 'Ingredient'
  AND ROWNUM <= 5;

-- Check for Diabetes (common condition)
SELECT
    CONCEPT_ID,
    CONCEPT_NAME,
    VOCABULARY_ID,
    CONCEPT_CLASS_ID,
    STANDARD_CONCEPT
FROM CONCEPT
WHERE UPPER(CONCEPT_NAME) LIKE '%DIABETES MELLITUS%'
  AND VOCABULARY_ID = 'SNOMED'
  AND STANDARD_CONCEPT = 'S'
  AND ROWNUM <= 5;

-- ============================================================================
-- SUCCESS CRITERIA
-- ============================================================================
-- If all queries above return results without errors, your data is loaded
-- correctly and ready for the Medical Code Set Builder application!
--
-- Expected results summary:
-- 1. Row counts in millions (CONCEPT ~7M, CONCEPT_RELATIONSHIP ~30M, CONCEPT_ANCESTOR ~60M)
-- 2. No NULL values in critical columns
-- 3. Multiple vocabularies present (ICD10CM, SNOMED, RxNorm, LOINC, etc.)
-- 4. Step 1 query returns search results
-- 5. Step 2 query shows hierarchy
-- 6. Step 3 query returns descendant codes
-- 7. Indexes are created and status = VALID
-- 8. "Maps to" relationships exist
-- ============================================================================
