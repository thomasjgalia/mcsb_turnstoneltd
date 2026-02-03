# User Deletion Strategy

## Problem
User deletion was failing due to foreign key constraints in the `admin_audit_log` table. The constraint `FK_admin_audit_target` prevents deleting users who have audit log entries.

## Solution: Soft Deletion

Instead of hard deleting users (removing from database), we implement **soft deletion** which:
- ✅ Preserves audit trails and data integrity
- ✅ Allows user restoration if needed
- ✅ Maintains foreign key relationships
- ✅ Keeps code sets for potential recovery
- ✅ Prevents deleted users from logging in (sets `is_approved = 0`)

## Implementation

### Database Changes
The migration adds soft deletion support with these columns:

**user_profiles table:**
- `deleted_at` (DATETIME2) - Timestamp when user was deleted (NULL = active)
- `deleted_by` (UNIQUEIDENTIFIER) - Admin who deleted the user
- `deletion_reason` (NVARCHAR(500)) - Reason for deletion

**user_saved_code_sets table:**
- `deleted_at` (DATETIME2) - Cascades when user is deleted
- `deleted_by` (UNIQUEIDENTIFIER) - Admin who triggered deletion

**user_search_history table (if exists):**
- `deleted_at` (DATETIME2) - Cascades when user is deleted

### API Changes
- User deletion now marks users as deleted instead of removing them
- List users query excludes soft-deleted users
- Deleted users cannot log in (`is_approved` set to 0)
- Code sets are soft-deleted along with the user

## How to Apply

### Step 1: Run the Migration
Connect to your Azure SQL database and run:
```bash
sqlcmd -S mcsbserver.database.windows.net -d omop_vocabulary -U CloudSAb1e05bb3 -P <password> -i sql/add_soft_deletion.sql
```

Or use Azure Data Studio / SQL Server Management Studio to execute `sql/add_soft_deletion.sql`.

### Step 2: Restart Development Server
The API changes are already in place. Just refresh the page to test.

## Testing

1. Go to Admin Panel
2. Try to delete a user
3. User should be marked as deleted (not removed)
4. Deleted user should not appear in user list
5. Deleted user cannot log in
6. Audit log should show the deletion

## Future Enhancements

### Option 1: Add "View Deleted Users" Filter
Add a filter in the admin panel to show deleted users:
- Status: Active | Deleted | All
- Shows deletion date, reason, and who deleted them
- Allows restoration

### Option 2: Add User Restoration API
Create endpoint to restore soft-deleted users:
```typescript
PUT /api/admin?action=restore&userId=xxx
```
Sets `deleted_at`, `deleted_by`, `deletion_reason` back to NULL and restores approval status.

### Option 3: Automatic Purge (Optional)
Schedule job to permanently delete users after N days:
- Only for users with `deleted_at` older than retention period
- Provides compliance with data retention policies

## Benefits

1. **Audit Compliance**: Complete trail of who deleted what and when
2. **Data Recovery**: Can restore accidentally deleted users
3. **Legal Protection**: Preserves records for disputes/investigations
4. **Code Set Preservation**: User's work is not lost permanently
5. **Foreign Key Integrity**: No constraint violations

## Rollback (if needed)

If you need to remove soft deletion support:
```sql
-- Remove columns
ALTER TABLE user_profiles DROP COLUMN deleted_at, deleted_by, deletion_reason;
ALTER TABLE user_saved_code_sets DROP COLUMN deleted_at, deleted_by;
```

Note: This is only safe if no users have been soft-deleted yet.
