// ============================================================================
// API Endpoint: Admin User Management
// ============================================================================
// Vercel Serverless Function
// Endpoints:
//   GET    /api/admin?action=users&page=1&pageSize=20&search=&status=all
//   GET    /api/admin?action=user&userId=xxx
//   PUT    /api/admin?action=approve&userId=xxx
//   PUT    /api/admin?action=suspend&userId=xxx&reason=xxx
//   DELETE /api/admin?userId=xxx&reason=xxx
//   GET    /api/admin?action=audit&page=1&pageSize=20
// ============================================================================

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAdminToken, logAdminAction } from './lib/admin-auth.js';
import { getPool, createErrorResponse } from './lib/azuresql.js';
import { sendWelcomeEmail } from './lib/email.js';
import sql from 'mssql';

// ============================================================================
// Handler
// ============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('=== Admin API called ===');
  console.log('Method:', req.method);
  console.log('Query:', req.query);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  try {
    // Verify admin authorization
    const admin = await verifyAdminToken(req);
    if (!admin) {
      return res
        .status(403)
        .json(createErrorResponse('Forbidden: Admin access required', 403));
    }

    // Route to appropriate handler
    const action = req.query.action as string;

    if (req.method === 'GET') {
      if (action === 'users') {
        return await handleListUsers(req, res);
      } else if (action === 'user') {
        return await handleGetUser(req, res);
      } else if (action === 'audit') {
        return await handleGetAuditLog(req, res, admin);
      } else {
        return res
          .status(400)
          .json(createErrorResponse('Invalid action parameter', 400));
      }
    } else if (req.method === 'PUT') {
      if (action === 'approve') {
        return await handleApproveUser(req, res, admin);
      } else if (action === 'suspend') {
        return await handleSuspendUser(req, res, admin);
      } else {
        return res
          .status(400)
          .json(createErrorResponse('Invalid action parameter', 400));
      }
    } else if (req.method === 'DELETE') {
      return await handleDeleteUser(req, res, admin);
    } else {
      return res
        .status(405)
        .json(createErrorResponse('Method not allowed', 405));
    }
  } catch (error) {
    console.error('Admin API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return res.status(500).json({
      success: false,
      error: message,
    });
  }
}

// ============================================================================
// Handlers
// ============================================================================

/**
 * GET /api/admin?action=users&page=1&pageSize=20&search=&status=all
 * List users with pagination, search, and status filter
 */
async function handleListUsers(req: VercelRequest, res: VercelResponse) {
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

    console.log(`📤 Sending ${result.recordset.length} users (page ${page}/${Math.ceil(total / pageSize)})`);

    return res.status(200).json({
      success: true,
      data: {
        users: result.recordset,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    });
  } catch (error) {
    console.error('Error listing users:', error);
    throw error;
  }
}

/**
 * GET /api/admin?action=user&userId=xxx
 * Get single user details
 */
async function handleGetUser(req: VercelRequest, res: VercelResponse) {
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
      return res.status(404).json(createErrorResponse('User not found', 404));
    }

    return res.status(200).json({
      success: true,
      data: result.recordset[0],
    });
  } catch (error) {
    console.error('Error getting user:', error);
    throw error;
  }
}

/**
 * PUT /api/admin?action=approve&userId=xxx
 * Approve user (set is_approved=1)
 */
async function handleApproveUser(
  req: VercelRequest,
  res: VercelResponse,
  admin: { supabase_user_id: string; email: string }
) {
  const userId = req.query.userId as string;

  if (!userId) {
    return res
      .status(400)
      .json(createErrorResponse('userId parameter required', 400));
  }

  try {
    const pool = await getPool();

    // Get user email and name for audit log and welcome email
    const userResult = await pool
      .request()
      .input('userId', sql.UniqueIdentifier, userId)
      .query('SELECT email, display_name FROM user_profiles WHERE supabase_user_id = @userId');

    if (userResult.recordset.length === 0) {
      return res.status(404).json(createErrorResponse('User not found', 404));
    }

    const targetEmail = userResult.recordset[0].email;
    const targetName = userResult.recordset[0].display_name;

    // Approve user
    await pool
      .request()
      .input('userId', sql.UniqueIdentifier, userId)
      .query('UPDATE user_profiles SET is_approved = 1 WHERE supabase_user_id = @userId');

    // Log action
    await logAdminAction(admin.supabase_user_id, 'APPROVE_USER', userId, {
      admin_email: admin.email,
      target_email: targetEmail,
    });

    console.log(`✅ User approved: ${targetEmail}`);

    // Send welcome email to approved user
    console.log('📧 Sending welcome email to approved user');
    sendWelcomeEmail(targetEmail, targetName).catch((err) =>
      console.error('Welcome email failed:', err)
    );

    return res.status(200).json({
      success: true,
      message: 'User approved successfully',
    });
  } catch (error) {
    console.error('Error approving user:', error);
    throw error;
  }
}

/**
 * PUT /api/admin?action=suspend&userId=xxx&reason=xxx
 * Suspend user (set is_approved=0)
 */
