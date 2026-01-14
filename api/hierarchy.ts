// ============================================================================
// API Endpoint: Step 2 - Explore Hierarchy
// ============================================================================
// Vercel Serverless Function
// Endpoint: POST /api/hierarchy
// ============================================================================
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  executeQuery,
  buildVocabularySQL,
  createErrorResponse,
  createSuccessResponse,
} from './lib/oracle.js';

interface HierarchyRequest {
  concept_id: number;
}

interface HierarchyResult {
  steps_away: number;
  concept_name: string;
  hierarchy_concept_id: number;
  vocabulary_id: string;
  concept_class_id: string;
  root_term: string;
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
    const { concept_id } = req.body as HierarchyRequest;

    // Validate input
    if (!concept_id || typeof concept_id !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'Valid concept ID is required',
      });
    }

    // First, get the domain_id for the concept
    const domainSQL = `
      SELECT domain_id AS "domain_id" FROM concept WHERE concept_id = :concept_id
    `;

    const domainResult = await executeQuery<{ domain_id: string }>(domainSQL, {
      concept_id,
    });

    if (domainResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Concept not found',
      });
    }

    const domain_id = domainResult[0].domain_id;

    // Build the main hierarchy query (v3 - using Tom's working approach)
    // The CONCEPT_ANCESTOR table includes self-referential rows (steps_away=0)
    // so we get ancestors + the concept itself in the first query, descendants in the second
    const sql = `
      SELECT
        CA.MIN_LEVELS_OF_SEPARATION              AS "steps_away",
        A.CONCEPT_NAME                           AS "concept_name",
        A.CONCEPT_ID                             AS "hierarchy_concept_id",
        A.VOCABULARY_ID                          AS "vocabulary_id",
        A.CONCEPT_CLASS_ID                       AS "concept_class_id",
        C.CONCEPT_NAME                           AS "root_term"
      FROM CONCEPT C
      JOIN CONCEPT_ANCESTOR CA
        ON CA.DESCENDANT_CONCEPT_ID = C.CONCEPT_ID
      JOIN CONCEPT A
        ON A.CONCEPT_ID = CA.ANCESTOR_CONCEPT_ID
      WHERE
        C.CONCEPT_ID = :concept_id
        AND A.VOCABULARY_ID IN (
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
        AND (
             (:domain_id = 'Drug' AND (
                  (A.VOCABULARY_ID = 'ATC'    AND A.CONCEPT_CLASS_ID IN ('ATC 5th','ATC 4th','ATC 3rd','ATC 2nd','ATC 1st'))
               OR (A.VOCABULARY_ID = 'RxNorm' AND A.CONCEPT_CLASS_ID IN ('Clinical Drug','Ingredient'))
             ))
          OR (:domain_id <> 'Drug')
        )

      UNION

      SELECT
        CA.MIN_LEVELS_OF_SEPARATION * -1         AS "steps_away",
        A.CONCEPT_NAME                           AS "concept_name",
        A.CONCEPT_ID                             AS "hierarchy_concept_id",
        A.VOCABULARY_ID                          AS "vocabulary_id",
        A.CONCEPT_CLASS_ID                       AS "concept_class_id",
        C.CONCEPT_NAME                           AS "root_term"
      FROM CONCEPT C
      JOIN CONCEPT_ANCESTOR CA
        ON CA.ANCESTOR_CONCEPT_ID = C.CONCEPT_ID
      JOIN CONCEPT A
        ON A.CONCEPT_ID = CA.DESCENDANT_CONCEPT_ID
      WHERE
        C.CONCEPT_ID = :concept_id
        AND A.VOCABULARY_ID IN (
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
        AND (
             (:domain_id = 'Drug' AND (
                  (A.VOCABULARY_ID = 'RxNorm' AND A.CONCEPT_CLASS_ID IN ('Clinical Drug','Ingredient'))
             ))
          OR (:domain_id <> 'Drug')
        )

      ORDER BY "steps_away" DESC
    `;

    // Execute query
    const results = await executeQuery<HierarchyResult>(sql, {
      concept_id,
      domain_id,
    });

    return res.status(200).json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error('Hierarchy API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return res.status(500).json({
      success: false,
      error: message,
    });
  }
}
