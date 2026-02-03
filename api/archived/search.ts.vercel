// ============================================================================
// API Endpoint: Step 1 - Search Concepts
// ============================================================================
// Vercel Serverless Function
// Endpoint: POST /api/search
// ============================================================================
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  executeStoredProcedure,
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

    // Execute stored procedure
    console.log('🚀 Search: Using stored procedure sp_SearchConcepts');
    const results = await executeStoredProcedure<SearchResult>(
      'dbo.sp_SearchConcepts',
      {
        SearchTerm: searchterm.trim(),
        DomainId: domain_id,
      }
    );

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
