/* **************************************************************
   Step 2 - Explore Hierarchy - ORACLE TEST VERSION
   Explore hierarchy around a STANDARD_CONCEPT_ID (from Step 1).
   Pick a HIERARCHY_CONCEPT_ID for Step 3.

   TEST INSTRUCTIONS:
   1. Get a concept_id from Step 1 results
   2. Replace the bind variable values below
   3. Run the entire script in SQL Developer or SQLcl
   ************************************************************** */

-- Define bind variables for testing
VARIABLE concept_id NUMBER;
VARIABLE domain_id VARCHAR2(20);

-- Set test values (CHANGE THESE FOR YOUR TESTS)
BEGIN
  :concept_id := 1748921;           -- CONCEPT_ID from Step 1 (e.g., ritonavir = 1748921)
  :domain_id := 'Drug';             -- Domain of the concept ('Condition', 'Drug', etc.)
END;
/

-- Display test parameters
PROMPT ================================================================
PROMPT TEST PARAMETERS:
PROMPT ================================================================
SELECT 'Concept ID: ' || :concept_id AS parameter FROM DUAL
UNION ALL
SELECT 'Domain: ' || :domain_id FROM DUAL
UNION ALL
SELECT 'Concept Name: ' || CONCEPT_NAME FROM CONCEPT WHERE CONCEPT_ID = :concept_id;

PROMPT
PROMPT ================================================================
PROMPT EXECUTING HIERARCHY QUERY...
PROMPT ================================================================
PROMPT
PROMPT Positive STEPS_AWAY = Parents (Ancestors)
PROMPT Negative STEPS_AWAY = Children (Descendants)
PROMPT
PROMPT ================================================================
PROMPT

-- Main query
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
  C.CONCEPT_ID = :concept_id
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
            (A.VOCABULARY_ID = 'ATC'    AND A.CONCEPT_CLASS_ID IN ('ATC 5th','ATC 4th','ATC 3rd','ATC 2nd','ATC 1st'))
         OR (A.VOCABULARY_ID = 'RxNorm' AND A.CONCEPT_CLASS_ID IN ('Clinical Drug','Ingredient'))
       ))
    OR (:domain_id <> 'Drug')
  )

UNION ALL

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
  C.CONCEPT_ID = :concept_id
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
            (A.VOCABULARY_ID = 'RxNorm' AND A.CONCEPT_CLASS_ID IN ('Clinical Drug','Ingredient'))
       ))
    OR (:domain_id <> 'Drug')
  )

ORDER BY STEPS_AWAY DESC;

PROMPT
PROMPT ================================================================
PROMPT QUERY COMPLETE - Review results above
PROMPT ================================================================
PROMPT
PROMPT Interpretation:
PROMPT   - Positive STEPS_AWAY = Ancestors (broader concepts)
PROMPT   - Negative STEPS_AWAY = Descendants (narrower concepts)
PROMPT   - 0 steps = The concept itself
PROMPT
PROMPT Next Step: Pick one or more HIERARCHY_CONCEPT_ID values
PROMPT           and use them in Step 3 (TEST_Step_3_Oracle_v2.sql)
PROMPT ================================================================
