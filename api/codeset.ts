// ============================================================================
// API Endpoint: Step 3 - Build Code Set
// ============================================================================
// Vercel Serverless Function
// Endpoint: POST /api/codeset
// ============================================================================
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  executeQuery,
  buildVocabularySQL,
  createErrorResponse,
  createSuccessResponse,
} from './lib/oracle';

interface CodeSetRequest {
  concept_ids: number[];
  combo_filter?: 'ALL' | 'SINGLE' | 'COMBINATION';
}

interface CodeSetResult {
  root_concept_name: string;
  child_vocabulary_id: string;
  child_code: string;
  child_name: string;
  child_concept_id: number;
  concept_class_id: string;
  combinationyesno?: string;
  dose_form?: string;
  dfg_name?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json(createErrorResponse('Method not allowed', 405));
  }

  try {
    const { concept_ids, combo_filter = 'ALL' } = req.body as CodeSetRequest;

    // Validate input
    if (!concept_ids || !Array.isArray(concept_ids) || concept_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one concept ID is required',
      });
    }

    // Execute query for each concept and combine results
    const allResults: CodeSetResult[] = [];

    for (const conceptId of concept_ids) {
      // Get domain for this concept
      const domainSQL = `SELECT domain_id AS "domain_id" FROM concept WHERE concept_id = :concept_id`;
      const domainResult = await executeQuery<{ domain_id: string }>(domainSQL, {
        concept_id: conceptId,
      });

      if (domainResult.length === 0) {
        console.warn(`Concept ${conceptId} not found, skipping`);
        continue;
      }

      const domain_id = domainResult[0].domain_id;

      // Build the code set query (v2 - enhanced dose form grouping and combo logic)
      const sql = `
        SELECT
          C.CONCEPT_NAME                      AS "root_concept_name",
          D.VOCABULARY_ID                     AS "child_vocabulary_id",
          D.CONCEPT_CODE                      AS "child_code",
          D.CONCEPT_NAME                      AS "child_name",
          D.CONCEPT_ID                        AS "child_concept_id",
          D.CONCEPT_CLASS_ID                  AS "concept_class_id",
          CASE
            WHEN D.CONCEPT_CLASS_ID = 'Multiple Ingredients' THEN 'COMBINATION'
            ELSE COMBO.COMBINATIONYESNO
          END                                 AS "combinationyesno",
          FRM.CONCEPT_NAME                    AS "dose_form",
          DFGLBL.dfg_label                    AS "dfg_name"
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
        ORDER BY D.VOCABULARY_ID DESC, CA.MIN_LEVELS_OF_SEPARATION ASC
      `;

      const results = await executeQuery<CodeSetResult>(sql, {
        concept_id: conceptId,
        domain_id,
        combo: combo_filter,
      });
      allResults.push(...results);
    }

    return res.status(200).json({
      success: true,
      data: allResults,
    });
  } catch (error) {
    console.error('Code set API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return res.status(500).json({
      success: false,
      error: message,
    });
  }
}
