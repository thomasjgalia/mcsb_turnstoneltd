-- ============================================================================
-- Step 3: Build Code Set Query - ORACLE VERSION
-- ============================================================================
-- Builds comprehensive code set from hierarchy concept(s) in shopping cart
-- Input parameters:
--   - concept: Hierarchy concept ID from Step 2 (e.g., 378427)
--   - combo: 'ALL', 'SINGLE', or 'COMBINATION' (Drug domain only)
-- Output: All descendant codes mapped across vocabularies
--
-- NOTE: For multiple concepts in shopping cart, execute this query multiple
-- times (once per concept) and UNION the results in the application layer
-- ============================================================================
-- CONVERTED FROM POSTGRESQL TO ORACLE SYNTAX
-- Changes:
--   - Replaced ::bigint, ::text with TO_NUMBER(), TO_CHAR()
--   - Replaced ILIKE with UPPER() + LIKE
--   - Simplified CASE expressions for Oracle
--   - Replaced COUNT(*) with COUNT(1) for performance
-- ============================================================================

-- BIND VARIABLES (Replace with actual values in application)
-- Example usage:
-- VARIABLE v_concept NUMBER;
-- VARIABLE v_combo VARCHAR2(20);
-- EXEC :v_concept := 378427;
-- EXEC :v_combo := 'ALL';

WITH params AS (
  SELECT
    378427 AS concept,  -- REPLACE WITH :v_concept in application
    'ALL' AS combo,     -- REPLACE WITH :v_combo in application ('ALL', 'SINGLE', 'COMBINATION')
    (SELECT domain_id FROM concept WHERE concept_id = 378427) AS domain_id
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
),
-- Dose-form to DFG label (name-based classification for Drug domain)
dfg_label AS (
  SELECT
    frm.concept_id AS dose_form_id,
    CASE
      -- Injectable Product
      WHEN UPPER(frm.concept_name) LIKE '%INJECT%' OR UPPER(frm.concept_name) LIKE '%SYRINGE%' OR
           UPPER(frm.concept_name) LIKE '%AUTO-INJECTOR%' OR UPPER(frm.concept_name) LIKE '%CARTRIDGE%'
           THEN 'Injectable Product'
      -- Oral
      WHEN UPPER(frm.concept_name) LIKE '%ORAL TABLET%' OR UPPER(frm.concept_name) LIKE '%TABLET%' OR
           UPPER(frm.concept_name) LIKE '%ORAL%' OR UPPER(frm.concept_name) LIKE '%LOZENGE%'
           THEN 'Oral'
      -- Buccal / Sublingual
      WHEN UPPER(frm.concept_name) LIKE '%BUCCAL%' OR UPPER(frm.concept_name) LIKE '%SUBLINGUAL%'
           THEN 'Buccal/Sublingual Product'
      -- Inhalation / Nasal
      WHEN UPPER(frm.concept_name) LIKE '%INHAL%' THEN 'Inhalant Product'
      WHEN UPPER(frm.concept_name) LIKE '%NASAL%' THEN 'Nasal Product'
      -- Ophthalmic
      WHEN UPPER(frm.concept_name) LIKE '%OPHTHALMIC%' THEN 'Ophthalmic Product'
      -- Topical / Transdermal
      WHEN UPPER(frm.concept_name) LIKE '%TOPICAL%' THEN 'Topical Product'
      WHEN UPPER(frm.concept_name) LIKE '%PATCH%' OR UPPER(frm.concept_name) LIKE '%MEDICATED PAD%' OR
           UPPER(frm.concept_name) LIKE '%MEDICATED TAPE%' THEN 'Transdermal/Patch Product'
      -- Suppository / Implant / Irrigation / Intravesical / Intratracheal / Intraperitoneal
      WHEN UPPER(frm.concept_name) LIKE '%SUPPOSITORY%' THEN 'Suppository Product'
      WHEN UPPER(frm.concept_name) LIKE '%IMPLANT%' OR UPPER(frm.concept_name) LIKE '%INTRAUTERINE SYSTEM%'
           THEN 'Drug Implant Product'
      WHEN UPPER(frm.concept_name) LIKE '%IRRIGATION%' THEN 'Irrigation Product'
      WHEN UPPER(frm.concept_name) LIKE '%INTRAVESICAL%' THEN 'Intravesical Product'
      WHEN UPPER(frm.concept_name) LIKE '%INTRATRACHEAL%' THEN 'Intratracheal Product'
      WHEN UPPER(frm.concept_name) LIKE '%INTRAPERITONEAL%' THEN 'Intraperitoneal Product'
      ELSE 'Other'
    END AS dfg_label
  FROM concept frm
),
-- Combination vs single drug (based on number of Ingredient ancestors)
combo AS (
  SELECT
    ca.descendant_concept_id,
    CASE WHEN COUNT(1) > 1 THEN 'COMBINATION' ELSE 'SINGLE' END AS combinationyesno
  FROM concept_ancestor ca
  JOIN concept a ON a.concept_id = ca.ancestor_concept_id
  WHERE a.concept_class_id = 'Ingredient'
  GROUP BY ca.descendant_concept_id
)
SELECT
  c.concept_name AS root_concept_name,
  d.vocabulary_id AS child_vocabulary_id,
  d.concept_code AS child_code,
  d.concept_name AS child_name,
  d.concept_id AS child_concept_id,
  d.concept_class_id,
  CASE
    WHEN d.concept_class_id = 'Multiple Ingredients' THEN 'COMBINATION'
    ELSE combo.combinationyesno
  END AS combinationyesno,
  frm.concept_name AS dose_form,
  dfg_label.dfg_label AS dfg_name
