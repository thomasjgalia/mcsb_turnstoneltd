
/* **************************************************************
   Step 3 — Build Code Set
   Input the HIERARCHY_CONCEPT_ID (from Step 2) to build the code set.
   ************************************************************** */

-- Select database/schema
SET db  = 'UDP_QA_REF_DATA';
SET sch = 'LSMI_OMOP';
USE DATABASE IDENTIFIER($db);
USE SCHEMA   IDENTIFIER($sch);

-- Inputs
SET concept = 378427;           -- HIERARCHY_CONCEPT_ID from Step 2
SET combo   = 'ALL';            -- Used ONLY for Drug lists: 'SINGLE' | 'COMBINATION' | 'ALL'
SET domain_id = (SELECT DOMAIN_ID FROM CONCEPT WHERE CONCEPT_ID = $concept);

-- Build descendants mapped to standard codes with dose-form labeling and combo flag
SELECT
  -- C.CONCEPT_ID AS ROOT_CONCEPT_ID,
  C.CONCEPT_NAME                      AS ROOT_CONCEPT_NAME,
  -- CA.DESCENDANT_CONCEPT_ID,
  D.VOCABULARY_ID                     AS CHILD_VOCABULARY_ID,
  D.CONCEPT_CODE                      AS CHILD_CODE,
  D.CONCEPT_NAME                      AS CHILD_NAME,
  D.CONCEPT_ID                        AS CHILD_CONCEPT_ID,
  D.VOCABULARY_ID                     AS CHILD_VOCABULARY_ID,
  D.CONCEPT_CLASS_ID,
  CASE
    WHEN D.CONCEPT_CLASS_ID = 'Multiple Ingredients' THEN 'COMBINATION'
    ELSE COMBO.COMBINATIONYESNO
  END                                 AS COMBINATIONYESNO,
  FRM.CONCEPT_NAME                    AS DOSE_FORM,
  DFGLBL.dfg_label                    AS dfg_name
FROM CONCEPT C
JOIN CONCEPT_ANCESTOR CA
  ON CA.ANCESTOR_CONCEPT_ID = C.CONCEPT_ID
JOIN CONCEPT_RELATIONSHIP CR
  ON CR.CONCEPT_ID_2 = CA.DESCENDANT_CONCEPT_ID
 AND CR.RELATIONSHIP_ID = 'Maps to'
