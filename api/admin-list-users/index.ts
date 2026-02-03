import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import { verifyAdminToken, logAdminAction } from '../lib/admin-auth';
import { getPool, createErrorResponse } from '../lib/azuresql';
import { sendWelcomeEmail } from '../lib/email';
import sql from 'mssql';

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (req.method === 'OPTIONS') {
        context.res = { status: 200, headers, body: { ok: true } };
        return;
    }

    try {
        const admin = await verifyAdminToken(req);
        if (!admin) {
            context.res = {
                status: 403,
                headers,
                body: createErrorResponse('Forbidden: Admin access required', 403)
            };
            return;
        }

        // Extracted handler logic

  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  const search = (req.query.search as string) || '';
  const status = (req.query.status as string) || 'all';

  const offset = (page - 1) * pageSize;

  // Build status filter
  let statusFilter = '';
  if (status === 'approved') {
    statusFilter = 'AND is_approved = 1';
  } else if (status === 'pending') {
    statusFilter = 'AND is_approved = 0';
  }

  // Build search filter
  let searchFilter = '';
  if (search) {
    searchFilter = `AND (email LIKE @search OR display_name LIKE @search)`;
  }

  const query = `
    SELECT
      supabase_user_id,
      email,
      display_name,
      role,
      is_approved,
      created_at,
      updated_at,
      deleted_at,
      deletion_reason
    FROM user_profiles
    WHERE deleted_at IS NULL
      ${statusFilter}
      ${searchFilter}
    ORDER BY created_at DESC
    OFFSET @offset ROWS
    FETCH NEXT @pageSize ROWS ONLY
  `;

  const countQuery = `
    SELECT COUNT(*) as total
    FROM user_profiles
    WHERE deleted_at IS NULL
      ${statusFilter}
      ${searchFilter}
  `;

  try {
    const pool = await getPool();
    const request = pool.request();

    request.input('offset', sql.Int, offset);
    request.input('pageSize', sql.Int, pageSize);

    if (search) {
      request.input('search', sql.NVarChar, `%${search}%`);
    }

    const [result, countResult] = await Promise.all([
      request.query(query),
      request.query(countQuery),
    ]);

    const total = countResult.recordset[0].total;

    context.log(`📤 Sending ${result.recordset.length} users (page ${page}/${Math.ceil(total / pageSize)})`);

    context.res = { status: 200, headers, body: {
      success: true,
      data: {
        users: result.recordset,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize }; return,
        },
      },
    });
  } catch (error) {
    context.log.error('Error listing users:', error);
    throw error;
  }
    } catch (error) {
        context.log.error('admin-list-users error:', error);
        const message = error instanceof Error ? error.message : 'Internal server error';
        context.res = {
            status: 500,
            headers,
            body: { success: false, error: message }
        };
    }
};

export default httpTrigger;