FROM concept c
JOIN concept_ancestor ca
  ON ca.ancestor_concept_id = c.concept_id
JOIN concept_relationship cr
  ON cr.concept_id_2 = ca.descendant_concept_id
 AND cr.relationship_id = 'Maps to'
JOIN concept d
  ON d.concept_id = cr.concept_id_1
 AND d.domain_id = (SELECT domain_id FROM params)
LEFT JOIN concept_relationship f
  ON f.concept_id_1 = ca.descendant_concept_id
 AND f.relationship_id = 'RxNorm has dose form'
LEFT JOIN concept frm
  ON frm.concept_id = f.concept_id_2
LEFT JOIN dfg_label
  ON dfg_label.dose_form_id = frm.concept_id
LEFT JOIN combo
  ON combo.descendant_concept_id = ca.descendant_concept_id
WHERE c.concept_id = (SELECT concept FROM params)
  AND d.vocabulary_id IN (SELECT vocabulary_id FROM vocab)
  AND (
    -- Non-Drug domains: pass-through (no combo/class filters)
    (SELECT domain_id FROM params) <> 'Drug'
    OR (
      -- Drug domain: apply combo + concept_class_id filters together
      (
        UPPER((SELECT combo FROM params)) = 'ALL'
        OR CASE
             WHEN d.concept_class_id = 'Multiple Ingredients' THEN 'COMBINATION'
             ELSE combo.combinationyesno
           END = UPPER((SELECT combo FROM params))
      )
      AND d.concept_class_id IN (
        'Clinical Drug', 'Branded Drug Form', 'Clinical Drug Form',
        'Quant Branded Drug', 'Quant Clinical Drug', '11-digit NDC'
      )
    )
  )
ORDER BY d.vocabulary_id DESC, ca.min_levels_of_separation ASC;

-- ============================================================================
-- ALTERNATIVE: Parameterized version using bind variables (RECOMMENDED)
-- ============================================================================
-- Use this in your Node.js application with oracledb package
-- ============================================================================

