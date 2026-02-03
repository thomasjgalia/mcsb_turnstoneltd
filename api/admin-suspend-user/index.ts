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
async function handleSuspendUser(
  req: VercelRequest,
  res: VercelResponse,
  admin: { supabase_user_id: string; email: string
    } catch (error) {
        context.log.error('admin-suspend-user error:', error);
        const message = error instanceof Error ? error.message : 'Internal server error';
        context.res = {
            status: 500,
            headers,
            body: { success: false, error: message }
        };
    }
};

export default httpTrigger;
