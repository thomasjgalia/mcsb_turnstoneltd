import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import { createErrorResponse, createSuccessResponse } from '../lib/azuresql';
import { verifySupabaseToken } from '../lib/supabase-auth';
import sql from 'mssql';

interface TrackSearchRequest {
  supabase_user_id: string;
  search_term: string;
  domain_type?: string;
  result_count?: number;
}

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
  context.log('=== Search History API called ===', req.method);

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
      await handleTrackSearch(context, req, user.id, headers);
    } else if (req.method === 'GET') {
      await handleGetSearchHistory(context, req, user.id, headers);
    } else {
      context.res = {
        status: 405,
        headers,
        body: createErrorResponse('Method not allowed', 405)
      };
    }
  } catch (error) {
    context.log.error('Search history API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    context.res = {
      status: 500,
      headers,
      body: createErrorResponse(message, 500)
    };
  }
};

async function handleTrackSearch(
  context: Context,
  req: HttpRequest,
  authenticatedUserId: string,
  headers: any
) {
  const { supabase_user_id, search_term, domain_type, result_count } = req.body as TrackSearchRequest;

  if (supabase_user_id !== authenticatedUserId) {
    context.res = {
      status: 403,
      headers,
      body: createErrorResponse('Forbidden', 403)
    };
    return;
  }

  if (!search_term) {
    context.res = {
      status: 400,
      headers,
      body: createErrorResponse('Search term is required', 400)
    };
    return;
  }

  try {
    const pool = await sql.connect(process.env.AZURE_SQL_CONNECTION_STRING || '');
    const request = pool.request();

    const query = `
      INSERT INTO search_history
        (supabase_user_id, search_term, domain_type, result_count)
      VALUES
        (@supabase_user_id, @search_term, @domain_type, @result_count);
    `;

    request.input('supabase_user_id', sql.UniqueIdentifier, supabase_user_id);
    request.input('search_term', sql.NVarChar(500), search_term);
    request.input('domain_type', sql.NVarChar(50), domain_type || null);
    request.input('result_count', sql.Int, result_count || null);

    await request.query(query);

    context.log('✅ Search tracked:', search_term);
    context.res = {
      status: 200,
      headers,
      body: createSuccessResponse({ tracked: true })
    };
  } catch (error) {
    context.log.error('Failed to track search:', error);
    context.res = {
      status: 200,
      headers,
      body: createSuccessResponse({ tracked: false })
    };
  }
}

async function handleGetSearchHistory(
  context: Context,
  req: HttpRequest,
  authenticatedUserId: string,
  headers: any
) {
  const userId = req.params.userId;
  const limit = parseInt(req.query.limit as string) || 10;

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
      body: createErrorResponse('Forbidden', 403)
    };
    return;
  }

  if (limit < 1 || limit > 100) {
    context.res = {
      status: 400,
      headers,
      body: createErrorResponse('Limit must be between 1 and 100', 400)
    };
    return;
  }

  try {
    const pool = await sql.connect(process.env.AZURE_SQL_CONNECTION_STRING || '');
    const request = pool.request();

    const query = `
      SELECT TOP (@limit)
        id,
        search_term,
        domain_type,
        result_count,
        searched_at
      FROM search_history
      WHERE supabase_user_id = @supabase_user_id
      ORDER BY searched_at DESC;
    `;

    request.input('supabase_user_id', sql.UniqueIdentifier, userId);
    request.input('limit', sql.Int, limit);

    const result = await request.query(query);

    context.log('✅ Retrieved', result.recordset.length, 'search history records');
    context.res = {
      status: 200,
      headers,
      body: createSuccessResponse(result.recordset)
    };
  } catch (error) {
    context.log.error('Failed to get search history:', error);
    throw error;
  }
}

export default httpTrigger;
