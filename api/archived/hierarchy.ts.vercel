// ============================================================================
// API Endpoint: Step 2 - Explore Hierarchy
// ============================================================================
// Vercel Serverless Function
// Endpoint: POST /api/hierarchy
// ============================================================================
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  executeStoredProcedure,
  createErrorResponse,
} from './lib/azuresql.js';

interface HierarchyRequest {
  concept_id: number;
}

interface HierarchyResult {
  steps_away: number;
  concept_name: string;
  hierarchy_concept_id: number;
  concept_code: string;
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

    // Execute stored procedure
    console.log('🚀 Hierarchy: Using stored procedure sp_GetConceptHierarchy');
    const results = await executeStoredProcedure<HierarchyResult>(
      'dbo.sp_GetConceptHierarchy',
      { ConceptId: concept_id }
    );

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
