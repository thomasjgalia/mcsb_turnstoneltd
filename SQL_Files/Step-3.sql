
-- PARAMETERS: change as needed
WITH params AS (
  SELECT
    378427::bigint AS concept,                                 -- HIERARCHY_CONCEPT_ID
    'ALL'::text     AS combo,                                   -- 'ALL' | 'SINGLE' | 'COMBINATION' (Drug domain only)
    (SELECT domain_id FROM concept WHERE concept_id = 378427) AS domain_id
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
),
-- Dose-form to DFG label (name-based)
dfg_label AS (
  SELECT
    frm.concept_id AS dose_form_id,
    CASE
      -- Injectable Product
      WHEN frm.concept_name ILIKE '%Inject%' OR frm.concept_name ILIKE '%Syringe%' OR
           frm.concept_name ILIKE '%Auto-Injector%' OR frm.concept_name ILIKE '%Cartridge%'         THEN 'Injectable Product'
      -- Oral
      WHEN frm.concept_name ILIKE '%Oral Tablet%' OR frm.concept_name ILIKE '%Tablet%' OR
           frm.concept_name ILIKE '%Oral%' OR frm.concept_name ILIKE '%Lozenge%'                    THEN 'Oral'
      -- Buccal / Sublingual
      WHEN frm.concept_name ILIKE '%Buccal%' OR frm.concept_name ILIKE '%Sublingual%'               THEN 'Buccal/Sublingual Product'
      -- Inhalation / Nasal
      WHEN frm.concept_name ILIKE '%Inhal%'                                                         THEN 'Inhalant Product'
      WHEN frm.concept_name ILIKE '%Nasal%'                                                         THEN 'Nasal Product'
      -- Ophthalmic
      WHEN frm.concept_name ILIKE '%Ophthalmic%'                                                    THEN 'Ophthalmic Product'
      -- Topical / Transdermal
      WHEN frm.concept_name ILIKE '%Topical%'                                                       THEN 'Topical Product'
      WHEN frm.concept_name ILIKE '%Patch%' OR frm.concept_name ILIKE '%Medicated Pad%' OR
           frm.concept_name ILIKE '%Medicated Tape%'                                               THEN 'Transdermal/Patch Product'
      -- Suppository / Implant / Irrigation / Intravesical / Intratracheal / Intraperitoneal
      WHEN frm.concept_name ILIKE '%Suppository%'                                                   THEN 'Suppository Product'
      WHEN frm.concept_name ILIKE '%Implant%' OR frm.concept_name ILIKE '%Intrauterine System%'     THEN 'Drug Implant Product'
      WHEN frm.concept_name ILIKE '%Irrigation%'                                                    THEN 'Irrigation Product'
      WHEN frm.concept_name ILIKE '%Intravesical%'                                                  THEN 'Intravesical Product'
      WHEN frm.concept_name ILIKE '%Intratracheal%'                                                 THEN 'Intratracheal Product'
      WHEN frm.concept_name ILIKE '%Intraperitoneal%'                                               THEN 'Intraperitoneal Product'
      ELSE 'Other'
    END AS dfg_label
  FROM concept frm
),
-- Combination vs single (based on number of Ingredient ancestors)
combo AS (
  SELECT
    ca.descendant_concept_id,
    CASE WHEN COUNT(*) > 1 THEN 'COMBINATION' ELSE 'SINGLE' END AS combinationyesno
  FROM concept_ancestor ca
  JOIN concept a
    ON a.concept_id = ca.ancestor_concept_id
  WHERE a.concept_class_id = 'Ingredient'
  GROUP BY ca.descendant_concept_id
)
SELECT
  c.concept_name                       AS root_concept_name,
  d.vocabulary_id                      AS child_vocabulary_id,
  d.concept_code                       AS child_code,
  d.concept_name                       AS child_name,
  d.concept_id                         AS child_concept_id,
  d.concept_class_id,
  CASE
    WHEN d.concept_class_id = 'Multiple Ingredients' THEN 'COMBINATION'
    ELSE combo.combinationyesno
  END                                  AS combinationyesno,
  frm.concept_name                     AS dose_form,
  dfg_label.dfg_label                  AS dfg_name
FROM concept c
JOIN concept_ancestor ca
  ON ca.ancestor_concept_id = c.concept_id
JOIN concept_relationship cr
  ON cr.concept_id_2  = ca.descendant_concept_id
 AND cr.relationship_id = 'Maps to'
JOIN concept d
  ON d.concept_id     = cr.concept_id_1
 AND d.domain_id      = (SELECT domain_id FROM params)
LEFT JOIN concept_relationship f
  ON f.concept_id_1   = ca.descendant_concept_id
 AND f.relationship_id = 'RxNorm has dose form'
LEFT JOIN concept frm
  ON frm.concept_id   = f.concept_id_2
LEFT JOIN dfg_label
  ON dfg_label.dose_form_id = frm.concept_id
LEFT JOIN combo
  ON combo.descendant_concept_id = ca.descendant_concept_id
WHERE c.concept_id = (SELECT concept FROM params)
  AND d.vocabulary_id IN (SELECT vocabulary_id FROM vocab WHERE vocabulary_id IS NOT NULL)
  AND (
    -- Non-Drug domains: pass-through (no combo/class filters)
    ( (SELECT domain_id FROM params) <> 'Drug' )
    OR (
      -- Drug domain: apply combo + concept_class_id filters together
      (
        upper((SELECT combo FROM params)) = 'ALL'
        OR CASE
             WHEN d.concept_class_id = 'Multiple Ingredients' THEN 'COMBINATION'
             ELSE combo.combinationyesno
           END = (SELECT combo FROM params)
      )
      AND d.concept_class_id IN (
        'Clinical Drug','Branded Drug Form','Clinical Drug Form',
        'Quant Branded Drug','Quant Clinical Drug','11-digit NDC'
        -- Other classes (from your notes) can be added back if needed:
        -- 'Clinical Drug','Branded Drug','Quant Clinical Drug','Clinical Pack','Quant Branded Drug','Ingredient','Branded Pack','Dose Form'
        -- 'Clinical Drug Comp','Dose Form Group','Multiple Ingredients','Brand Name','Clinical Drug Form','Precise Ingredient','Branded Drug Comp'
      )
    )
  )
ORDER BY d.vocabulary_id DESC, ca.min_levels_of_separation ASC;
