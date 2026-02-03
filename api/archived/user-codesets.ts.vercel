// ============================================================================
// API Endpoint: Saved Code Sets Management
// ============================================================================
// Vercel Serverless Function
// Endpoints:
//   POST /api/user/codesets - Save a new code set
//   GET /api/user/codesets/:userId - Get user's saved code sets (metadata only)
//   GET /api/user/codesets/detail/:codeSetId - Get full code set details
//   DELETE /api/user/codesets/:codeSetId - Delete a code set
// ============================================================================
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createErrorResponse, createSuccessResponse } from '../lib/azuresql.js';
import { verifySupabaseToken } from '../lib/supabase-auth.js';
import sql from 'mssql';

interface SavedCodeSetConcept {
  hierarchy_concept_id: number;
  concept_name: string;
  vocabulary_id: string;
  concept_class_id: string;
  root_term: string;
  domain_id: string;
}

interface SavedUMLSConcept {
  code: string;
  vocabulary: string;
  term: string;
  sourceConcept: string;
}

interface SaveCodeSetRequest {
  supabase_user_id: string;
  code_set_name: string;
  description?: string;
  concepts: SavedCodeSetConcept[] | SavedUMLSConcept[];
  total_concepts?: number; // Total built concepts (for large code sets, full count not just anchors)
  source_type: 'OMOP' | 'UMLS';
  source_metadata?: string;
  // Hybrid storage fields (for large code sets >= 500 concepts)
  build_type?: 'hierarchical' | 'direct' | 'labtest';
  anchor_concept_ids?: number[];
  build_parameters?: {
    combo_filter?: 'ALL' | 'SINGLE' | 'COMBINATION';
    domain_id?: string;
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('=== Code Sets API called ===', req.method, req.url);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  try {
    // Verify Supabase JWT token
    const user = await verifySupabaseToken(req);
    if (!user) {
      return res.status(401).json(createErrorResponse('Unauthorized', 401));
    }

    if (req.method === 'POST') {
      return await handleSaveCodeSet(req, res, user.id);
    } else if (req.method === 'GET') {
      // Check query params to determine which handler to use
      const codeSetId = req.query.codeSetId as string | undefined;
      if (codeSetId) {
        return await handleGetCodeSetDetail(req, res, user.id);
      } else {
        return await handleGetCodeSets(req, res, user.id);
      }
    } else if (req.method === 'DELETE') {
      return await handleDeleteCodeSet(req, res, user.id);
    } else {
      return res.status(405).json(createErrorResponse('Method not allowed', 405));
    }
  } catch (error) {
    console.error('Code sets API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return res.status(500).json(createErrorResponse(message, 500));
  }
}

/**
 * Save a new code set
 */
async function handleSaveCodeSet(
  req: VercelRequest,
  res: VercelResponse,
  authenticatedUserId: string
) {
  const {
    supabase_user_id,
    code_set_name,
    description,
    concepts,
    total_concepts: providedTotalConcepts,
    source_type,
    source_metadata,
    build_type,
    anchor_concept_ids,
    build_parameters,
  } = req.body as SaveCodeSetRequest;

  // Verify user can only save to their own account
  if (supabase_user_id !== authenticatedUserId) {
    return res.status(403).json(createErrorResponse('Forbidden', 403));
  }

  if (!code_set_name || !concepts || concepts.length === 0) {
    return res.status(400).json(createErrorResponse('Code set name and concepts are required', 400));
  }

  if (!source_type || (source_type !== 'OMOP' && source_type !== 'UMLS')) {
    return res.status(400).json(createErrorResponse('Valid source_type is required (OMOP or UMLS)', 400));
  }

  try {
    const pool = await sql.connect(process.env.AZURE_SQL_CONNECTION_STRING || '');
    const request = pool.request();

    // Use provided total_concepts if available (for large code sets), otherwise use concepts.length
    const totalConcepts = providedTotalConcepts || concepts.length;
    const LARGE_CODESET_THRESHOLD = 500;

    // Hybrid approach: Large code sets (>=500 concepts) save anchors only
    const isLargeCodeSet = totalConcepts >= LARGE_CODESET_THRESHOLD;
    const isMaterialized = !isLargeCodeSet;

    let conceptsJson: string;
    let anchorConceptsJson: string | null = null;
    let buildParamsJson: string | null = null;

    if (isLargeCodeSet) {
      // Large code set: Save anchor concepts and build parameters for rebuild
      console.log(`💾 Saving LARGE ${source_type} code set (anchor-only):`, {
        name: code_set_name,
        totalConcepts,
        anchorConceptIds: anchor_concept_ids,
        buildType: build_type,
        buildParameters: build_parameters
      });

      if (!anchor_concept_ids || anchor_concept_ids.length === 0) {
        return res.status(400).json(createErrorResponse('anchor_concept_ids required for large code sets', 400));
      }
      if (!build_type) {
        return res.status(400).json(createErrorResponse('build_type required for large code sets', 400));
      }

      // For large code sets, save anchor concepts (frontend already filtered to anchors only)
      conceptsJson = JSON.stringify(concepts);
      anchorConceptsJson = JSON.stringify(anchor_concept_ids);
      buildParamsJson = JSON.stringify(build_parameters || {});
    } else {
      // Small code set: Save full concepts as before
      conceptsJson = JSON.stringify(concepts);
      console.log(`💾 Saving SMALL ${source_type} code set (materialized):`, {
        name: code_set_name,
        conceptsCount: totalConcepts,
        conceptsJsonLength: conceptsJson.length,
        firstConcept: concepts[0],
        lastConcept: concepts[concepts.length - 1]
      });
    }

    const query = `
      INSERT INTO saved_code_sets
        (supabase_user_id, code_set_name, description, concepts, total_concepts, source_type, source_metadata,
         build_type, anchor_concepts, build_parameters, is_materialized)
      VALUES
        (@supabase_user_id, @code_set_name, @description, @concepts, @total_concepts, @source_type, @source_metadata,
         @build_type, @anchor_concepts, @build_parameters, @is_materialized);

      SELECT SCOPE_IDENTITY() AS id;
    `;

    request.input('supabase_user_id', sql.UniqueIdentifier, supabase_user_id);
    request.input('code_set_name', sql.NVarChar(200), code_set_name);
    request.input('description', sql.NVarChar(sql.MAX), description || null);
    request.input('concepts', sql.NVarChar(sql.MAX), conceptsJson);
    request.input('total_concepts', sql.Int, totalConcepts);
    request.input('source_type', sql.VarChar(10), source_type);
    request.input('source_metadata', sql.NVarChar(sql.MAX), source_metadata || null);
    request.input('build_type', sql.VarChar(20), build_type || null);
    request.input('anchor_concepts', sql.NVarChar(sql.MAX), anchorConceptsJson);
    request.input('build_parameters', sql.NVarChar(sql.MAX), buildParamsJson);
    request.input('is_materialized', sql.Bit, isMaterialized);

    const result = await request.query(query);
    const id = result.recordset[0].id;

    console.log(`✅ ${source_type} code set saved:`, id, `with ${totalConcepts} concepts`,
                isLargeCodeSet ? '(anchor-only, needs rebuild on load)' : '(fully materialized)');
    return res.status(200).json(createSuccessResponse({ id }));
  } catch (error) {
    console.error('Failed to save code set:', error);
    throw error;
  }
}

/**
 * Get user's saved code sets (metadata only)
 */
async function handleGetCodeSets(
  req: VercelRequest,
  res: VercelResponse,
  authenticatedUserId: string
) {
  // Use the authenticated user's ID directly
  const userId = authenticatedUserId;

  console.log('📋 GET Code Sets - userId:', userId);

  try {
    const pool = await sql.connect(process.env.AZURE_SQL_CONNECTION_STRING || '');
    const request = pool.request();

    const query = `
      SELECT
        id,
        code_set_name,
        description,
        total_concepts,
        source_type,
        source_metadata,
        is_materialized,
        created_at,
        updated_at
      FROM saved_code_sets
      WHERE supabase_user_id = @supabase_user_id
      ORDER BY created_at DESC;
    `;

    request.input('supabase_user_id', sql.UniqueIdentifier, userId);
    const result = await request.query(query);

    console.log('✅ Retrieved', result.recordset.length, 'code sets for user:', userId);
    return res.status(200).json(createSuccessResponse(result.recordset));
  } catch (error) {
    console.error('Failed to get code sets:', error);
    throw error;
  }
}

/**
 * Get specific code set with full details
 */
async function handleGetCodeSetDetail(
  req: VercelRequest,
  res: VercelResponse,
  authenticatedUserId: string
) {
  // Get codeSetId from query parameter
  const codeSetId = req.query.codeSetId as string;

  console.log('📄 GET Code Set Detail - codeSetId:', codeSetId);

  if (!codeSetId) {
    return res.status(400).json(createErrorResponse('Code set ID is required', 400));
  }

  try {
    const pool = await sql.connect(process.env.AZURE_SQL_CONNECTION_STRING || '');
    const request = pool.request();

    const query = `
      SELECT
        id,
        supabase_user_id,
        code_set_name,
        description,
        concepts,
        total_concepts,
        source_type,
        source_metadata,
        build_type,
        anchor_concepts,
        build_parameters,
        is_materialized,
        created_at,
        updated_at
      FROM saved_code_sets
      WHERE id = @id;
    `;

    request.input('id', sql.Int, parseInt(codeSetId));
    const result = await request.query(query);

    if (result.recordset.length === 0) {
      console.warn('❌ Code set not found:', codeSetId);
      return res.status(404).json(createErrorResponse('Code set not found', 404));
    }

    const codeSet = result.recordset[0];

    // Verify user can only access their own code sets (case-insensitive)
    if (codeSet.supabase_user_id.toLowerCase() !== authenticatedUserId.toLowerCase()) {
      console.warn('❌ User not authorized for code set:', codeSetId);
      return res.status(403).json(createErrorResponse('Forbidden', 403));
    }

    console.log('📄 Retrieved code set from DB:', {
      id: codeSetId,
      name: codeSet.code_set_name,
      source_type: codeSet.source_type,
      total_concepts: codeSet.total_concepts,
      is_materialized: codeSet.is_materialized,
      build_type: codeSet.build_type,
      conceptsFieldLength: codeSet.concepts?.length || 0,
      conceptsPreview: codeSet.concepts?.substring(0, 200)
    });

    // Parse JSON fields
    const parsedConcepts = codeSet.concepts ? JSON.parse(codeSet.concepts) : [];
    const parsedAnchorConcepts = codeSet.anchor_concepts ? JSON.parse(codeSet.anchor_concepts) : null;
    const parsedBuildParams = codeSet.build_parameters ? JSON.parse(codeSet.build_parameters) : null;

    const response = {
      ...codeSet,
      concepts: parsedConcepts,
      anchor_concept_ids: parsedAnchorConcepts,
      build_parameters: parsedBuildParams,
    };

    console.log('✅ Retrieved code set detail:', codeSetId,
                '- parsed concepts count:', parsedConcepts.length,
                'DB total_concepts:', codeSet.total_concepts,
                'is_materialized:', codeSet.is_materialized);
    return res.status(200).json(createSuccessResponse(response));
  } catch (error) {
    console.error('Failed to get code set detail:', error);
    throw error;
  }
}

/**
 * Delete a saved code set
 */
async function handleDeleteCodeSet(
  req: VercelRequest,
  res: VercelResponse,
  authenticatedUserId: string
) {
  // Get codeSetId from query parameter
  const codeSetId = req.query.codeSetId as string;

  console.log('🗑️ DELETE Code Set - codeSetId:', codeSetId);

  if (!codeSetId) {
    return res.status(400).json(createErrorResponse('Code set ID is required', 400));
  }

  try {
    const pool = await sql.connect(process.env.AZURE_SQL_CONNECTION_STRING || '');

    // First verify ownership
    let request = pool.request();
    const verifyQuery = `
      SELECT supabase_user_id FROM saved_code_sets WHERE id = @id;
    `;
    request.input('id', sql.Int, parseInt(codeSetId));
    const verifyResult = await request.query(verifyQuery);

    if (verifyResult.recordset.length === 0) {
      console.warn('❌ Code set not found for deletion:', codeSetId);
      return res.status(404).json(createErrorResponse('Code set not found', 404));
    }

    // Case-insensitive comparison
    if (verifyResult.recordset[0].supabase_user_id.toLowerCase() !== authenticatedUserId.toLowerCase()) {
      console.warn('❌ User not authorized to delete code set:', codeSetId);
      return res.status(403).json(createErrorResponse('Forbidden', 403));
    }

    // Delete the code set
    request = pool.request();
    const deleteQuery = `
      DELETE FROM saved_code_sets WHERE id = @id;
    `;
    request.input('id', sql.Int, parseInt(codeSetId));
    await request.query(deleteQuery);

    console.log('✅ Code set deleted:', codeSetId);
    return res.status(200).json(createSuccessResponse({ deleted: true }));
  } catch (error) {
    console.error('Failed to delete code set:', error);
    throw error;
  }
}
