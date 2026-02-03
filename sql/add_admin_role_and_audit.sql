-- ============================================================================
-- Phase 1: Administrator Functionality - Database Migration
-- ============================================================================
-- Purpose: Add role-based access control (RBAC) and audit logging
-- Author: Phase 1 Implementation
-- Date: 2026-02-02
-- ============================================================================

BEGIN TRANSACTION;

-- Step 1: Add role column to user_profiles
-- ============================================================================
ALTER TABLE user_profiles
ADD role NVARCHAR(20) NOT NULL DEFAULT 'user'
CONSTRAINT CK_user_profiles_role CHECK (role IN ('user', 'admin'));

-- Create index for role-based queries
CREATE INDEX idx_user_role ON user_profiles(role);

-- Step 2: Set initial admin user
-- ============================================================================
-- Set tom.galia@outlook.com as first admin
UPDATE user_profiles
SET role = 'admin'
WHERE email = 'tom.galia@outlook.com';

-- Step 3: Create admin_audit_log table
-- ============================================================================
CREATE TABLE admin_audit_log (
    id INT IDENTITY(1,1) PRIMARY KEY,
    admin_user_id UNIQUEIDENTIFIER NOT NULL,
    action_type NVARCHAR(50) NOT NULL,
    target_user_id UNIQUEIDENTIFIER,
    details NVARCHAR(MAX),
    created_at DATETIME2 DEFAULT GETDATE(),

    -- Foreign keys with proper cascade rules
    FOREIGN KEY (admin_user_id) REFERENCES user_profiles(supabase_user_id),
    FOREIGN KEY (target_user_id) REFERENCES user_profiles(supabase_user_id) ON DELETE NO ACTION
);

-- Step 4: Create indexes for audit log performance
-- ============================================================================
CREATE INDEX idx_audit_admin ON admin_audit_log(admin_user_id);
CREATE INDEX idx_audit_target ON admin_audit_log(target_user_id);
CREATE INDEX idx_audit_created ON admin_audit_log(created_at DESC);
CREATE INDEX idx_audit_action ON admin_audit_log(action_type);

COMMIT TRANSACTION;

-- ============================================================================
-- Verification Queries (Run after migration)
-- ============================================================================
-- Verify role column added
-- SELECT email, role, is_approved FROM user_profiles WHERE email = 'tom.galia@outlook.com';

-- Verify audit log table created
-- SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'admin_audit_log';

-- Verify indexes created
-- SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('user_profiles') AND name = 'idx_user_role';
-- SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('admin_audit_log');
