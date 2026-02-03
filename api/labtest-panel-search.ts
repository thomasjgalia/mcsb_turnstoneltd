// ============================================================================
// API Endpoint: Lab Test Panel Search
// ============================================================================
// Finds LOINC Panels that contain selected lab tests
// Endpoint: POST /api/labtest-panel-search
// ============================================================================
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  executeStoredProcedure,
  createErrorResponse,
} from './lib/azuresql.js';

interface LabTestPanelSearchRequest {
  labTestConceptIds: number[];
}

interface LabTestPanelSearchResult {
  lab_test_type: string;
  std_concept_id: number;          // The lab test concept ID from shopping cart
  panel_concept_id: number;
  search_result: string;            // Panel name
  searched_code: string;            // Panel code
  searched_concept_class_id: string;
  vocabulary_id: string;
  property: null;
  scale: null;
  system: null;
  time: null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('=== Lab Test Panel Search API called ===');
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
    const { labTestConceptIds } = req.body as LabTestPanelSearchRequest;
    console.log('Lab Test Panel Search params:', { labTestConceptIds });

    // Validate input
    if (!labTestConceptIds || !Array.isArray(labTestConceptIds) || labTestConceptIds.length === 0) {
      return res.status(400).json(createErrorResponse('labTestConceptIds array is required', 400));
    }

    // Convert array to comma-separated string for SQL Server
    const labTestIds = labTestConceptIds.join(',');

    // Execute stored procedure
    console.log('🚀 Lab Test Panel Search: Using stored procedure sp_LabTestPanelSearch');
    const results = await executeStoredProcedure<LabTestPanelSearchResult>(
      'dbo.sp_LabTestPanelSearch',
      {
        LabTestIds: labTestIds,
      }
    );

    console.log('📤 Sending lab test panel search response with', results.length, 'results');
    return res.status(200).json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error('Lab Test Panel Search API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return res.status(500).json({
      success: false,
      error: message,
    });
  }
}
