// ============================================================================
// API Endpoint: User Profile Management
// ============================================================================
// Vercel Serverless Function
// Endpoints:
//   POST /api/user/profile - Create or update user profile
//   GET /api/user/profile/:userId - Get user profile
// ============================================================================
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createErrorResponse, createSuccessResponse } from '../lib/azuresql.js';
import { verifySupabaseToken } from '../lib/supabase-auth.js';
import { notifyAdminNewUser } from '../lib/email.js';
import sql from 'mssql';

interface UserProfile {
  supabase_user_id: string;
  email: string;
  display_name?: string;
  role: string;
  is_approved: boolean;
  preferences?: string;
  created_at: string;
  updated_at: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('=== User Profile API called ===', req.method);

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
      return await handleUpsertProfile(req, res, user.id);
    } else if (req.method === 'GET') {
      return await handleGetProfile(req, res, user.id);
    } else {
      return res.status(405).json(createErrorResponse('Method not allowed', 405));
    }
  } catch (error) {
    console.error('User profile API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return res.status(500).json(createErrorResponse(message, 500));
  }
}

/**
 * Create or update user profile
 */
async function handleUpsertProfile(
  req: VercelRequest,
  res: VercelResponse,
  authenticatedUserId: string
) {
  const { supabase_user_id, email, display_name, preferences } = req.body;

  // Verify user can only modify their own profile
  if (supabase_user_id !== authenticatedUserId) {
    return res.status(403).json(createErrorResponse('Forbidden: Cannot modify other user profiles', 403));
  }

  if (!email) {
    return res.status(400).json(createErrorResponse('Email is required', 400));
  }

  try {
    const pool = await sql.connect(process.env.AZURE_SQL_CONNECTION_STRING || '');

    // Check if user already exists
    const checkRequest = pool.request();
    checkRequest.input('check_user_id', sql.UniqueIdentifier, supabase_user_id);
    const existingUser = await checkRequest.query(`
      SELECT supabase_user_id FROM user_profiles WHERE supabase_user_id = @check_user_id
    `);
    const isNewUser = existingUser.recordset.length === 0;

    // Use MERGE to insert or update
    const request = pool.request();
    const query = `
      MERGE user_profiles AS target
      USING (SELECT @supabase_user_id AS id) AS source
      ON target.supabase_user_id = source.id
      WHEN MATCHED THEN
        UPDATE SET
          email = @email,
          display_name = @display_name,
          preferences = @preferences,
          updated_at = GETDATE()
      WHEN NOT MATCHED THEN
        INSERT (supabase_user_id, email, display_name, preferences)
        VALUES (@supabase_user_id, @email, @display_name, @preferences);

      SELECT * FROM user_profiles WHERE supabase_user_id = @supabase_user_id;
    `;

    request.input('supabase_user_id', sql.UniqueIdentifier, supabase_user_id);
    request.input('email', sql.NVarChar(255), email);
    request.input('display_name', sql.NVarChar(100), display_name || null);
    request.input('preferences', sql.NVarChar(sql.MAX), preferences || null);

    const result = await request.query(query);
    const profile = result.recordset[0] as UserProfile;

    console.log('✅ User profile upserted:', profile.supabase_user_id);

    // Send email notification for new users
    if (isNewUser) {
      console.log('📧 New user registered - sending admin notification');
      // Don't await - send email in background
      notifyAdminNewUser(email, display_name).catch((err) =>
        console.error('Email notification failed:', err)
      );
    }

    return res.status(200).json(createSuccessResponse(profile));
  } catch (error) {
    console.error('Failed to upsert user profile:', error);
    const message = error instanceof Error ? error.message : 'Failed to upsert user profile';
    throw new Error(message);
  }
}

/**
 * Get user profile
 */
async function handleGetProfile(
  req: VercelRequest,
  res: VercelResponse,
  authenticatedUserId: string
) {
  // Extract userId from URL path: /api/user/profile/:userId
  const userId = req.query.userId as string;

  if (!userId) {
    return res.status(400).json(createErrorResponse('User ID is required', 400));
  }

  // Verify user can only access their own profile
  if (userId !== authenticatedUserId) {
    return res.status(403).json(createErrorResponse('Forbidden: Cannot access other user profiles', 403));
  }

  try {
    const pool = await sql.connect(process.env.AZURE_SQL_CONNECTION_STRING || '');
    const request = pool.request();

    const query = `
      SELECT * FROM user_profiles WHERE supabase_user_id = @supabase_user_id;
    `;

    request.input('supabase_user_id', sql.UniqueIdentifier, userId);
    const result = await request.query(query);

    if (result.recordset.length === 0) {
      return res.status(404).json(createErrorResponse('User profile not found', 404));
    }

    const rawProfile = result.recordset[0];

    // Convert SQL Server BIT to boolean
    const profile: UserProfile = {
      ...rawProfile,
      is_approved: rawProfile.is_approved === 1 || rawProfile.is_approved === true,
    };

    console.log('✅ User profile retrieved:', profile.supabase_user_id, 'role:', profile.role, 'approved:', profile.is_approved);
    return res.status(200).json(createSuccessResponse(profile));
  } catch (error) {
    console.error('Failed to get user profile:', error);
    const message = error instanceof Error ? error.message : 'Failed to get user profile';
    throw new Error(message);
  }
}