/*
WITH params AS (
  SELECT
    :concept AS concept,
    :combo AS combo,
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
),
dfg_label AS (
  SELECT
    frm.concept_id AS dose_form_id,
    CASE
      WHEN UPPER(frm.concept_name) LIKE '%INJECT%' OR UPPER(frm.concept_name) LIKE '%SYRINGE%' OR
           UPPER(frm.concept_name) LIKE '%AUTO-INJECTOR%' OR UPPER(frm.concept_name) LIKE '%CARTRIDGE%'
           THEN 'Injectable Product'
      WHEN UPPER(frm.concept_name) LIKE '%ORAL TABLET%' OR UPPER(frm.concept_name) LIKE '%TABLET%' OR
           UPPER(frm.concept_name) LIKE '%ORAL%' OR UPPER(frm.concept_name) LIKE '%LOZENGE%'
           THEN 'Oral'
      WHEN UPPER(frm.concept_name) LIKE '%BUCCAL%' OR UPPER(frm.concept_name) LIKE '%SUBLINGUAL%'
           THEN 'Buccal/Sublingual Product'
      WHEN UPPER(frm.concept_name) LIKE '%INHAL%' THEN 'Inhalant Product'
      WHEN UPPER(frm.concept_name) LIKE '%NASAL%' THEN 'Nasal Product'
      WHEN UPPER(frm.concept_name) LIKE '%OPHTHALMIC%' THEN 'Ophthalmic Product'
      WHEN UPPER(frm.concept_name) LIKE '%TOPICAL%' THEN 'Topical Product'
      WHEN UPPER(frm.concept_name) LIKE '%PATCH%' OR UPPER(frm.concept_name) LIKE '%MEDICATED PAD%' OR
           UPPER(frm.concept_name) LIKE '%MEDICATED TAPE%' THEN 'Transdermal/Patch Product'
      WHEN UPPER(frm.concept_name) LIKE '%SUPPOSITORY%' THEN 'Suppository Product'
      WHEN UPPER(frm.concept_name) LIKE '%IMPLANT%' OR UPPER(frm.concept_name) LIKE '%INTRAUTERINE SYSTEM%'
           THEN 'Drug Implant Product'
      WHEN UPPER(frm.concept_name) LIKE '%IRRIGATION%' THEN 'Irrigation Product'
      WHEN UPPER(frm.concept_name) LIKE '%INTRAVESICAL%' THEN 'Intravesical Product'
      WHEN UPPER(frm.concept_name) LIKE '%INTRATRACHEAL%' THEN 'Intratracheal Product'
      WHEN UPPER(frm.concept_name) LIKE '%INTRAPERITONEAL%' THEN 'Intraperitoneal Product'
      ELSE 'Other'
    END AS dfg_label
  FROM concept frm
),
combo AS (
  SELECT
    ca.descendant_concept_id,
    CASE WHEN COUNT(1) > 1 THEN 'COMBINATION' ELSE 'SINGLE' END AS combinationyesno
  FROM concept_ancestor ca
  JOIN concept a ON a.concept_id = ca.ancestor_concept_id
  WHERE a.concept_class_id = 'Ingredient'
  GROUP BY ca.descendant_concept_id
)
SELECT
  c.concept_name AS root_concept_name,
  d.vocabulary_id AS child_vocabulary_id,
  d.concept_code AS child_code,
  d.concept_name AS child_name,
  d.concept_id AS child_concept_id,
  d.concept_class_id,
  CASE
    WHEN d.concept_class_id = 'Multiple Ingredients' THEN 'COMBINATION'
    ELSE combo.combinationyesno
  END AS combinationyesno,
  frm.concept_name AS dose_form,
  dfg_label.dfg_label AS dfg_name
FROM concept c
JOIN concept_ancestor ca ON ca.ancestor_concept_id = c.concept_id
JOIN concept_relationship cr ON cr.concept_id_2 = ca.descendant_concept_id AND cr.relationship_id = 'Maps to'
JOIN concept d ON d.concept_id = cr.concept_id_1 AND d.domain_id = (SELECT domain_id FROM params)
LEFT JOIN concept_relationship f ON f.concept_id_1 = ca.descendant_concept_id AND f.relationship_id = 'RxNorm has dose form'
LEFT JOIN concept frm ON frm.concept_id = f.concept_id_2
LEFT JOIN dfg_label ON dfg_label.dose_form_id = frm.concept_id
LEFT JOIN combo ON combo.descendant_concept_id = ca.descendant_concept_id
WHERE c.concept_id = :concept
  AND d.vocabulary_id IN (SELECT vocabulary_id FROM vocab)
  AND (
    (SELECT domain_id FROM params) <> 'Drug'
    OR (
      (
        UPPER(:combo) = 'ALL'
        OR CASE WHEN d.concept_class_id = 'Multiple Ingredients' THEN 'COMBINATION' ELSE combo.combinationyesno END = UPPER(:combo)
      )
      AND d.concept_class_id IN ('Clinical Drug', 'Branded Drug Form', 'Clinical Drug Form', 'Quant Branded Drug', 'Quant Clinical Drug', '11-digit NDC')
    )
  )
ORDER BY d.vocabulary_id DESC, ca.min_levels_of_separation ASC;
*/
