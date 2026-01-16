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

interface SaveCodeSetRequest {
  supabase_user_id: string;
  code_set_name: string;
  description?: string;
  concepts: SavedCodeSetConcept[];
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
      // Check if this is detail endpoint or list endpoint
      if (req.url?.includes('/detail/')) {
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
  } = req.body as SaveCodeSetRequest;

  // Verify user can only save to their own account
  if (supabase_user_id !== authenticatedUserId) {
    return res.status(403).json(createErrorResponse('Forbidden', 403));
  }

  if (!code_set_name || !concepts || concepts.length === 0) {
    return res.status(400).json(createErrorResponse('Code set name and concepts are required', 400));
  }

  try {
    const pool = await sql.connect(process.env.AZURE_SQL_CONNECTION_STRING || '');
    const request = pool.request();

    const conceptsJson = JSON.stringify(concepts);
    const totalConcepts = concepts.length;

    const query = `
      INSERT INTO saved_code_sets
        (supabase_user_id, code_set_name, description, concepts, total_concepts)
      VALUES
        (@supabase_user_id, @code_set_name, @description, @concepts, @total_concepts);

      SELECT SCOPE_IDENTITY() AS id;
    `;

    request.input('supabase_user_id', sql.UniqueIdentifier, supabase_user_id);
    request.input('code_set_name', sql.NVarChar(200), code_set_name);
    request.input('description', sql.NVarChar(sql.MAX), description || null);
    request.input('concepts', sql.NVarChar(sql.MAX), conceptsJson);
    request.input('total_concepts', sql.Int, totalConcepts);

    const result = await request.query(query);
    const id = result.recordset[0].id;

    console.log('✅ Code set saved:', id);
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
  // Try to get userId from both URL path and query params
  const userIdFromPath = req.url?.split('/codesets/')[1]?.split('?')[0];
  const userId = userIdFromPath || (req.query.userId as string);

  console.log('📋 GET Code Sets - URL:', req.url);
  console.log('📋 GET Code Sets - userId from path:', userIdFromPath);
  console.log('📋 GET Code Sets - final userId:', userId);
  console.log('📋 GET Code Sets - authenticatedUserId:', authenticatedUserId);

  if (!userId) {
    return res.status(400).json(createErrorResponse('User ID is required', 400));
  }

  // Verify user can only access their own code sets (case-insensitive comparison)
  if (userId.toLowerCase() !== authenticatedUserId.toLowerCase()) {
    console.warn('❌ User ID mismatch:', userId.toLowerCase(), 'vs', authenticatedUserId.toLowerCase());
    return res.status(403).json(createErrorResponse('Forbidden', 403));
  }

  try {
    const pool = await sql.connect(process.env.AZURE_SQL_CONNECTION_STRING || '');
    const request = pool.request();

    const query = `
      SELECT
        id,
        code_set_name,
        description,
        total_concepts,
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
  // Extract codeSetId from URL path
  const codeSetIdFromPath = req.url?.split('/detail/')[1]?.split('?')[0];
  const codeSetId = codeSetIdFromPath || (req.query.codeSetId as string);

  console.log('📄 GET Code Set Detail - URL:', req.url);
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

    // Parse concepts JSON
    const response = {
      ...codeSet,
      concepts: JSON.parse(codeSet.concepts),
    };

    console.log('✅ Retrieved code set detail:', codeSetId, '- concepts:', response.concepts.length);
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
  // Extract codeSetId from URL path
  const codeSetIdFromPath = req.url?.split('/codesets/')[1]?.split('?')[0];
  const codeSetId = codeSetIdFromPath || (req.query.codeSetId as string);

  console.log('🗑️ DELETE Code Set - URL:', req.url);
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