JOIN CONCEPT D
  ON D.CONCEPT_ID = CR.CONCEPT_ID_1
 AND D.DOMAIN_ID  = $domain_id
 AND D.VOCABULARY_ID IN (
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
LEFT JOIN CONCEPT_RELATIONSHIP F
  ON F.CONCEPT_ID_1   = CA.DESCENDANT_CONCEPT_ID
 AND F.RELATIONSHIP_ID = 'RxNorm has dose form'
LEFT JOIN CONCEPT FRM
  ON FRM.CONCEPT_ID = F.CONCEPT_ID_2

-- Name-based Dose Form Group (DFG) labeling
LEFT JOIN (
  SELECT
    FRM.CONCEPT_ID AS dose_form_id,
    CASE
      -- Injectable Product
      WHEN FRM.CONCEPT_NAME ILIKE '%Inject%' OR FRM.CONCEPT_NAME ILIKE '%Syringe%' OR FRM.CONCEPT_NAME ILIKE '%Auto-Injector%' OR FRM.CONCEPT_NAME ILIKE '%Cartridge%' THEN 'Injectable Product'
      -- Oral
      WHEN FRM.CONCEPT_NAME ILIKE '%Oral Tablet%' OR FRM.CONCEPT_NAME ILIKE '%Tablet%' OR FRM.CONCEPT_NAME ILIKE '%Oral%' OR FRM.CONCEPT_NAME ILIKE '%Lozenge%' THEN 'Oral'
      -- Buccal / Sublingual
      WHEN FRM.CONCEPT_NAME ILIKE '%Buccal%' OR FRM.CONCEPT_NAME ILIKE '%Sublingual%' THEN 'Buccal/Sublingual Product'
      -- Inhalation / Nasal
      WHEN FRM.CONCEPT_NAME ILIKE '%Inhal%' THEN 'Inhalant Product'
      WHEN FRM.CONCEPT_NAME ILIKE '%Nasal%' THEN 'Nasal Product'
      -- Ophthalmic
      WHEN FRM.CONCEPT_NAME ILIKE '%Ophthalmic%' THEN 'Ophthalmic Product'
      -- Topical / Transdermal
      WHEN FRM.CONCEPT_NAME ILIKE '%Topical%' THEN 'Topical Product'
      WHEN FRM.CONCEPT_NAME ILIKE '%Patch%' OR FRM.CONCEPT_NAME ILIKE '%Medicated Pad%' OR FRM.CONCEPT_NAME ILIKE '%Medicated Tape%' THEN 'Transdermal/Patch Product'
      -- Other routes
      WHEN FRM.CONCEPT_NAME ILIKE '%Suppository%' THEN 'Suppository Product'
      WHEN FRM.CONCEPT_NAME ILIKE '%Implant%' OR FRM.CONCEPT_NAME ILIKE '%Intrauterine System%' THEN 'Drug Implant Product'
      WHEN FRM.CONCEPT_NAME ILIKE '%Irrigation%' THEN 'Irrigation Product'
      WHEN FRM.CONCEPT_NAME ILIKE '%Intravesical%' THEN 'Intravesical Product'
      WHEN FRM.CONCEPT_NAME ILIKE '%Intratracheal%' THEN 'Intratracheal Product'
      WHEN FRM.CONCEPT_NAME ILIKE '%Intraperitoneal%' THEN 'Intraperitoneal Product'
      ELSE 'Other'
    END AS dfg_label
  FROM CONCEPT FRM
) DFGLBL
  ON DFGLBL.dose_form_id = FRM.CONCEPT_ID

-- Combination flag (SINGLE vs COMBINATION) derived from number of ingredients
LEFT JOIN (
  SELECT
    CA.DESCENDANT_CONCEPT_ID,
    CASE WHEN COUNT(*) > 1 THEN 'COMBINATION'
         WHEN COUNT(*) = 1 THEN 'SINGLE'
    END AS COMBINATIONYESNO
  FROM CONCEPT_ANCESTOR CA
  JOIN CONCEPT A
    ON A.CONCEPT_ID = CA.ANCESTOR_CONCEPT_ID
  WHERE A.CONCEPT_CLASS_ID = 'Ingredient'
  GROUP BY CA.DESCENDANT_CONCEPT_ID
) COMBO
  ON COMBO.DESCENDANT_CONCEPT_ID = CA.DESCENDANT_CONCEPT_ID

WHERE
  C.CONCEPT_ID = $concept
  AND (
       D.DOMAIN_ID <> 'Drug'
    OR (
         /* Apply combo logic and class filter together for Drug domain */
         (
           UPPER($combo) = 'ALL'
           OR CASE
                WHEN D.CONCEPT_CLASS_ID = 'Multiple Ingredients' THEN 'COMBINATION'
                ELSE COMBO.COMBINATIONYESNO
              END = $combo
         )
         AND D.CONCEPT_CLASS_ID IN (
           'Clinical Drug','Branded Drug Form','Clinical Drug Form',
           'Quant Branded Drug','Quant Clinical Drug','11-digit NDC'
           -- List below found in VNEHR Medication (kept from your original)
           -- 'Clinical Drug','Branded Drug','Quant Clinical Drug','Clinical Pack',
           -- 'Quant Branded Drug','Ingredient','Branded Pack','Dose Form',
           -- 'Clinical Drug Comp','Dose Form Group','Multiple Ingredients','Brand Name',
           -- 'Clinical Drug Form','Precise Ingredient','Branded Drug Comp'
         )
       )
  )
ORDER BY D.VOCABULARY_ID DESC, CA.MIN_LEVELS_OF_SEPARATION ASC;
