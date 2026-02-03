import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import { createErrorResponse, createSuccessResponse } from '../lib/azuresql';
import { verifySupabaseToken } from '../lib/supabase-auth';
import { notifyAdminNewUser } from '../lib/email';
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

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
  context.log('=== User Profile API called ===', req.method);

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (req.method === 'OPTIONS') {
    context.res = { status: 200, headers, body: { ok: true } };
    return;
  }

  try {
    const user = await verifySupabaseToken(req);
    if (!user) {
      context.res = {
        status: 401,
        headers,
        body: createErrorResponse('Unauthorized', 401)
      };
      return;
    }

    if (req.method === 'POST') {
      await handleUpsertProfile(context, req, user.id, headers);
    } else if (req.method === 'GET') {
      await handleGetProfile(context, req, user.id, headers);
    } else {
      context.res = {
        status: 405,
        headers,
        body: createErrorResponse('Method not allowed', 405)
      };
    }
  } catch (error) {
    context.log.error('User profile API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    context.res = {
      status: 500,
      headers,
      body: createErrorResponse(message, 500)
    };
  }
};

async function handleUpsertProfile(
  context: Context,
  req: HttpRequest,
  authenticatedUserId: string,
  headers: any
) {
  const { supabase_user_id, email, display_name, preferences } = req.body;

  if (supabase_user_id !== authenticatedUserId) {
    context.res = {
      status: 403,
      headers,
      body: createErrorResponse('Forbidden: Cannot modify other user profiles', 403)
    };
    return;
  }

  if (!email) {
    context.res = {
      status: 400,
      headers,
      body: createErrorResponse('Email is required', 400)
    };
    return;
  }

  try {
    const pool = await sql.connect(process.env.AZURE_SQL_CONNECTION_STRING || '');

    const checkRequest = pool.request();
    checkRequest.input('check_user_id', sql.UniqueIdentifier, supabase_user_id);
    const existingUser = await checkRequest.query(`
      SELECT supabase_user_id FROM user_profiles WHERE supabase_user_id = @check_user_id
    `);
    const isNewUser = existingUser.recordset.length === 0;

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

    context.log('✅ User profile upserted:', profile.supabase_user_id);

    if (isNewUser) {
      context.log('📧 New user registered - sending admin notification');
      notifyAdminNewUser(email, display_name).catch((err) =>
        context.log.error('Email notification failed:', err)
      );
    }

    context.res = {
      status: 200,
      headers,
      body: createSuccessResponse(profile)
    };
  } catch (error) {
    context.log.error('Failed to upsert user profile:', error);
    throw error;
  }
}

async function handleGetProfile(
  context: Context,
  req: HttpRequest,
  authenticatedUserId: string,
  headers: any
) {
  const userId = req.params.userId;

  if (!userId) {
    context.res = {
      status: 400,
      headers,
      body: createErrorResponse('User ID is required', 400)
    };
    return;
  }

  if (userId !== authenticatedUserId) {
    context.res = {
      status: 403,
      headers,
      body: createErrorResponse('Forbidden: Cannot access other user profiles', 403)
    };
    return;
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
      context.res = {
        status: 404,
        headers,
        body: createErrorResponse('User profile not found', 404)
      };
      return;
    }

    const rawProfile = result.recordset[0];
    const profile: UserProfile = {
      ...rawProfile,
      is_approved: rawProfile.is_approved === 1 || rawProfile.is_approved === true,
    };

    context.log('✅ User profile retrieved:', profile.supabase_user_id, 'role:', profile.role, 'approved:', profile.is_approved);
    context.res = {
      status: 200,
      headers,
      body: createSuccessResponse(profile)
    };
  } catch (error) {
    context.log.error('Failed to get user profile:', error);
    throw error;
  }
}

export default httpTrigger;