async function handleSuspendUser(
  req: VercelRequest,
  res: VercelResponse,
  admin: { supabase_user_id: string; email: string }
) {
  const userId = req.query.userId as string;
  const reason = (req.query.reason as string) || 'No reason provided';

  if (!userId) {
    return res
      .status(400)
      .json(createErrorResponse('userId parameter required', 400));
  }

  try {
    const pool = await getPool();

    // Get user email for audit log
    const userResult = await pool
      .request()
      .input('userId', sql.UniqueIdentifier, userId)
      .query('SELECT email FROM user_profiles WHERE supabase_user_id = @userId');

    if (userResult.recordset.length === 0) {
      return res.status(404).json(createErrorResponse('User not found', 404));
    }

    const targetEmail = userResult.recordset[0].email;

    // Suspend user
    await pool
      .request()
      .input('userId', sql.UniqueIdentifier, userId)
      .query('UPDATE user_profiles SET is_approved = 0 WHERE supabase_user_id = @userId');

    // Log action
    await logAdminAction(admin.supabase_user_id, 'SUSPEND_USER', userId, {
      admin_email: admin.email,
      target_email: targetEmail,
      reason,
    });

    console.log(`✅ User suspended: ${targetEmail}`);

    return res.status(200).json({
      success: true,
      message: 'User suspended successfully',
    });
  } catch (error) {
    console.error('Error suspending user:', error);
    throw error;
  }
}

/**
 * DELETE /api/admin?userId=xxx&reason=xxx
 * Soft delete user (marks as deleted, preserves audit trail)
 */
async function handleDeleteUser(
  req: VercelRequest,
  res: VercelResponse,
  admin: { supabase_user_id: string; email: string }
) {
  const userId = req.query.userId as string;
  const reason = (req.query.reason as string) || 'No reason provided';

  if (!userId) {
    return res
      .status(400)
      .json(createErrorResponse('userId parameter required', 400));
  }

  try {
    const pool = await getPool();

    // Get user email for audit log
    const userResult = await pool
      .request()
      .input('userId', sql.UniqueIdentifier, userId)
      .query('SELECT email FROM user_profiles WHERE supabase_user_id = @userId AND deleted_at IS NULL');

    if (userResult.recordset.length === 0) {
      return res.status(404).json(createErrorResponse('User not found or already deleted', 404));
    }

    const targetEmail = userResult.recordset[0].email;

    // Soft delete user (mark as deleted)
    await pool
      .request()
      .input('userId', sql.UniqueIdentifier, userId)
      .input('deletedBy', sql.UniqueIdentifier, admin.supabase_user_id)
      .input('reason', sql.NVarChar, reason)
      .query(`
        UPDATE user_profiles
        SET deleted_at = GETDATE(),
            deleted_by = @deletedBy,
            deletion_reason = @reason,
            is_approved = 0
        WHERE supabase_user_id = @userId
      `);

    // Soft delete user's code sets (if the columns exist)
    try {
      await pool
        .request()
        .input('userId', sql.UniqueIdentifier, userId)
        .input('deletedBy', sql.UniqueIdentifier, admin.supabase_user_id)
        .query(`
          UPDATE saved_code_sets
          SET deleted_at = GETDATE(),
              deleted_by = @deletedBy
          WHERE supabase_user_id = @userId AND deleted_at IS NULL
        `);
    } catch (codeSetError) {
      // If columns don't exist yet, just log and continue
      console.log('⚠️ Could not soft-delete code sets (columns may not exist yet):', codeSetError instanceof Error ? codeSetError.message : codeSetError);
    }

    // Log action AFTER successful deletion
    await logAdminAction(admin.supabase_user_id, 'DELETE_USER', userId, {
      admin_email: admin.email,
      target_email: targetEmail,
      reason,
      deletion_type: 'soft',
    });

    console.log(`✅ User soft-deleted: ${targetEmail}`);

    return res.status(200).json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
}

/**
 * GET /api/admin?action=audit&page=1&pageSize=20
 * Get audit log with pagination
 */
async function handleGetAuditLog(
  req: VercelRequest,
  res: VercelResponse,
  admin: { supabase_user_id: string; email: string }
) {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  const offset = (page - 1) * pageSize;

  const query = `
    SELECT
      a.id,
      a.action_type,
      a.details,
      a.created_at,
      admin_user.email as admin_email,
      target_user.email as target_email
    FROM admin_audit_log a
    LEFT JOIN user_profiles admin_user ON a.admin_user_id = admin_user.supabase_user_id
    LEFT JOIN user_profiles target_user ON a.target_user_id = target_user.supabase_user_id
    ORDER BY a.created_at DESC
    OFFSET @offset ROWS
    FETCH NEXT @pageSize ROWS ONLY
  `;

  const countQuery = 'SELECT COUNT(*) as total FROM admin_audit_log';

  try {
    const pool = await getPool();
    const request = pool.request();

    request.input('offset', sql.Int, offset);
    request.input('pageSize', sql.Int, pageSize);

    const [result, countResult] = await Promise.all([
      request.query(query),
      pool.request().query(countQuery),
    ]);

    const total = countResult.recordset[0].total;

    console.log(`📤 Sending ${result.recordset.length} audit log entries (page ${page}/${Math.ceil(total / pageSize)})`);

    return res.status(200).json({
      success: true,
      data: {
        logs: result.recordset,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    });
  } catch (error) {
    console.error('Error getting audit log:', error);
    throw error;
  }
}
