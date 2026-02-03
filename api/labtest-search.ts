// ============================================================================
// API Endpoint: Lab Test Search (Measurement Domain)
// ============================================================================
// Vercel Serverless Function
// Endpoint: POST /api/labtest-search
// ============================================================================
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  executeStoredProcedure,
  createErrorResponse,
} from './lib/azuresql.js';

interface LabTestSearchRequest {
  searchterm: string;
}

interface LabTestSearchResult {
  lab_test_type: string;
  std_concept_id: number;
  search_result: string;
  searched_code: string;
  searched_concept_class_id: string;
  vocabulary_id: string;
  property: string | null;
  scale: string | null;
  system: string | null;
  time: string | null;
  panel_count: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('=== Lab Test Search API called ===');
  console.log('Method:', req.method);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json(createErrorResponse('Method not allowed', 405));
  }

  try {
    const { searchterm } = req.body as LabTestSearchRequest;
    console.log('Lab Test Search params:', { searchterm });

    // Validate input - allow empty searchterm for full list
    const searchValue = searchterm?.trim() || '';

    // Execute stored procedure
    console.log('🚀 Lab Test Search: Using stored procedure sp_LabTestSearch');
    const results = await executeStoredProcedure<LabTestSearchResult>(
      'dbo.sp_LabTestSearch',
      {
        SearchTerm: searchValue,
      }
    );

    console.log('📤 Sending lab test search response with', results.length, 'results');
    return res.status(200).json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error('Lab Test Search API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return res.status(500).json({
      success: false,
      error: message,
    });
  }
}
