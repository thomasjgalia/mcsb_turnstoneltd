// ============================================================================
// API Endpoint: Step 1 - Search Concepts
// ============================================================================
// Vercel Serverless Function
// Endpoint: POST /api/search
// ============================================================================
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  executeQuery,
  buildVocabularySQL,
  createErrorResponse,
  createSuccessResponse,
} from './lib/oracle.js';

interface SearchRequest {
  searchterm: string;
  domain_id: string;
}

interface SearchResult {
  standard_name: string;
  std_concept_id: number;
  standard_code: string;
  standard_vocabulary: string;
  concept_class_id: string;
  search_result: string;
  searched_code: string;
  searched_vocabulary: string;
  searched_concept_class_id: string;
  searched_term: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('=== Search API called ===');
  console.log('Method:', req.method);
  console.log('Oracle Config:', {
    user: process.env.ORACLE_USER,
    hasPassword: !!process.env.ORACLE_PASSWORD,
    connectString: process.env.ORACLE_CONNECTION_STRING,
    walletLocation: process.env.ORACLE_WALLET_LOCATION,
  });

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json(createErrorResponse('Method not allowed', 405));
  }

  try {
    const { searchterm, domain_id } = req.body as SearchRequest;
    console.log('Search params:', { searchterm, domain_id });

    // Validate input
    if (!searchterm || searchterm.trim().length < 2) {
      return res
        .status(400)
        .json(createErrorResponse('Search term must be at least 2 characters', 400));
    }

    if (!domain_id) {
      return res.status(400).json(createErrorResponse('Domain ID is required', 400));
    }

    // Build the SQL query (v3 - improved sorting and added searched_vocabulary)
    const sql = `
      SELECT
        S.CONCEPT_NAME               AS "standard_name",
        S.CONCEPT_ID                 AS "std_concept_id",
        S.CONCEPT_CODE               AS "standard_code",
        S.VOCABULARY_ID              AS "standard_vocabulary",
        S.CONCEPT_CLASS_ID           AS "concept_class_id",
        C.CONCEPT_NAME               AS "search_result",
        C.CONCEPT_CODE               AS "searched_code",
        C.VOCABULARY_ID              AS "searched_vocabulary",
        C.CONCEPT_CLASS_ID           AS "searched_concept_class_id",
        TO_CHAR(C.CONCEPT_ID) || ' ' || C.CONCEPT_CODE || ' ' || C.CONCEPT_NAME AS "searched_term"
      FROM CONCEPT C
      LEFT JOIN CONCEPT_RELATIONSHIP CR
        ON CR.CONCEPT_ID_1 = C.CONCEPT_ID
       AND CR.RELATIONSHIP_ID = 'Maps to'
      LEFT JOIN CONCEPT S
        ON S.CONCEPT_ID = CR.CONCEPT_ID_2
       AND S.STANDARD_CONCEPT = 'S'
      WHERE
        UPPER(TO_CHAR(C.CONCEPT_ID) || ' ' || C.CONCEPT_CODE || ' ' || C.CONCEPT_NAME)
          LIKE '%' || UPPER(:searchterm) || '%'
        AND C.DOMAIN_ID = :domain_id
        AND C.VOCABULARY_ID IN (
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
             C.DOMAIN_ID <> 'Drug'
          OR C.CONCEPT_CLASS_ID IN (
               'Clinical Drug','Branded Drug','Ingredient','Clinical Pack','Branded Pack',
               'Quant Clinical Drug','Quant Branded Drug','11-digit NDC'
             )
        )
        AND (C.INVALID_REASON IS NULL OR C.INVALID_REASON = '')
      ORDER BY ABS(LENGTH(:searchterm) - LENGTH(C.CONCEPT_NAME)) ASC
      FETCH FIRST 75 ROWS ONLY
    `;

    // Execute query
    const results = await executeQuery<SearchResult>(sql, {
      searchterm: searchterm.trim(),
      domain_id,
    });

    console.log('📤 Sending response with', results.length, 'results');
    return res.status(200).json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error('Search API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return res.status(500).json({
      success: false,
      error: message,
    });
  }
}
