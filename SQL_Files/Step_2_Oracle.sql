-- ============================================================================
-- Step 2: Explore Hierarchy Query - ORACLE VERSION
-- ============================================================================
-- Shows parent and child concepts in the hierarchy for a selected concept
-- Input parameters:
--   - concept: Standard concept ID from Step 1 (e.g., 1748921)
-- Output: Hierarchy tree showing ancestors (positive steps) and descendants (negative steps)
-- ============================================================================
-- CONVERTED FROM POSTGRESQL TO ORACLE SYNTAX
-- Changes:
--   - Replaced ::bigint casts with TO_NUMBER()
--   - Replaced subquery for domain_id with JOIN
--   - Oracle-compatible UNION ALL syntax
-- ============================================================================

-- BIND VARIABLES (Replace with actual values in application)
-- Example usage:
-- VARIABLE v_concept NUMBER;
-- EXEC :v_concept := 1748921;

WITH params AS (
  SELECT
    1748921 AS concept,  -- REPLACE WITH :v_concept in application
    (SELECT domain_id FROM concept WHERE concept_id = 1748921) AS domain_id
  FROM DUAL
),
vocab AS (
  -- Build vocabulary list based on domain
  SELECT vocabulary_id
  FROM (
    -- Condition vocabularies
    SELECT 'ICD10CM' AS vocabulary_id FROM DUAL WHERE (SELECT domain_id FROM params) = 'Condition'
    UNION ALL
    SELECT 'SNOMED' FROM DUAL WHERE (SELECT domain_id FROM params) = 'Condition'
    UNION ALL
    SELECT 'ICD9CM' FROM DUAL WHERE (SELECT domain_id FROM params) = 'Condition'

    -- Observation vocabularies
    UNION ALL
    SELECT 'ICD10CM' FROM DUAL WHERE (SELECT domain_id FROM params) = 'Observation'
    UNION ALL
    SELECT 'SNOMED' FROM DUAL WHERE (SELECT domain_id FROM params) = 'Observation'
    UNION ALL
    SELECT 'LOINC' FROM DUAL WHERE (SELECT domain_id FROM params) = 'Observation'
    UNION ALL
    SELECT 'CPT4' FROM DUAL WHERE (SELECT domain_id FROM params) = 'Observation'
    UNION ALL
    SELECT 'HCPCS' FROM DUAL WHERE (SELECT domain_id FROM params) = 'Observation'

    -- Drug vocabularies
    UNION ALL
    SELECT 'RxNorm' FROM DUAL WHERE (SELECT domain_id FROM params) = 'Drug'
    UNION ALL
    SELECT 'NDC' FROM DUAL WHERE (SELECT domain_id FROM params) = 'Drug'
    UNION ALL
    SELECT 'CPT4' FROM DUAL WHERE (SELECT domain_id FROM params) = 'Drug'
    UNION ALL
    SELECT 'CVX' FROM DUAL WHERE (SELECT domain_id FROM params) = 'Drug'
    UNION ALL
    SELECT 'HCPCS' FROM DUAL WHERE (SELECT domain_id FROM params) = 'Drug'
    UNION ALL
    SELECT 'ATC' FROM DUAL WHERE (SELECT domain_id FROM params) = 'Drug'

    -- Measurement vocabularies
    UNION ALL
    SELECT 'LOINC' FROM DUAL WHERE (SELECT domain_id FROM params) = 'Measurement'
    UNION ALL
    SELECT 'CPT4' FROM DUAL WHERE (SELECT domain_id FROM params) = 'Measurement'
    UNION ALL
    SELECT 'SNOMED' FROM DUAL WHERE (SELECT domain_id FROM params) = 'Measurement'
    UNION ALL
    SELECT 'HCPCS' FROM DUAL WHERE (SELECT domain_id FROM params) = 'Measurement'

    -- Procedure vocabularies
    UNION ALL
    SELECT 'CPT4' FROM DUAL WHERE (SELECT domain_id FROM params) = 'Procedure'
    UNION ALL
    SELECT 'HCPCS' FROM DUAL WHERE (SELECT domain_id FROM params) = 'Procedure'
    UNION ALL
    SELECT 'SNOMED' FROM DUAL WHERE (SELECT domain_id FROM params) = 'Procedure'
    UNION ALL
    SELECT 'ICD09PCS' FROM DUAL WHERE (SELECT domain_id FROM params) = 'Procedure'
    UNION ALL
    SELECT 'LOINC' FROM DUAL WHERE (SELECT domain_id FROM params) = 'Procedure'
    UNION ALL
    SELECT 'ICD10PCS' FROM DUAL WHERE (SELECT domain_id FROM params) = 'Procedure'
  )
  WHERE vocabulary_id IS NOT NULL
)
SELECT *
FROM (
  -- Parents (ancestors): steps away are positive
  SELECT
    ca.min_levels_of_separation AS steps_away,
    a.concept_name,
    a.concept_id AS hierarchy_concept_id,
    a.vocabulary_id,
    a.concept_class_id,
    c.concept_name AS root_term
  FROM concept c
  JOIN concept_ancestor ca
    ON ca.descendant_concept_id = c.concept_id
  JOIN concept a
    ON a.concept_id = ca.ancestor_concept_id
  WHERE c.concept_id = (SELECT concept FROM params)
    AND a.vocabulary_id IN (SELECT vocabulary_id FROM vocab)
    AND (
      (
        -- Drug domain filters
        (SELECT domain_id FROM params) = 'Drug' AND (
          (a.vocabulary_id = 'ATC' AND a.concept_class_id IN ('ATC 5th', 'ATC 4th'))
          OR
          (a.vocabulary_id = 'RxNorm' AND a.concept_class_id IN ('Clinical Drug', 'Ingredient'))
        )
      )
      OR
      -- Non-Drug domains: pass-through (no filtering)
      (SELECT domain_id FROM params) <> 'Drug'
    )

  UNION ALL

  -- Children (descendants): steps away are negative
  SELECT
    ca.min_levels_of_separation * -1 AS steps_away,
    a.concept_name,
    a.concept_id AS hierarchy_concept_id,
    a.vocabulary_id,
    a.concept_class_id,
    c.concept_name AS root_term
  FROM concept c
  JOIN concept_ancestor ca
    ON ca.ancestor_concept_id = c.concept_id
  JOIN concept a
    ON a.concept_id = ca.descendant_concept_id
  WHERE c.concept_id = (SELECT concept FROM params)
    AND c.vocabulary_id IN (SELECT vocabulary_id FROM vocab)
    AND (
      (
        -- Drug domain filters
        (SELECT domain_id FROM params) = 'Drug' AND (
          (a.vocabulary_id = 'ATC' AND a.concept_class_id IN ('ATC 5th', 'ATC 4th'))
          OR
          (a.vocabulary_id = 'RxNorm' AND a.concept_class_id IN ('Clinical Drug', 'Ingredient'))
        )
      )
      OR
      -- Non-Drug domains: pass-through (no filtering)
      (SELECT domain_id FROM params) <> 'Drug'
    )
) t
ORDER BY steps_away DESC;

