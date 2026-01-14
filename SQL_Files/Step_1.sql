
-- PARAMETERS: change as needed
WITH params AS (
  SELECT
    'ritonavir'::text AS searchterm,
    'Drug'::text     AS domain_id
),
vocab AS (
  -- Build the vocabulary list for the chosen domain
  SELECT unnest(ARRAY[
    CASE WHEN (SELECT domain_id FROM params) = 'Condition'   THEN 'ICD10CM' END,
    CASE WHEN (SELECT domain_id FROM params) = 'Condition'   THEN 'SNOMED'  END,
    CASE WHEN (SELECT domain_id FROM params) = 'Condition'   THEN 'ICD9CM'  END,

    CASE WHEN (SELECT domain_id FROM params) = 'Observation' THEN 'ICD10CM' END,
    CASE WHEN (SELECT domain_id FROM params) = 'Observation' THEN 'SNOMED'  END,
    CASE WHEN (SELECT domain_id FROM params) = 'Observation' THEN 'LOINC'   END,
    CASE WHEN (SELECT domain_id FROM params) = 'Observation' THEN 'CPT4'    END,
    CASE WHEN (SELECT domain_id FROM params) = 'Observation' THEN 'HCPCS'   END,

    CASE WHEN (SELECT domain_id FROM params) = 'Drug'        THEN 'RxNorm'  END,
    CASE WHEN (SELECT domain_id FROM params) = 'Drug'        THEN 'NDC'     END,
    CASE WHEN (SELECT domain_id FROM params) = 'Drug'        THEN 'CPT4'    END,
    CASE WHEN (SELECT domain_id FROM params) = 'Drug'        THEN 'CVX'     END,
    CASE WHEN (SELECT domain_id FROM params) = 'Drug'        THEN 'HCPCS'   END,
    CASE WHEN (SELECT domain_id FROM params) = 'Drug'        THEN 'ATC'     END,

    CASE WHEN (SELECT domain_id FROM params) = 'Measurement' THEN 'LOINC'   END,
    CASE WHEN (SELECT domain_id FROM params) = 'Measurement' THEN 'CPT4'    END,
    CASE WHEN (SELECT domain_id FROM params) = 'Measurement' THEN 'SNOMED'  END,
    CASE WHEN (SELECT domain_id FROM params) = 'Measurement' THEN 'HCPCS'   END,

    CASE WHEN (SELECT domain_id FROM params) = 'Procedure'   THEN 'CPT4'    END,
    CASE WHEN (SELECT domain_id FROM params) = 'Procedure'   THEN 'HCPCS'   END,
    CASE WHEN (SELECT domain_id FROM params) = 'Procedure'   THEN 'SNOMED'  END,
    CASE WHEN (SELECT domain_id FROM params) = 'Procedure'   THEN 'ICD09PCS' END,  -- keep as in source
    CASE WHEN (SELECT domain_id FROM params) = 'Procedure'   THEN 'LOINC'   END,
    CASE WHEN (SELECT domain_id FROM params) = 'Procedure'   THEN 'ICD10PCS' END,
    CASE WHEN (SELECT domain_id FROM params) = 'Procedure'   THEN 'SNOMED'  END
  ]) AS vocabulary_id
)
SELECT
  s.concept_name         AS standard_name,
  s.concept_id           AS std_concept_id,
  s.concept_code         AS standard_code,
  s.vocabulary_id        AS standard_vocabulary,
  s.concept_class_id,
  c.concept_name         AS search_result,
  c.concept_code         AS searched_code,
  c.concept_class_id     AS searched_concept_class_id,
  c.vocabulary_id
FROM concept c
LEFT JOIN concept_relationship cr
  ON cr.concept_id_1 = c.concept_id
 AND cr.relationship_id = 'Maps to'
LEFT JOIN concept s
  ON s.concept_id = cr.concept_id_2
 AND s.standard_concept = 'S'
WHERE (
    -- case-insensitive match across id, code, and name
    (c.concept_id::text || ' ' || c.concept_code || ' ' || c.concept_name)
      ILIKE '%' || (SELECT searchterm FROM params) || '%'
  )
  AND c.vocabulary_id IN (SELECT vocabulary_id FROM vocab WHERE vocabulary_id IS NOT NULL)
  AND c.domain_id = (SELECT domain_id FROM params)
  AND (
    c.domain_id <> 'Drug'
    OR c.concept_class_id IN (
      'Clinical Drug','Branded Drug','Ingredient','Clinical Pack','Branded Pack',
      'Quant Clinical Drug','Quant Branded Drug','11-digit NDC'
    )
  )
ORDER BY (length((SELECT searchterm FROM params)) - 2 - length(c.concept_name)) DESC
LIMIT 75;
