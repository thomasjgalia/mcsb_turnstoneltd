-- ============================================================================
-- Phase 1: Administrator Functionality - Database Migration (SAFE VERSION)
-- ============================================================================
-- Purpose: Add role-based access control (RBAC) and audit logging
-- Safer approach for Azure SQL - step by step without transaction
-- ============================================================================

-- Step 1: Add role column (nullable first, then make NOT NULL)
-- ============================================================================
PRINT 'Step 1: Adding role column...';
GO

-- Add column as nullable with default
ALTER TABLE user_profiles
ADD role NVARCHAR(20) NULL DEFAULT 'user';
GO

-- Update all existing rows to have 'user' role
PRINT 'Updating existing rows with default role...';
UPDATE user_profiles
SET role = 'user'
WHERE role IS NULL;
GO

-- Set tom.galia@outlook.com as admin BEFORE adding constraint
PRINT 'Setting initial admin user...';
UPDATE user_profiles
SET role = 'admin'
WHERE email = 'tom.galia@outlook.com';
GO

-- Now make the column NOT NULL
PRINT 'Making role column NOT NULL...';
ALTER TABLE user_profiles
ALTER COLUMN role NVARCHAR(20) NOT NULL;
GO

-- Add check constraint
PRINT 'Adding check constraint...';
ALTER TABLE user_profiles
ADD CONSTRAINT CK_user_profiles_role CHECK (role IN ('user', 'admin'));
GO

-- Create index for role-based queries
PRINT 'Creating index on role...';
CREATE INDEX idx_user_role ON user_profiles(role);
GO

-- Step 2: Create admin_audit_log table
-- ============================================================================
PRINT 'Step 2: Creating admin_audit_log table...';
GO

CREATE TABLE admin_audit_log (
    id INT IDENTITY(1,1) PRIMARY KEY,
    admin_user_id UNIQUEIDENTIFIER NOT NULL,
    action_type NVARCHAR(50) NOT NULL,
    target_user_id UNIQUEIDENTIFIER NULL,
    details NVARCHAR(MAX) NULL,
    created_at DATETIME2 DEFAULT GETDATE(),

    -- Foreign keys with proper cascade rules
    CONSTRAINT FK_admin_audit_admin FOREIGN KEY (admin_user_id)
        REFERENCES user_profiles(supabase_user_id),
    CONSTRAINT FK_admin_audit_target FOREIGN KEY (target_user_id)
        REFERENCES user_profiles(supabase_user_id) ON DELETE NO ACTION
);
GO

-- Step 3: Create indexes for audit log performance
-- ============================================================================
PRINT 'Step 3: Creating audit log indexes...';
GO

CREATE INDEX idx_audit_admin ON admin_audit_log(admin_user_id);
CREATE INDEX idx_audit_target ON admin_audit_log(target_user_id);
CREATE INDEX idx_audit_created ON admin_audit_log(created_at DESC);
CREATE INDEX idx_audit_action ON admin_audit_log(action_type);
GO

-- ============================================================================
-- Verification
-- ============================================================================
PRINT '';
PRINT '=== Migration Complete ===';
PRINT 'Verifying...';
GO

-- Verify role column added
SELECT 'User roles:' as Info;
SELECT email, role, is_approved
FROM user_profiles
WHERE email IN ('tom.galia@outlook.com')
   OR role = 'admin';
GO

-- Verify audit log table created
SELECT 'Audit log table:' as Info;
SELECT TABLE_NAME, TABLE_TYPE
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_NAME = 'admin_audit_log';
GO

-- Verify indexes created
SELECT 'Indexes created:' as Info;
SELECT
    i.name as index_name,
    OBJECT_NAME(i.object_id) as table_name
FROM sys.indexes i
WHERE (i.object_id = OBJECT_ID('user_profiles') AND i.name = 'idx_user_role')
   OR (i.object_id = OBJECT_ID('admin_audit_log') AND i.name LIKE 'idx_audit%')
ORDER BY table_name, index_name;
GO

PRINT '';
PRINT '=== SUCCESS ===';
PRINT 'Phase 1 database migration completed successfully!';
PRINT 'Next: Test the admin panel in the application';
GO
