/* **************************************************************
   Step 2 - Explore Hierarchy
   Explore hierarchy around a STANDARD_CONCEPT_ID (from Step 1).
   Pick a HIERARCHY_CONCEPT_ID for Step 3.

   Converted from Snowflake to Oracle
   ************************************************************** */

-- Define input parameter (bind variable for API use)
-- :concept - STANDARD_CONCEPT_ID from Step 1

-- Derive the domain for this concept (for API: do this in application code)
-- For testing in SQL*Plus/SQL Developer:
-- VARIABLE domain_id VARCHAR2(20);
-- BEGIN
--   SELECT DOMAIN_ID INTO :domain_id FROM CONCEPT WHERE CONCEPT_ID = :concept;
-- END;
-- /

/* ---------- PARENTS (A = ANCESTOR) ---------- */
SELECT
  CA.MIN_LEVELS_OF_SEPARATION              AS STEPS_AWAY,
  A.CONCEPT_NAME,
  A.CONCEPT_ID                             AS HIERARCHY_CONCEPT_ID,
  A.VOCABULARY_ID,
  A.CONCEPT_CLASS_ID,
  C.CONCEPT_NAME                           AS ROOT_TERM
FROM CONCEPT C
JOIN CONCEPT_ANCESTOR CA
  ON CA.DESCENDANT_CONCEPT_ID = C.CONCEPT_ID
JOIN CONCEPT A
  ON A.CONCEPT_ID = CA.ANCESTOR_CONCEPT_ID
WHERE
  C.CONCEPT_ID = :concept
  AND A.VOCABULARY_ID IN (
    SELECT COLUMN_VALUE
    FROM TABLE(
      CAST(
        CASE :domain_id
          WHEN 'Condition'   THEN sys.odcivarchar2list('ICD10CM','SNOMED','ICD9CM')
          WHEN 'Observation' THEN sys.odcivarchar2list('ICD10CM','SNOMED','LOINC','CPT4','HCPCS')
          WHEN 'Drug'        THEN sys.odcivarchar2list('RxNorm','NDC','CPT4','CVX','HCPCS','ATC')
          WHEN 'Measurement' THEN sys.odcivarchar2list('LOINC','CPT4','SNOMED','HCPCS')
          WHEN 'Procedure'   THEN sys.odcivarchar2list('CPT4','HCPCS','SNOMED','ICD09PCS','LOINC','ICD10PCS','SNOMED')
          ELSE sys.odcivarchar2list() -- empty for unknown domain
        END
        AS sys.odcivarchar2list
      )
    )
  )
  AND (
       (:domain_id = 'Drug' AND (
            /* Expanded to include ATC 1st–5th so higher-level parents are retained */
            (A.VOCABULARY_ID = 'ATC'    AND A.CONCEPT_CLASS_ID IN ('ATC 5th','ATC 4th','ATC 3rd','ATC 2nd','ATC 1st'))
         OR (A.VOCABULARY_ID = 'RxNorm' AND A.CONCEPT_CLASS_ID IN ('Clinical Drug','Ingredient'))
       ))
    OR (:domain_id <> 'Drug')  -- pass-through for non-Drug domains
  )

UNION ALL

/* ---------- DESCENDANTS (A = DESCENDANT) ---------- */
SELECT
  CA.MIN_LEVELS_OF_SEPARATION * -1         AS STEPS_AWAY,
  A.CONCEPT_NAME,
  A.CONCEPT_ID                             AS HIERARCHY_CONCEPT_ID,
  A.VOCABULARY_ID,
  A.CONCEPT_CLASS_ID,
  C.CONCEPT_NAME                           AS ROOT_TERM
FROM CONCEPT C
JOIN CONCEPT_ANCESTOR CA
  ON CA.ANCESTOR_CONCEPT_ID = C.CONCEPT_ID
JOIN CONCEPT A
  ON A.CONCEPT_ID = CA.DESCENDANT_CONCEPT_ID
WHERE
  C.CONCEPT_ID = :concept
  AND A.VOCABULARY_ID IN (
    SELECT COLUMN_VALUE
    FROM TABLE(
      CAST(
        CASE :domain_id
          WHEN 'Condition'   THEN sys.odcivarchar2list('ICD10CM','SNOMED','ICD9CM')
          WHEN 'Observation' THEN sys.odcivarchar2list('ICD10CM','SNOMED','LOINC','CPT4','HCPCS')
          WHEN 'Drug'        THEN sys.odcivarchar2list('RxNorm','NDC','CPT4','CVX','HCPCS','ATC')
          WHEN 'Measurement' THEN sys.odcivarchar2list('LOINC','CPT4','SNOMED','HCPCS')
          WHEN 'Procedure'   THEN sys.odcivarchar2list('CPT4','HCPCS','SNOMED','ICD09PCS','LOINC','ICD10PCS','SNOMED')
          ELSE sys.odcivarchar2list()
        END
        AS sys.odcivarchar2list
      )
    )
  )
  AND (
       (:domain_id = 'Drug' AND (
            /* Descendants focus: keep as originally intended
               (clinical drugs/ingredients) */
            (A.VOCABULARY_ID = 'RxNorm' AND A.CONCEPT_CLASS_ID IN ('Clinical Drug','Ingredient'))
            /* If you also want ATC descendants (rare in practice), add:
               OR (A.VOCABULARY_ID = 'ATC' AND A.CONCEPT_CLASS_ID IN ('ATC 5th','ATC 4th','ATC 3rd','ATC 2nd','ATC 1st'))
            */
       ))
    OR (:domain_id <> 'Drug')
  )

ORDER BY STEPS_AWAY DESC;
