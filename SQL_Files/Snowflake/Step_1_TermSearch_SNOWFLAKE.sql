
/* **************************************************************
   Step 1
   Search for a medical term, code, or concept_id related to the
   code set you want to build (OMOP Concept + Concept_relationship).
   Choose a STANDARD_CONCEPT_ID from the results for Step 2.
   ************************************************************** */

-- Select database/schema
SET db  = 'UDP_QA_REF_DATA';
SET sch = 'LSMI_OMOP';
USE DATABASE IDENTIFIER($db);
USE SCHEMA   IDENTIFIER($sch);

-- Define a starting point for the search (term/code/concept_id fragment)
SET searchterm = 'ritonavir';

-- Define the medical domain of interest:
-- 'Condition', 'Drug', 'Measurement', 'Procedure', 'Observation', 'Device', ...
SET domain_id = 'Drug';

SELECT
  S.CONCEPT_NAME               AS Standard_NAME,
  S.CONCEPT_ID                 AS STD_CONCEPT_ID,
  S.CONCEPT_CODE               AS STANDARD_CODE,
  S.VOCABULARY_ID              AS STANDARD_VOCABULARY,
  S.CONCEPT_CLASS_ID,
  C.CONCEPT_NAME               AS Search_Result,
  C.CONCEPT_CODE               AS Searched_Code,
  C.CONCEPT_CLASS_ID           AS Searched_Concept_CLASS_ID,
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
  (TO_CHAR(C.CONCEPT_ID) || ' ' || C.CONCEPT_CODE || ' ' || C.CONCEPT_NAME)
    ILIKE '%' || $searchterm || '%'

  /* Domain-appropriate vocabularies (inline, no CTE) */
  AND C.VOCABULARY_ID IN (
    SELECT value::string
    FROM TABLE(FLATTEN(
      input => DECODE(
        $domain_id,
        'Condition',   ARRAY_CONSTRUCT('ICD10CM','SNOMED','ICD9CM'),
        'Observation', ARRAY_CONSTRUCT('ICD10CM','SNOMED','LOINC','CPT4','HCPCS'),
        'Drug',        ARRAY_CONSTRUCT('RxNorm','NDC','CPT4','CVX','HCPCS','ATC'),
        'Measurement', ARRAY_CONSTRUCT('LOINC','CPT4','SNOMED','HCPCS'),
        'Procedure',   ARRAY_CONSTRUCT('CPT4','HCPCS','SNOMED','ICD09PCS','LOINC','ICD10PCS','SNOMED'),
        /* default (unknown domain) → empty array to return no vocabularies */
        ARRAY_CONSTRUCT()
      )
    ))
  )

  /* Keep your Drug class guard exactly as before */
  AND (
       C.DOMAIN_ID <> 'Drug'
    OR C.CONCEPT_CLASS_ID IN (
         'Clinical Drug','Branded Drug','Ingredient','Clinical Pack','Branded Pack',
         'Quant Clinical Drug','Quant Branded Drug','11-digit NDC'
       )
  )
ORDER BY (LEN($searchterm) - 2 - LEN(C.CONCEPT_NAME)) DESC
LIMIT 75;