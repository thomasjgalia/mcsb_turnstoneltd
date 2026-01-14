/* **************************************************************
   Step 3 — Build Code Set
   Input the HIERARCHY_CONCEPT_ID (from Step 2) to build the code set.

   Converted from Snowflake to Oracle
   ************************************************************** */

-- Define input parameters (bind variables for API use)
-- :concept    - HIERARCHY_CONCEPT_ID from Step 2
-- :combo      - Used ONLY for Drug lists: 'SINGLE' | 'COMBINATION' | 'ALL'
-- :domain_id  - Domain of the concept (derive in application code)

-- Build descendants mapped to standard codes with dose-form labeling and combo flag
SELECT
  -- C.CONCEPT_ID AS ROOT_CONCEPT_ID,
  C.CONCEPT_NAME                      AS ROOT_CONCEPT_NAME,
  -- CA.DESCENDANT_CONCEPT_ID,
  D.VOCABULARY_ID                     AS CHILD_VOCABULARY_ID,
  D.CONCEPT_CODE                      AS CHILD_CODE,
  D.CONCEPT_NAME                      AS CHILD_NAME,
  D.CONCEPT_ID                        AS CHILD_CONCEPT_ID,
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
 AND D.DOMAIN_ID  = :domain_id
 AND D.VOCABULARY_ID IN (
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
      WHEN UPPER(FRM.CONCEPT_NAME) LIKE '%INJECT%' OR UPPER(FRM.CONCEPT_NAME) LIKE '%SYRINGE%' OR UPPER(FRM.CONCEPT_NAME) LIKE '%AUTO-INJECTOR%' OR UPPER(FRM.CONCEPT_NAME) LIKE '%CARTRIDGE%' THEN 'Injectable Product'
      -- Oral
      WHEN UPPER(FRM.CONCEPT_NAME) LIKE '%ORAL TABLET%' OR UPPER(FRM.CONCEPT_NAME) LIKE '%TABLET%' OR UPPER(FRM.CONCEPT_NAME) LIKE '%ORAL%' OR UPPER(FRM.CONCEPT_NAME) LIKE '%LOZENGE%' THEN 'Oral'
      -- Buccal / Sublingual
      WHEN UPPER(FRM.CONCEPT_NAME) LIKE '%BUCCAL%' OR UPPER(FRM.CONCEPT_NAME) LIKE '%SUBLINGUAL%' THEN 'Buccal/Sublingual Product'
      -- Inhalation / Nasal
      WHEN UPPER(FRM.CONCEPT_NAME) LIKE '%INHAL%' THEN 'Inhalant Product'
      WHEN UPPER(FRM.CONCEPT_NAME) LIKE '%NASAL%' THEN 'Nasal Product'
      -- Ophthalmic
      WHEN UPPER(FRM.CONCEPT_NAME) LIKE '%OPHTHALMIC%' THEN 'Ophthalmic Product'
      -- Topical / Transdermal
      WHEN UPPER(FRM.CONCEPT_NAME) LIKE '%TOPICAL%' THEN 'Topical Product'
      WHEN UPPER(FRM.CONCEPT_NAME) LIKE '%PATCH%' OR UPPER(FRM.CONCEPT_NAME) LIKE '%MEDICATED PAD%' OR UPPER(FRM.CONCEPT_NAME) LIKE '%MEDICATED TAPE%' THEN 'Transdermal/Patch Product'
      -- Other routes
      WHEN UPPER(FRM.CONCEPT_NAME) LIKE '%SUPPOSITORY%' THEN 'Suppository Product'
      WHEN UPPER(FRM.CONCEPT_NAME) LIKE '%IMPLANT%' OR UPPER(FRM.CONCEPT_NAME) LIKE '%INTRAUTERINE SYSTEM%' THEN 'Drug Implant Product'
      WHEN UPPER(FRM.CONCEPT_NAME) LIKE '%IRRIGATION%' THEN 'Irrigation Product'
      WHEN UPPER(FRM.CONCEPT_NAME) LIKE '%INTRAVESICAL%' THEN 'Intravesical Product'
      WHEN UPPER(FRM.CONCEPT_NAME) LIKE '%INTRATRACHEAL%' THEN 'Intratracheal Product'
      WHEN UPPER(FRM.CONCEPT_NAME) LIKE '%INTRAPERITONEAL%' THEN 'Intraperitoneal Product'
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
  C.CONCEPT_ID = :concept
  AND (
       D.DOMAIN_ID <> 'Drug'
    OR (
         /* Apply combo logic and class filter together for Drug domain */
         (
           UPPER(:combo) = 'ALL'
           OR CASE
                WHEN D.CONCEPT_CLASS_ID = 'Multiple Ingredients' THEN 'COMBINATION'
                ELSE COMBO.COMBINATIONYESNO
              END = UPPER(:combo)
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
