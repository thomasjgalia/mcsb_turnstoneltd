-- Verify Azure SQL Schema Setup
-- Run this to confirm all tables, indexes, and triggers were created

-- Check Tables
SELECT TABLE_NAME, TABLE_TYPE
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_NAME IN ('user_profiles', 'saved_code_sets', 'search_history')
ORDER BY TABLE_NAME;

-- Check Indexes
SELECT
  t.name AS TableName,
  i.name AS IndexName,
  i.type_desc AS IndexType
FROM sys.indexes i
INNER JOIN sys.tables t ON i.object_id = t.object_id
WHERE t.name IN ('user_profiles', 'saved_code_sets', 'search_history')
  AND i.name IS NOT NULL
ORDER BY t.name, i.name;

-- Check Triggers
SELECT
  t.name AS TriggerName,
  OBJECT_NAME(t.parent_id) AS TableName,
  t.is_disabled AS IsDisabled
FROM sys.triggers t
WHERE OBJECT_NAME(t.parent_id) IN ('user_profiles', 'saved_code_sets', 'search_history')
ORDER BY TableName, TriggerName;

-- Check Foreign Keys
SELECT
  fk.name AS ForeignKeyName,
  OBJECT_NAME(fk.parent_object_id) AS TableName,
  OBJECT_NAME(fk.referenced_object_id) AS ReferencedTable
FROM sys.foreign_keys fk
WHERE OBJECT_NAME(fk.parent_object_id) IN ('saved_code_sets', 'search_history')
ORDER BY TableName;
