
/* **************************************************************
   Step 2
   Explore hierarchy around a STANDARD_CONCEPT_ID (from Step 1).
   Pick a HIERARCHY_CONCEPT_ID for Step 3.
   ************************************************************** */

-- Select database/schema
SET db  = 'UDP_QA_REF_DATA';
SET sch = 'LSMI_OMOP';
USE DATABASE IDENTIFIER($db);
USE SCHEMA   IDENTIFIER($sch);

-- Input: STANDARD_CONCEPT_ID from Step 1
SET concept = 1748921;

-- Derive the domain for this concept
SET domain_id = (SELECT domain_id FROM concept WHERE concept_id = $concept);

/* ---------- PARENTS (A = ANCESTOR) ---------- */
SELECT *
FROM (
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
    C.CONCEPT_ID = $concept
    AND A.VOCABULARY_ID IN (
      SELECT value::string
      FROM TABLE(FLATTEN(
        input => DECODE(
          $domain_id,
          'Condition',   ARRAY_CONSTRUCT('ICD10CM','SNOMED','ICD9CM'),
          'Observation', ARRAY_CONSTRUCT('ICD10CM','SNOMED','LOINC','CPT4','HCPCS'),
          'Drug',        ARRAY_CONSTRUCT('RxNorm','NDC','CPT4','CVX','HCPCS','ATC'),
          'Measurement', ARRAY_CONSTRUCT('LOINC','CPT4','SNOMED','HCPCS'),
          'Procedure',   ARRAY_CONSTRUCT('CPT4','HCPCS','SNOMED','ICD09PCS','LOINC','ICD10PCS','SNOMED'),
          /* default (unknown domain) → empty array */
          ARRAY_CONSTRUCT()
        )
      ))
    )
    AND (
         ($domain_id = 'Drug' AND (
              /* Expanded to include ATC 1st–5th so higher-level parents are retained */
              (A.VOCABULARY_ID = 'ATC'    AND A.CONCEPT_CLASS_ID IN ('ATC 5th','ATC 4th','ATC 3rd','ATC 2nd','ATC 1st'))
           OR (A.VOCABULARY_ID = 'RxNorm' AND A.CONCEPT_CLASS_ID IN ('Clinical Drug','Ingredient'))
         ))
      OR ($domain_id <> 'Drug')  -- pass-through for non-Drug domains
    )

  UNION

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
    C.CONCEPT_ID = $concept
    AND A.VOCABULARY_ID IN (
      SELECT value::string
      FROM TABLE(FLATTEN(
        input => DECODE(
          $domain_id,
          'Condition',   ARRAY_CONSTRUCT('ICD10CM','SNOMED','ICD9CM'),
          'Observation', ARRAY_CONSTRUCT('ICD10CM','SNOMED','LOINC','CPT4','HCPCS'),
          'Drug',        ARRAY_CONSTRUCT('RxNorm','NDC','CPT4','CVX','HCPCS','ATC'),
          'Measurement', ARRAY_CONSTRUCT('LOINC','CPT4','SNOMED','HCPCS'),
          'Procedure',   ARRAY_CONSTRUCT('CPT4','HCPCS','SNOMED','ICD09PCS','LOINC','ICD10PCS','SNOMED'),
          ARRAY_CONSTRUCT()
        )
      ))
    )
    AND (
         ($domain_id = 'Drug' AND (
              /* Descendants focus: keep as originally intended
                 (clinical drugs/ingredients) */
              (A.VOCABULARY_ID = 'RxNorm' AND A.CONCEPT_CLASS_ID IN ('Clinical Drug','Ingredient'))
              /* If you also want ATC descendants (rare in practice), add:
                 OR (A.VOCABULARY_ID = 'ATC' AND A.CONCEPT_CLASS_ID IN ('ATC 5th','ATC 4th','ATC 3rd','ATC 2nd','ATC 1st'))
              */
         ))
      OR ($domain_id <> 'Drug')
    )
)
ORDER BY STEPS_AWAY DESC;
