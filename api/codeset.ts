// ============================================================================
// API Endpoint: Step 3 - Build Code Set
// ============================================================================
// Vercel Serverless Function
// Endpoint: POST /api/codeset
// ============================================================================
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  executeQuery,
  createErrorResponse,
} from './lib/azuresql.js';

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
      const domainSQL = `SELECT domain_id FROM concept WHERE concept_id = @concept_id`;
      const domainResult = await executeQuery<{ domain_id: string }>(domainSQL, {
        concept_id: conceptId,
      });

      if (domainResult.length === 0) {
        console.warn(`Concept ${conceptId} not found, skipping`);
        continue;
      }

      const domain_id = domainResult[0].domain_id;

      // Build vocabulary IN clause based on domain
      let vocabularyList: string;
      switch (domain_id) {
        case 'Condition':
          vocabularyList = "('ICD10CM','SNOMED','ICD9CM')";
          break;
        case 'Observation':
          vocabularyList = "('ICD10CM','SNOMED','LOINC','CPT4','HCPCS')";
          break;
        case 'Drug':
          vocabularyList = "('RxNorm','NDC','CPT4','CVX','HCPCS','ATC')";
          break;
        case 'Measurement':
          vocabularyList = "('LOINC','CPT4','SNOMED','HCPCS')";
          break;
        case 'Procedure':
          vocabularyList = "('CPT4','HCPCS','SNOMED','ICD09PCS','LOINC','ICD10PCS')";
          break;
        default:
          vocabularyList = "('')";
      }

      // Build the code set query (v2 - enhanced dose form grouping and combo logic)
      const sql = `
        SELECT
          c.concept_name                      AS root_concept_name,
          d.vocabulary_id                     AS child_vocabulary_id,
          d.concept_code                      AS child_code,
          d.concept_name                      AS child_name,
          d.concept_id                        AS child_concept_id,
          d.concept_class_id                  AS concept_class_id,
          CASE
            WHEN d.concept_class_id = 'Multiple Ingredients' THEN 'COMBINATION'
            ELSE combo.combinationyesno
          END                                 AS combinationyesno,
          frm.concept_name                    AS dose_form,
          dfglbl.dfg_label                    AS dfg_name
        FROM concept c
        JOIN concept_ancestor ca
          ON ca.ancestor_concept_id = c.concept_id
        JOIN concept_relationship cr
          ON cr.concept_id_2 = ca.descendant_concept_id
         AND cr.relationship_id = 'Maps to'
        JOIN concept d
          ON d.concept_id = cr.concept_id_1
         AND d.domain_id  = @domain_id
         AND d.vocabulary_id IN ${vocabularyList}
        LEFT JOIN concept_relationship f
          ON f.concept_id_1   = ca.descendant_concept_id
         AND f.relationship_id = 'RxNorm has dose form'
        LEFT JOIN concept frm
          ON frm.concept_id = f.concept_id_2
        LEFT JOIN (
          SELECT
            frm.concept_id AS dose_form_id,
            CASE
              WHEN UPPER(frm.concept_name) LIKE '%INJECT%' OR UPPER(frm.concept_name) LIKE '%SYRINGE%' OR UPPER(frm.concept_name) LIKE '%AUTO-INJECTOR%' OR UPPER(frm.concept_name) LIKE '%CARTRIDGE%' THEN 'Injectable Product'
              WHEN UPPER(frm.concept_name) LIKE '%ORAL TABLET%' OR UPPER(frm.concept_name) LIKE '%TABLET%' OR UPPER(frm.concept_name) LIKE '%ORAL%' OR UPPER(frm.concept_name) LIKE '%LOZENGE%' THEN 'Oral'
              WHEN UPPER(frm.concept_name) LIKE '%BUCCAL%' OR UPPER(frm.concept_name) LIKE '%SUBLINGUAL%' THEN 'Buccal/Sublingual Product'
              WHEN UPPER(frm.concept_name) LIKE '%INHAL%' THEN 'Inhalant Product'
              WHEN UPPER(frm.concept_name) LIKE '%NASAL%' THEN 'Nasal Product'
              WHEN UPPER(frm.concept_name) LIKE '%OPHTHALMIC%' THEN 'Ophthalmic Product'
              WHEN UPPER(frm.concept_name) LIKE '%TOPICAL%' THEN 'Topical Product'
              WHEN UPPER(frm.concept_name) LIKE '%PATCH%' OR UPPER(frm.concept_name) LIKE '%MEDICATED PAD%' OR UPPER(frm.concept_name) LIKE '%MEDICATED TAPE%' THEN 'Transdermal/Patch Product'
              WHEN UPPER(frm.concept_name) LIKE '%SUPPOSITORY%' THEN 'Suppository Product'
              WHEN UPPER(frm.concept_name) LIKE '%IMPLANT%' OR UPPER(frm.concept_name) LIKE '%INTRAUTERINE SYSTEM%' THEN 'Drug Implant Product'
              WHEN UPPER(frm.concept_name) LIKE '%IRRIGATION%' THEN 'Irrigation Product'
              WHEN UPPER(frm.concept_name) LIKE '%INTRAVESICAL%' THEN 'Intravesical Product'
              WHEN UPPER(frm.concept_name) LIKE '%INTRATRACHEAL%' THEN 'Intratracheal Product'
              WHEN UPPER(frm.concept_name) LIKE '%INTRAPERITONEAL%' THEN 'Intraperitoneal Product'
              ELSE 'Other'
            END AS dfg_label
          FROM concept frm
        ) dfglbl
          ON dfglbl.dose_form_id = frm.concept_id
        LEFT JOIN (
          SELECT
            ca.descendant_concept_id,
            CASE WHEN COUNT(*) > 1 THEN 'COMBINATION'
                 WHEN COUNT(*) = 1 THEN 'SINGLE'
            END AS combinationyesno
          FROM concept_ancestor ca
          JOIN concept a
            ON a.concept_id = ca.ancestor_concept_id
          WHERE a.concept_class_id = 'Ingredient'
          GROUP BY ca.descendant_concept_id
        ) combo
          ON combo.descendant_concept_id = ca.descendant_concept_id
        WHERE
          c.concept_id = @concept_id
          AND (
               d.domain_id <> 'Drug'
            OR (
                 (
                   UPPER(@combo) = 'ALL'
                   OR CASE
                        WHEN d.concept_class_id = 'Multiple Ingredients' THEN 'COMBINATION'
                        ELSE combo.combinationyesno
                      END = UPPER(@combo)
                 )
                 AND d.concept_class_id IN (
                   'Clinical Drug','Branded Drug Form','Clinical Drug Form',
                   'Quant Branded Drug','Quant Clinical Drug','11-digit NDC'
                 )
               )
          )
        ORDER BY d.vocabulary_id DESC, ca.min_levels_of_separation ASC
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
