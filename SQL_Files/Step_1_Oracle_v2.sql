/* **************************************************************
   Step 1 - Term Search
   Search for a medical term, code, or concept_id related to the
   code set you want to build (OMOP Concept + Concept_relationship).
   Choose a STANDARD_CONCEPT_ID from the results for Step 2.

   Converted from Snowflake to Oracle
   ************************************************************** */

-- Define search parameters (bind variables for API use)
-- :searchterm  - search term (e.g., 'ritonavir')
-- :domain_id   - medical domain ('Condition', 'Drug', 'Measurement', 'Procedure', 'Observation', 'Device')

SELECT
  S.CONCEPT_NAME               AS STANDARD_NAME,
  S.CONCEPT_ID                 AS STD_CONCEPT_ID,
  S.CONCEPT_CODE               AS STANDARD_CODE,
  S.VOCABULARY_ID              AS STANDARD_VOCABULARY,
  S.CONCEPT_CLASS_ID,
  C.CONCEPT_NAME               AS SEARCH_RESULT,
  C.CONCEPT_CODE               AS SEARCHED_CODE,
  C.CONCEPT_CLASS_ID           AS SEARCHED_CONCEPT_CLASS_ID,
  C.VOCABULARY_ID
FROM CONCEPT C
LEFT JOIN CONCEPT_RELATIONSHIP CR
  ON CR.CONCEPT_ID_1 = C.CONCEPT_ID
 AND CR.RELATIONSHIP_ID = 'Maps to'
LEFT JOIN CONCEPT S
  ON S.CONCEPT_ID = CR.CONCEPT_ID_2
 AND S.STANDARD_CONCEPT = 'S'
WHERE
  /* Case-insensitive text match across id, code, and name */
  UPPER(TO_CHAR(C.CONCEPT_ID) || ' ' || C.CONCEPT_CODE || ' ' || C.CONCEPT_NAME)
    LIKE '%' || UPPER(:searchterm) || '%'

  /* Domain-appropriate vocabularies (inline CASE logic) */
  AND C.VOCABULARY_ID IN (
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

  /* Drug class guard (same as before) */
  AND (
       C.DOMAIN_ID <> 'Drug'
    OR C.CONCEPT_CLASS_ID IN (
         'Clinical Drug','Branded Drug','Ingredient','Clinical Pack','Branded Pack',
         'Quant Clinical Drug','Quant Branded Drug','11-digit NDC'
       )
  )
ORDER BY (LENGTH(:searchterm) - 2 - LENGTH(C.CONCEPT_NAME)) DESC
FETCH FIRST 75 ROWS ONLY;
