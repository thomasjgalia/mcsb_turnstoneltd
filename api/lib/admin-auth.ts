// ============================================================================
// Admin Authorization Middleware
// ============================================================================
// Verifies admin role and logs admin actions to audit table
// ============================================================================

import type { VercelRequest } from '@vercel/node';
import { verifySupabaseToken } from './supabase-auth.js';
import { getPool } from './azuresql.js';
import sql from 'mssql';

export interface AdminUser {
  supabase_user_id: string;
  email: string;
  role: string;
}

/**
 * Verify admin authorization
 * Returns admin user if valid, null if not admin or invalid token
 */
export async function verifyAdminToken(
  req: VercelRequest
): Promise<AdminUser | null> {
  // Step 1: Verify Supabase JWT token
  const user = await verifySupabaseToken(req);
  if (!user) {
    console.warn('❌ Admin auth failed: Invalid or missing token');
    return null;
  }

  try {
    // Step 2: Check role='admin' in Azure SQL user_profiles
    const pool = await getPool();
    const result = await pool
      .request()
      .input('supabase_user_id', sql.UniqueIdentifier, user.id)
      .query(`
        SELECT supabase_user_id, email, role
        FROM user_profiles
        WHERE supabase_user_id = @supabase_user_id AND role = 'admin'
      `);

    if (result.recordset.length === 0) {
      console.warn(`❌ Admin auth failed: User ${user.email} is not an admin`);
      return null;
    }

    const adminUser = result.recordset[0];
    console.log(`✅ Admin authorized: ${adminUser.email}`);
    return adminUser;
  } catch (error) {
    console.error('❌ Admin auth error:', error);
    return null;
  }
}

/**
 * Log admin action to audit table
 */
export async function logAdminAction(
  adminUserId: string,
  actionType: string,
  targetUserId: string | null,
  details: Record<string, any>
): Promise<void> {
  try {
    const pool = await getPool();
    await pool
      .request()
      .input('admin_user_id', sql.UniqueIdentifier, adminUserId)
      .input('action_type', sql.NVarChar(50), actionType)
      .input('target_user_id', sql.UniqueIdentifier, targetUserId || null)
      .input('details', sql.NVarChar(sql.MAX), JSON.stringify(details))
      .query(`
        INSERT INTO admin_audit_log (admin_user_id, action_type, target_user_id, details)
        VALUES (@admin_user_id, @action_type, @target_user_id, @details)
      `);

    console.log(`📝 Audit log: ${actionType} by admin ${adminUserId}`);
  } catch (error) {
    console.error('❌ Failed to log admin action:', error);
    // Don't throw - audit logging failures shouldn't break the action
  }
}