-- ============================================================================
-- ALTERNATIVE: Parameterized version using bind variables (RECOMMENDED)
-- ============================================================================
-- Use this in your Node.js application with oracledb package
-- ============================================================================

/*
WITH params AS (
  SELECT
    :concept AS concept,
    (SELECT domain_id FROM concept WHERE concept_id = :concept) AS domain_id
  FROM DUAL
),
vocab AS (
  SELECT vocabulary_id
  FROM (
    SELECT 'ICD10CM' AS vocabulary_id FROM DUAL WHERE (SELECT domain_id FROM params) = 'Condition'
    UNION ALL
    SELECT 'SNOMED' FROM DUAL WHERE (SELECT domain_id FROM params) = 'Condition'
    UNION ALL
    SELECT 'ICD9CM' FROM DUAL WHERE (SELECT domain_id FROM params) = 'Condition'
    UNION ALL
    SELECT 'ICD10CM' FROM DUAL WHERE (SELECT domain_id FROM params) = 'Observation'
    UNION ALL
    SELECT 'SNOMED' FROM DUAL WHERE (SELECT domain_id FROM params) = 'Observation'
    UNION ALL
    SELECT 'LOINC' FROM DUAL WHERE (SELECT domain_id FROM params) = 'Observation'
    UNION ALL
    SELECT 'CPT4' FROM DUAL WHERE (SELECT domain_id FROM params) = 'Observation'
    UNION ALL
    SELECT 'HCPCS' FROM DUAL WHERE (SELECT domain_id FROM params) = 'Observation'
    UNION ALL
    SELECT 'RxNorm' FROM DUAL WHERE (SELECT domain_id FROM params) = 'Drug'
    UNION ALL
    SELECT 'NDC' FROM DUAL WHERE (SELECT domain_id FROM params) = 'Drug'
    UNION ALL
    SELECT 'CPT4' FROM DUAL WHERE (SELECT domain_id FROM params) = 'Drug'
    UNION ALL
    SELECT 'CVX' FROM DUAL WHERE (SELECT domain_id FROM params) = 'Drug'
    UNION ALL
    SELECT 'HCPCS' FROM DUAL WHERE (SELECT domain_id FROM params) = 'Drug'
    UNION ALL
    SELECT 'ATC' FROM DUAL WHERE (SELECT domain_id FROM params) = 'Drug'
    UNION ALL
    SELECT 'LOINC' FROM DUAL WHERE (SELECT domain_id FROM params) = 'Measurement'
    UNION ALL
    SELECT 'CPT4' FROM DUAL WHERE (SELECT domain_id FROM params) = 'Measurement'
    UNION ALL
    SELECT 'SNOMED' FROM DUAL WHERE (SELECT domain_id FROM params) = 'Measurement'
    UNION ALL
    SELECT 'HCPCS' FROM DUAL WHERE (SELECT domain_id FROM params) = 'Measurement'
    UNION ALL
    SELECT 'CPT4' FROM DUAL WHERE (SELECT domain_id FROM params) = 'Procedure'
    UNION ALL
    SELECT 'HCPCS' FROM DUAL WHERE (SELECT domain_id FROM params) = 'Procedure'
    UNION ALL
    SELECT 'SNOMED' FROM DUAL WHERE (SELECT domain_id FROM params) = 'Procedure'
    UNION ALL
    SELECT 'ICD09PCS' FROM DUAL WHERE (SELECT domain_id FROM params) = 'Procedure'
    UNION ALL
    SELECT 'LOINC' FROM DUAL WHERE (SELECT domain_id FROM params) = 'Procedure'
    UNION ALL
    SELECT 'ICD10PCS' FROM DUAL WHERE (SELECT domain_id FROM params) = 'Procedure'
  )
  WHERE vocabulary_id IS NOT NULL
)
SELECT *
FROM (
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
  WHERE c.concept_id = :concept
    AND a.vocabulary_id IN (SELECT vocabulary_id FROM vocab)
    AND (
      ((SELECT domain_id FROM params) = 'Drug' AND (
        (a.vocabulary_id = 'ATC' AND a.concept_class_id IN ('ATC 5th', 'ATC 4th'))
        OR (a.vocabulary_id = 'RxNorm' AND a.concept_class_id IN ('Clinical Drug', 'Ingredient'))
      ))
      OR (SELECT domain_id FROM params) <> 'Drug'
    )

  UNION ALL

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
  WHERE c.concept_id = :concept
    AND c.vocabulary_id IN (SELECT vocabulary_id FROM vocab)
    AND (
      ((SELECT domain_id FROM params) = 'Drug' AND (
        (a.vocabulary_id = 'ATC' AND a.concept_class_id IN ('ATC 5th', 'ATC 4th'))
        OR (a.vocabulary_id = 'RxNorm' AND a.concept_class_id IN ('Clinical Drug', 'Ingredient'))
      ))
      OR (SELECT domain_id FROM params) <> 'Drug'
    )
) t
ORDER BY steps_away DESC;
*/
