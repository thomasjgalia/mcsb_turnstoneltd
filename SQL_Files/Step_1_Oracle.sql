-- ============================================================================
-- Step 1: Term Search Query - ORACLE VERSION
-- ============================================================================
-- Searches OMOP vocabulary for matching concepts and returns standard concepts
-- Input parameters:
--   - searchterm: Text to search for (e.g., 'ritonavir')
--   - domain_id: Medical domain (Condition, Drug, Procedure, Measurement, Observation)
-- Output: Up to 75 matching standard concepts
-- ============================================================================
-- CONVERTED FROM POSTGRESQL TO ORACLE SYNTAX
-- Changes:
--   - Replaced ::text casts with TO_CHAR()
--   - Replaced ILIKE with UPPER() + LIKE
--   - Replaced unnest(ARRAY[]) with CASE-based vocabulary list
--   - Replaced string concatenation with ||
-- ============================================================================

-- BIND VARIABLES (Replace with actual values in application)
-- Example usage:
-- VARIABLE v_searchterm VARCHAR2(255);
-- VARIABLE v_domain_id VARCHAR2(20);
-- EXEC :v_searchterm := 'ritonavir';
-- EXEC :v_domain_id := 'Drug';

WITH params AS (
  SELECT
    'ritonavir' AS searchterm,  -- REPLACE WITH :v_searchterm in application
    'Drug' AS domain_id         -- REPLACE WITH :v_domain_id in application
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
SELECT
  s.concept_name AS standard_name,
  s.concept_id AS std_concept_id,
  s.concept_code AS standard_code,
  s.vocabulary_id AS standard_vocabulary,
  s.concept_class_id,
  c.concept_name AS search_result,
  c.concept_code AS searched_code,
  c.concept_class_id AS searched_concept_class_id,
  c.vocabulary_id
FROM concept c
LEFT JOIN concept_relationship cr
  ON cr.concept_id_1 = c.concept_id
 AND cr.relationship_id = 'Maps to'
LEFT JOIN concept s
  ON s.concept_id = cr.concept_id_2
 AND s.standard_concept = 'S'
WHERE (
    -- Case-insensitive match across id, code, and name
    UPPER(TO_CHAR(c.concept_id) || ' ' || c.concept_code || ' ' || c.concept_name)
      LIKE '%' || UPPER((SELECT searchterm FROM params)) || '%'
  )
  AND c.vocabulary_id IN (SELECT vocabulary_id FROM vocab)
  AND c.domain_id = (SELECT domain_id FROM params)
  AND (
    (SELECT domain_id FROM params) <> 'Drug'
    OR c.concept_class_id IN (
      'Clinical Drug', 'Branded Drug', 'Ingredient', 'Clinical Pack', 'Branded Pack',
      'Quant Clinical Drug', 'Quant Branded Drug', '11-digit NDC'
    )
  )
ORDER BY (LENGTH((SELECT searchterm FROM params)) - 2 - LENGTH(c.concept_name)) DESC
FETCH FIRST 75 ROWS ONLY;

-- ============================================================================
-- ALTERNATIVE: Parameterized version using bind variables (RECOMMENDED)
-- ============================================================================
-- Use this in your Node.js application with oracledb package
-- Benefits: Better performance (SQL parsing cache), SQL injection prevention
-- ============================================================================

/*
WITH params AS (
  SELECT
    :searchterm AS searchterm,
    :domain_id AS domain_id
  FROM DUAL
),
vocab AS (
  SELECT vocabulary_id
  FROM (
    SELECT 'ICD10CM' AS vocabulary_id FROM DUAL WHERE :domain_id = 'Condition'
    UNION ALL
    SELECT 'SNOMED' FROM DUAL WHERE :domain_id = 'Condition'
    UNION ALL
    SELECT 'ICD9CM' FROM DUAL WHERE :domain_id = 'Condition'
    UNION ALL
    SELECT 'ICD10CM' FROM DUAL WHERE :domain_id = 'Observation'
    UNION ALL
    SELECT 'SNOMED' FROM DUAL WHERE :domain_id = 'Observation'
    UNION ALL
    SELECT 'LOINC' FROM DUAL WHERE :domain_id = 'Observation'
    UNION ALL
    SELECT 'CPT4' FROM DUAL WHERE :domain_id = 'Observation'
    UNION ALL
    SELECT 'HCPCS' FROM DUAL WHERE :domain_id = 'Observation'
    UNION ALL
    SELECT 'RxNorm' FROM DUAL WHERE :domain_id = 'Drug'
    UNION ALL
    SELECT 'NDC' FROM DUAL WHERE :domain_id = 'Drug'
    UNION ALL
    SELECT 'CPT4' FROM DUAL WHERE :domain_id = 'Drug'
    UNION ALL
    SELECT 'CVX' FROM DUAL WHERE :domain_id = 'Drug'
    UNION ALL
    SELECT 'HCPCS' FROM DUAL WHERE :domain_id = 'Drug'
    UNION ALL
    SELECT 'ATC' FROM DUAL WHERE :domain_id = 'Drug'
    UNION ALL
    SELECT 'LOINC' FROM DUAL WHERE :domain_id = 'Measurement'
    UNION ALL
    SELECT 'CPT4' FROM DUAL WHERE :domain_id = 'Measurement'
    UNION ALL
    SELECT 'SNOMED' FROM DUAL WHERE :domain_id = 'Measurement'
    UNION ALL
    SELECT 'HCPCS' FROM DUAL WHERE :domain_id = 'Measurement'
    UNION ALL
    SELECT 'CPT4' FROM DUAL WHERE :domain_id = 'Procedure'
    UNION ALL
    SELECT 'HCPCS' FROM DUAL WHERE :domain_id = 'Procedure'
    UNION ALL
    SELECT 'SNOMED' FROM DUAL WHERE :domain_id = 'Procedure'
    UNION ALL
    SELECT 'ICD09PCS' FROM DUAL WHERE :domain_id = 'Procedure'
    UNION ALL
    SELECT 'LOINC' FROM DUAL WHERE :domain_id = 'Procedure'
    UNION ALL
    SELECT 'ICD10PCS' FROM DUAL WHERE :domain_id = 'Procedure'
  )
  WHERE vocabulary_id IS NOT NULL
)
SELECT
  s.concept_name AS standard_name,
  s.concept_id AS std_concept_id,
  s.concept_code AS standard_code,
  s.vocabulary_id AS standard_vocabulary,
  s.concept_class_id,
  c.concept_name AS search_result,
  c.concept_code AS searched_code,
  c.concept_class_id AS searched_concept_class_id,
  c.vocabulary_id
FROM concept c
LEFT JOIN concept_relationship cr
  ON cr.concept_id_1 = c.concept_id
 AND cr.relationship_id = 'Maps to'
LEFT JOIN concept s
  ON s.concept_id = cr.concept_id_2
 AND s.standard_concept = 'S'
WHERE UPPER(TO_CHAR(c.concept_id) || ' ' || c.concept_code || ' ' || c.concept_name)
      LIKE '%' || UPPER(:searchterm) || '%'
  AND c.vocabulary_id IN (SELECT vocabulary_id FROM vocab)
  AND c.domain_id = :domain_id
  AND (
    :domain_id <> 'Drug'
    OR c.concept_class_id IN (
      'Clinical Drug', 'Branded Drug', 'Ingredient', 'Clinical Pack', 'Branded Pack',
      'Quant Clinical Drug', 'Quant Branded Drug', '11-digit NDC'
    )
  )
ORDER BY (LENGTH(:searchterm) - 2 - LENGTH(c.concept_name)) DESC
FETCH FIRST 75 ROWS ONLY;
*/
