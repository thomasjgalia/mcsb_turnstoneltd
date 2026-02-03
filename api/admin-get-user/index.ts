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

  const userId = req.query.userId as string;

  if (!userId) {
    return res
      .status(400)
      .json(createErrorResponse('userId parameter required', 400));
  }

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('userId', sql.UniqueIdentifier, userId)
      .query(`
        SELECT
          supabase_user_id,
          email,
          display_name,
          role,
          is_approved,
          created_at,
          updated_at,
          preferences
        FROM user_profiles
        WHERE supabase_user_id = @userId
      `);

    if (result.recordset.length === 0) {
      context.res = { status: 404, headers, body: createErrorResponse('User not found', 404 }; return);
    }

    context.res = { status: 200, headers, body: {
      success: true,
      data: result.recordset[0],
    } }; return;
  } catch (error) {
    context.log.error('Error getting user:', error);
    throw error;
  }
    } catch (error) {
        context.log.error('admin-get-user error:', error);
        const message = error instanceof Error ? error.message : 'Internal server error';
        context.res = {
            status: 500,
            headers,
            body: { success: false, error: message }
        };
    }
};

export default httpTrigger;
