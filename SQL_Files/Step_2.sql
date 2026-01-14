
-- PARAMETERS: change as needed
WITH params AS (
  SELECT
    1748921::bigint AS concept,                                 -- STANDARD_CONCEPT_ID
    (SELECT domain_id FROM concept WHERE concept_id = 1748921) AS domain_id
),
vocab AS (
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
    CASE WHEN (SELECT domain_id FROM params) = 'Procedure'   THEN 'ICD09PCS' END,
    CASE WHEN (SELECT domain_id FROM params) = 'Procedure'   THEN 'LOINC'   END,
    CASE WHEN (SELECT domain_id FROM params) = 'Procedure'   THEN 'ICD10PCS' END,
    CASE WHEN (SELECT domain_id FROM params) = 'Procedure'   THEN 'SNOMED'  END
  ]) AS vocabulary_id
)
SELECT *
FROM (
  -- Parents (ancestors): steps away are positive
  SELECT
    ca.min_levels_of_separation            AS steps_away,
    a.concept_name,
    a.concept_id                           AS hierarchy_concept_id,
    a.vocabulary_id,
    a.concept_class_id,
    c.concept_name                         AS root_term
  FROM concept c
  JOIN concept_ancestor ca
    ON ca.descendant_concept_id = c.concept_id
  JOIN concept a
    ON a.concept_id = ca.ancestor_concept_id
  WHERE c.concept_id = (SELECT concept FROM params)
    AND a.vocabulary_id IN (SELECT vocabulary_id FROM vocab WHERE vocabulary_id IS NOT NULL)
    AND (
      ((SELECT domain_id FROM params) = 'Drug' AND (
        (a.vocabulary_id = 'ATC'    AND a.concept_class_id IN ('ATC 5th', 'ATC 4th'))
        OR
        (a.vocabulary_id = 'RxNorm' AND a.concept_class_id IN ('Clinical Drug','Ingredient'))
      )))
      OR ((SELECT domain_id FROM params) <> 'Drug')   -- pass-through for non-Drug domains
    )

  UNION ALL

  -- Children (descendants): steps away are negative
  SELECT
    ca.min_levels_of_separation * -1       AS steps_away,
    a.concept_name,
    a.concept_id                           AS hierarchy_concept_id,
    a.vocabulary_id,
    a.concept_class_id,
    c.concept_name                         AS root_term
  FROM concept c
  JOIN concept_ancestor ca
    ON ca.ancestor_concept_id = c.concept_id
  JOIN concept a
    ON a.concept_id = ca.descendant_concept_id
  WHERE c.concept_id = (SELECT concept FROM params)
    AND c.vocabulary_id IN (SELECT vocabulary_id FROM vocab WHERE vocabulary_id IS NOT NULL)
    AND (
      ((SELECT domain_id FROM params) = 'Drug' AND (
        (a.vocabulary_id = 'ATC'    AND a.concept_class_id IN ('ATC 5th', 'ATC 4th'))
        OR
        (a.vocabulary_id = 'RxNorm' AND a.concept_class_id IN ('Clinical Drug','Ingredient'))
      )))
      OR ((SELECT domain_id FROM params) <> 'Drug')   -- pass-through for non-Drug domains
    )
) t
ORDER BY steps_away DESC;
