/* **************************************************************
   Step 3 - Build Code Set - ORACLE TEST VERSION
   Input the HIERARCHY_CONCEPT_ID (from Step 2) to build the code set.

   TEST INSTRUCTIONS:
   1. Get a hierarchy_concept_id from Step 2 results
   2. Replace the bind variable values below
   3. Run the entire script in SQL Developer or SQLcl

   NOTE: This script tests with ONE concept. In the app, you can
         add multiple concepts to the shopping cart.
   ************************************************************** */

-- Define bind variables for testing
VARIABLE concept_id NUMBER;
VARIABLE domain_id VARCHAR2(20);
VARIABLE combo VARCHAR2(20);

-- Set test values (CHANGE THESE FOR YOUR TESTS)
BEGIN
  :concept_id := 378427;            -- HIERARCHY_CONCEPT_ID from Step 2
  :domain_id := 'Drug';             -- Domain of the concept
  :combo := 'ALL';                  -- For Drugs: 'ALL', 'SINGLE', or 'COMBINATION'
END;
/

-- Display test parameters
PROMPT ================================================================
PROMPT TEST PARAMETERS:
PROMPT ================================================================
SELECT 'Concept ID: ' || :concept_id AS parameter FROM DUAL
UNION ALL
SELECT 'Domain: ' || :domain_id FROM DUAL
UNION ALL
SELECT 'Combo Filter: ' || :combo FROM DUAL
UNION ALL
SELECT 'Concept Name: ' || CONCEPT_NAME FROM CONCEPT WHERE CONCEPT_ID = :concept_id;

PROMPT
PROMPT ================================================================
PROMPT EXECUTING CODE SET BUILD QUERY...
PROMPT ================================================================
PROMPT
PROMPT This will show all descendant codes mapped from this concept.
PROMPT For Drug domain, you'll see dose forms and combination flags.
PROMPT
PROMPT ================================================================
PROMPT

-- Main query
SELECT
  C.CONCEPT_NAME                      AS ROOT_CONCEPT_NAME,
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
  DFGLBL.dfg_label                    AS DFG_NAME
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
         ELSE sys.odcivarchar2list()
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
LEFT JOIN (
  SELECT
    FRM.CONCEPT_ID AS dose_form_id,
    CASE
      WHEN UPPER(FRM.CONCEPT_NAME) LIKE '%INJECT%' OR UPPER(FRM.CONCEPT_NAME) LIKE '%SYRINGE%' OR UPPER(FRM.CONCEPT_NAME) LIKE '%AUTO-INJECTOR%' OR UPPER(FRM.CONCEPT_NAME) LIKE '%CARTRIDGE%' THEN 'Injectable Product'
      WHEN UPPER(FRM.CONCEPT_NAME) LIKE '%ORAL TABLET%' OR UPPER(FRM.CONCEPT_NAME) LIKE '%TABLET%' OR UPPER(FRM.CONCEPT_NAME) LIKE '%ORAL%' OR UPPER(FRM.CONCEPT_NAME) LIKE '%LOZENGE%' THEN 'Oral'
      WHEN UPPER(FRM.CONCEPT_NAME) LIKE '%BUCCAL%' OR UPPER(FRM.CONCEPT_NAME) LIKE '%SUBLINGUAL%' THEN 'Buccal/Sublingual Product'
      WHEN UPPER(FRM.CONCEPT_NAME) LIKE '%INHAL%' THEN 'Inhalant Product'
      WHEN UPPER(FRM.CONCEPT_NAME) LIKE '%NASAL%' THEN 'Nasal Product'
      WHEN UPPER(FRM.CONCEPT_NAME) LIKE '%OPHTHALMIC%' THEN 'Ophthalmic Product'
      WHEN UPPER(FRM.CONCEPT_NAME) LIKE '%TOPICAL%' THEN 'Topical Product'
      WHEN UPPER(FRM.CONCEPT_NAME) LIKE '%PATCH%' OR UPPER(FRM.CONCEPT_NAME) LIKE '%MEDICATED PAD%' OR UPPER(FRM.CONCEPT_NAME) LIKE '%MEDICATED TAPE%' THEN 'Transdermal/Patch Product'
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
  C.CONCEPT_ID = :concept_id
  AND (
       D.DOMAIN_ID <> 'Drug'
    OR (
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
         )
       )
  )
ORDER BY D.VOCABULARY_ID DESC, CA.MIN_LEVELS_OF_SEPARATION ASC;

PROMPT
PROMPT ================================================================
PROMPT QUERY COMPLETE - Review results above
PROMPT ================================================================
PROMPT
PROMPT Output Columns Explained:
PROMPT   - ROOT_CONCEPT_NAME: The hierarchy concept you selected
PROMPT   - CHILD_VOCABULARY_ID: Source vocabulary (ICD10CM, RxNorm, etc.)
PROMPT   - CHILD_CODE: The actual code from that vocabulary
PROMPT   - CHILD_NAME: Description of the code
PROMPT   - COMBINATIONYESNO: (Drugs only) SINGLE or COMBINATION
PROMPT   - DOSE_FORM: (Drugs only) e.g., "Oral Tablet"
PROMPT   - DFG_NAME: (Drugs only) Grouped category e.g., "Oral", "Injectable"
PROMPT
PROMPT This is your code set! Export or use as needed.
PROMPT ================================================================

-- Show summary by vocabulary
PROMPT
PROMPT ================================================================
PROMPT CODE SET SUMMARY BY VOCABULARY:
PROMPT ================================================================
SELECT
  D.VOCABULARY_ID,
  COUNT(*) AS CODE_COUNT
FROM CONCEPT C
JOIN CONCEPT_ANCESTOR CA
  ON CA.ANCESTOR_CONCEPT_ID = C.CONCEPT_ID
JOIN CONCEPT_RELATIONSHIP CR
  ON CR.CONCEPT_ID_2 = CA.DESCENDANT_CONCEPT_ID
 AND CR.RELATIONSHIP_ID = 'Maps to'
JOIN CONCEPT D
  ON D.CONCEPT_ID = CR.CONCEPT_ID_1
 AND D.DOMAIN_ID  = :domain_id
WHERE
  C.CONCEPT_ID = :concept_id
  AND (
       D.DOMAIN_ID <> 'Drug'
    OR D.CONCEPT_CLASS_ID IN (
         'Clinical Drug','Branded Drug Form','Clinical Drug Form',
         'Quant Branded Drug','Quant Clinical Drug','11-digit NDC'
       )
  )
GROUP BY D.VOCABULARY_ID
ORDER BY COUNT(*) DESC;

PROMPT
PROMPT ================================================================
PROMPT TEST COMPLETE
PROMPT ================================================================
