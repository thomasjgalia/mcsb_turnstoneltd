
VAR concept NUMBER;
EXEC :concept := 1748921;

/* Bind :concept before running (see VAR/EXEC snippet above) */

SELECT *
FROM (
  /* ========================== PARENTS (A = ANCESTOR) ========================== */
  SELECT
    ca.min_levels_of_separation                    AS steps_away,
    a.concept_name,
    a.concept_id                                   AS hierarchy_concept_id,
    a.vocabulary_id,
    a.concept_class_id,
    c.concept_name                                 AS root_term
  FROM concept c
  JOIN concept_ancestor ca
    ON ca.descendant_concept_id = c.concept_id
  JOIN concept a
    ON a.concept_id = ca.ancestor_concept_id
  /* Resolve domain once, reused below */
  JOIN (
    SELECT LOWER(domain_id) AS dom
    FROM concept
    WHERE concept_id = :concept
  ) d ON 1 = 1
  WHERE c.concept_id = :concept

    /* Domain → vocabulary mapping (replacement for DECODE + ARRAY_CONSTRUCT + FLATTEN) */
    AND a.vocabulary_id IN (
      SELECT m.vocab
      FROM (
        /* Condition */
        SELECT 'condition' AS dom, 'ICD10CM' AS vocab FROM dual UNION ALL
        SELECT 'condition', 'SNOMED'   FROM dual UNION ALL
        SELECT 'condition', 'ICD9CM'   FROM dual UNION ALL
        /* Observation */
        SELECT 'observation', 'ICD10CM' FROM dual UNION ALL
        SELECT 'observation', 'SNOMED'  FROM dual UNION ALL
        SELECT 'observation', 'LOINC'   FROM dual UNION ALL
        SELECT 'observation', 'CPT4'    FROM dual UNION ALL
        SELECT 'observation', 'HCPCS'   FROM dual UNION ALL
        /* Drug */
        SELECT 'drug', 'RxNorm'         FROM dual UNION ALL
        SELECT 'drug', 'NDC'            FROM dual UNION ALL
        SELECT 'drug', 'CPT4'           FROM dual UNION ALL
        SELECT 'drug', 'CVX'            FROM dual UNION ALL
        SELECT 'drug', 'HCPCS'          FROM dual UNION ALL
        SELECT 'drug', 'ATC'            FROM dual UNION ALL
        /* Measurement */
        SELECT 'measurement', 'LOINC'   FROM dual UNION ALL
        SELECT 'measurement', 'CPT4'    FROM dual UNION ALL
        SELECT 'measurement', 'SNOMED'  FROM dual UNION ALL
        SELECT 'measurement', 'HCPCS'   FROM dual UNION ALL
        /* Procedure (keeps your 'ICD09PCS' literal; adjust if your vocab uses 'ICD9Proc') */
        SELECT 'procedure', 'CPT4'      FROM dual UNION ALL
        SELECT 'procedure', 'HCPCS'     FROM dual UNION ALL
        SELECT 'procedure', 'SNOMED'    FROM dual UNION ALL
        SELECT 'procedure', 'ICD09PCS'  FROM dual UNION ALL
        SELECT 'procedure', 'LOINC'     FROM dual UNION ALL
        SELECT 'procedure', 'ICD10PCS'  FROM dual
      ) m
      WHERE m.dom = d.dom
    )

    /* Drug-specific parent filter (expanded ATC 1st–5th; pass-through otherwise) */
    AND (
      d.dom <> 'drug'
      OR (
        (a.vocabulary_id = 'ATC'    AND a.concept_class_id IN ('ATC 5th','ATC 4th','ATC 3rd','ATC 2nd','ATC 1st'))
        OR
        (a.vocabulary_id = 'RxNorm' AND a.concept_class_id IN ('Clinical Drug','Ingredient'))
      )
    )

  UNION ALL

  /* ======================== DESCENDANTS (A = DESCENDANT) ====================== */
  SELECT
    ca.min_levels_of_separation * -1               AS steps_away,
    a.concept_name,
    a.concept_id                                   AS hierarchy_concept_id,
    a.vocabulary_id,
    a.concept_class_id,
    c.concept_name                                 AS root_term
  FROM concept c
  JOIN concept_ancestor ca
    ON ca.ancestor_concept_id = c.concept_id
  JOIN concept a
    ON a.concept_id = ca.descendant_concept_id
  JOIN (
    SELECT LOWER(domain_id) AS dom
    FROM concept
    WHERE concept_id = :concept
  ) d ON 1 = 1
  WHERE c.concept_id = :concept

    /* Apply mapping to the returned concept A (consistent with your note) */
    AND a.vocabulary_id IN (
      SELECT m.vocab
      FROM (
        /* Condition */
        SELECT 'condition' AS dom, 'ICD10CM' AS vocab FROM dual UNION ALL
        SELECT 'condition', 'SNOMED'   FROM dual UNION ALL
        SELECT 'condition', 'ICD9CM'   FROM dual UNION ALL
        /* Observation */
        SELECT 'observation', 'ICD10CM' FROM dual UNION ALL
        SELECT 'observation', 'SNOMED'  FROM dual UNION ALL
        SELECT 'observation', 'LOINC'   FROM dual UNION ALL
        SELECT 'observation', 'CPT4'    FROM dual UNION ALL
        SELECT 'observation', 'HCPCS'   FROM dual UNION ALL
        /* Drug */
        SELECT 'drug', 'RxNorm'         FROM dual UNION ALL
        SELECT 'drug', 'NDC'            FROM dual UNION ALL
        SELECT 'drug', 'CPT4'           FROM dual UNION ALL
        SELECT 'drug', 'CVX'            FROM dual UNION ALL
        SELECT 'drug', 'HCPCS'          FROM dual UNION ALL
        SELECT 'drug', 'ATC'            FROM dual UNION ALL
        /* Measurement */
        SELECT 'measurement', 'LOINC'   FROM dual UNION ALL
        SELECT 'measurement', 'CPT4'    FROM dual UNION ALL
        SELECT 'measurement', 'SNOMED'  FROM dual UNION ALL
        SELECT 'measurement', 'HCPCS'   FROM dual UNION ALL
        /* Procedure */
        SELECT 'procedure', 'CPT4'      FROM dual UNION ALL
        SELECT 'procedure', 'HCPCS'     FROM dual UNION ALL
        SELECT 'procedure', 'SNOMED'    FROM dual UNION ALL
        SELECT 'procedure', 'ICD09PCS'  FROM dual UNION ALL
        SELECT 'procedure', 'LOINC'     FROM dual UNION ALL
        SELECT 'procedure', 'ICD10PCS'  FROM dual
      ) m
      WHERE m.dom = d.dom
    )

    /* Drug-specific descendant filter (RxNorm clinical drugs/ingredients; pass-through otherwise) */
    AND (
      d.dom <> 'drug'
      OR (
        (a.vocabulary_id = 'RxNorm' AND a.concept_class_id IN ('Clinical Drug','Ingredient'))
        /* If you want ATC descendants too (rare), add:
           OR (a.vocabulary_id = 'ATC' AND a.concept_class_id IN ('ATC 5th','ATC 4th','ATC 3rd','ATC 2nd','ATC 1st'))
        */
      )
    )
)
ORDER BY steps_away DESC;
``
