// ============================================================================
// API Endpoint: Step 1 - Search Concepts
// ============================================================================
// Vercel Serverless Function
// Endpoint: POST /api/search
// ============================================================================
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  executeQuery,
  createErrorResponse,
} from './lib/azuresql.js';

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
  console.log('Azure SQL Config:', {
    server: process.env.AZURE_SQL_SERVER,
    database: process.env.AZURE_SQL_DATABASE,
    hasPassword: !!process.env.AZURE_SQL_PASSWORD,
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

    // Build the SQL query (T-SQL syntax for Azure SQL)
    const sql = `
      SELECT TOP 75
        s.concept_name               AS standard_name,
        s.concept_id                 AS std_concept_id,
        s.concept_code               AS standard_code,
        s.vocabulary_id              AS standard_vocabulary,
        s.concept_class_id           AS concept_class_id,
        c.concept_name               AS search_result,
        c.concept_code               AS searched_code,
        c.vocabulary_id              AS searched_vocabulary,
        c.concept_class_id           AS searched_concept_class_id,
        CAST(c.concept_id AS NVARCHAR) + ' ' + c.concept_code + ' ' + c.concept_name AS searched_term
      FROM concept c
      LEFT JOIN concept_relationship cr
        ON cr.concept_id_1 = c.concept_id
       AND cr.relationship_id = 'Maps to'
      LEFT JOIN concept s
        ON s.concept_id = cr.concept_id_2
       AND s.standard_concept = 'S'
      WHERE
        UPPER(CAST(c.concept_id AS NVARCHAR) + ' ' + c.concept_code + ' ' + c.concept_name)
          LIKE '%' + UPPER(@searchterm) + '%'
        AND c.domain_id = @domain_id
        AND c.vocabulary_id IN ${vocabularyList}
        AND (
             c.domain_id <> 'Drug'
          OR c.concept_class_id IN (
               'Clinical Drug','Branded Drug','Ingredient','Clinical Pack','Branded Pack',
               'Quant Clinical Drug','Quant Branded Drug','11-digit NDC'
             )
        )
        AND (c.invalid_reason IS NULL OR c.invalid_reason = '')
      ORDER BY ABS(LEN(@searchterm) - LEN(c.concept_name)) ASC
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
