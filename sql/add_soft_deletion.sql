-- ============================================================================
-- User Soft Deletion Migration
-- ============================================================================
-- Adds support for soft deletion of users and their related data
-- Preserves audit trails and allows for user restoration
-- ============================================================================

-- Step 1: Add soft deletion columns to user_profiles
-- ============================================================================
PRINT 'Step 1: Adding soft deletion support to user_profiles...';
GO

-- Check if columns don't already exist before adding
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'user_profiles' AND COLUMN_NAME = 'deleted_at')
BEGIN
    ALTER TABLE user_profiles
    ADD deleted_at DATETIME2 NULL,
        deleted_by UNIQUEIDENTIFIER NULL,
        deletion_reason NVARCHAR(500) NULL;
    PRINT '✓ Columns added to user_profiles';
END
ELSE
BEGIN
    PRINT '⚠ Columns already exist in user_profiles - skipping';
END
GO

-- Add index for filtering out deleted users (only if column exists and index doesn't)
IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'user_profiles' AND COLUMN_NAME = 'deleted_at')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_user_deleted' AND object_id = OBJECT_ID('user_profiles'))
    BEGIN
        CREATE INDEX idx_user_deleted ON user_profiles(deleted_at);
        PRINT '✓ Index idx_user_deleted created';
    END
    ELSE
    BEGIN
        PRINT '⚠ Index idx_user_deleted already exists - skipping';
    END
END
ELSE
BEGIN
    PRINT '⚠ Column deleted_at does not exist - skipping index creation';
END
GO

-- Step 2: Add soft deletion to saved_code_sets
-- ============================================================================
PRINT 'Step 2: Adding soft deletion support to saved_code_sets...';
GO

-- Check if table exists
IF OBJECT_ID('saved_code_sets', 'U') IS NOT NULL
BEGIN
    -- Check if columns don't already exist
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'saved_code_sets' AND COLUMN_NAME = 'deleted_at')
    BEGIN
        ALTER TABLE saved_code_sets
        ADD deleted_at DATETIME2 NULL,
            deleted_by UNIQUEIDENTIFIER NULL;
        PRINT '✓ Columns added to saved_code_sets';
    END
    ELSE
    BEGIN
        PRINT '⚠ Columns already exist in saved_code_sets - skipping';
    END

    -- Check if index doesn't already exist (only create if column exists)
    IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'saved_code_sets' AND COLUMN_NAME = 'deleted_at')
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_codeset_deleted' AND object_id = OBJECT_ID('saved_code_sets'))
        BEGIN
            CREATE INDEX idx_codeset_deleted ON saved_code_sets(deleted_at);
            PRINT '✓ Index idx_codeset_deleted created';
        END
        ELSE
        BEGIN
            PRINT '⚠ Index idx_codeset_deleted already exists - skipping';
        END
    END
END
ELSE
BEGIN
    PRINT '⚠ Table saved_code_sets does not exist - skipping';
END
GO

-- Step 3: Add soft deletion to user_search_history (optional)
-- ============================================================================
PRINT 'Step 3: Adding soft deletion support to user_search_history (if exists)...';
GO

IF OBJECT_ID('user_search_history', 'U') IS NOT NULL
BEGIN
    -- Check if column doesn't already exist
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'user_search_history' AND COLUMN_NAME = 'deleted_at')
    BEGIN
        ALTER TABLE user_search_history
        ADD deleted_at DATETIME2 NULL;
        PRINT '✓ Column added to user_search_history';
    END
    ELSE
    BEGIN
        PRINT '⚠ Column already exists in user_search_history - skipping';
    END

    -- Check if index doesn't already exist (only create if column exists)
    IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'user_search_history' AND COLUMN_NAME = 'deleted_at')
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_search_deleted' AND object_id = OBJECT_ID('user_search_history'))
        BEGIN
            CREATE INDEX idx_search_deleted ON user_search_history(deleted_at);
            PRINT '✓ Index idx_search_deleted created';
        END
        ELSE
        BEGIN
            PRINT '⚠ Index idx_search_deleted already exists - skipping';
        END
    END
END
ELSE
BEGIN
    PRINT '⚠ Table user_search_history does not exist - skipping';
END
GO

-- ============================================================================
-- Verification
-- ============================================================================
PRINT '';
PRINT '=== Soft Deletion Migration Complete ===';
PRINT 'Verifying...';
GO

-- Verify columns added
SELECT 'user_profiles columns:' as Info;
SELECT
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'user_profiles'
  AND COLUMN_NAME IN ('deleted_at', 'deleted_by', 'deletion_reason');
GO

-- Verify indexes created
SELECT 'Indexes created:' as Info;
SELECT
    i.name as index_name,
    OBJECT_NAME(i.object_id) as table_name,
    i.type_desc
FROM sys.indexes i
WHERE i.name IN ('idx_user_deleted', 'idx_codeset_deleted', 'idx_search_deleted');
GO

PRINT '';
PRINT '=== SUCCESS ===';
PRINT 'Soft deletion support added successfully!';
PRINT 'Users can now be soft-deleted while preserving audit trails';
GO
