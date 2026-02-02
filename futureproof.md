# Strategic Architecture Improvements Plan

## Overview
This plan addresses three strategic architectural improvements for the Medical Code Set Builder application:
1. **Administrator Functionality** - Designate tom.galia@outlook.com as admin with user management capabilities
2. **Stored Procedures Migration** - Move SQL processing to stored procedures for performance and maintainability
3. **Multi-Tenancy Architecture** - Enable organization-based user segregation for multiple companies

## Current State Analysis

### Authentication & User Management
- **Authentication**: Supabase JWT-based authentication
- **User Data**: Azure SQL `user_profiles` table with basic user info
- **Authorization**: No role-based access control (RBAC) exists
- **Admin Features**: None - all users have equal access

### SQL Query Architecture
- **Current State**: 0 stored procedures, all dynamic queries in TypeScript API
- **Critical Performance Issue**: N+1 query problem in hierarchical code set builder
  - Current: 30 roundtrips for 10 concepts (~15 seconds)
  - Bottleneck: `api/codeset.ts` lines 204-337 (8-join query in loop)
- **Other Query Patterns**:
  - `api/hierarchy.ts`: Two-roundtrip pattern (lines 49-154)
  - `api/search.ts`: 3-CTE complex query with mapping logic (lines 87-196)

### Multi-Tenancy
- **Current State**: Single-user isolation only
- **No Organization Concept**: Users cannot be grouped
- **Data Sharing**: No mechanism to share code sets within teams
- **Limitation**: Cannot serve multiple companies

---

## Phase 1: Administrator Functionality

### Objective
Establish role-based access control with tom.galia@outlook.com as the first administrator, and build admin UI for user management.

### Database Schema Changes

**1. Add `role` column to `user_profiles`**
```sql
ALTER TABLE user_profiles
ADD role NVARCHAR(20) NOT NULL DEFAULT 'user'
CHECK (role IN ('admin', 'user'));

-- Set tom.galia@outlook.com as admin
UPDATE user_profiles
SET role = 'admin'
WHERE email = 'tom.galia@outlook.com';

CREATE INDEX idx_user_profiles_role ON user_profiles(role);
```

**2. Create `admin_audit_log` table**
```sql
CREATE TABLE admin_audit_log (
    id INT IDENTITY(1,1) PRIMARY KEY,
    admin_user_id UNIQUEIDENTIFIER NOT NULL,
    action_type NVARCHAR(50) NOT NULL,
    target_user_id UNIQUEIDENTIFIER,
    details NVARCHAR(MAX),
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (admin_user_id) REFERENCES user_profiles(id),
    FOREIGN KEY (target_user_id) REFERENCES user_profiles(id)
);

CREATE INDEX idx_admin_audit_log_admin_user ON admin_audit_log(admin_user_id);
CREATE INDEX idx_admin_audit_log_created_at ON admin_audit_log(created_at DESC);
```

### Backend API Changes

**Create `api/admin.ts`** - New admin-only API endpoints:
```typescript
// Middleware to check admin role
function requireAdmin(req, res, next) {
  if (user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// GET /api/admin/users - List all users with pagination
// GET /api/admin/users/:id - Get user details
// PUT /api/admin/users/:id/approve - Approve user account
// PUT /api/admin/users/:id/suspend - Suspend user account
// DELETE /api/admin/users/:id - Delete user account
// GET /api/admin/audit-log - Get audit log with pagination
```

### Frontend UI Changes

**1. Add Admin Navigation** (`src/App.tsx`)
- Add conditional admin menu item (only visible to admins)
- Route to `/admin/users`

**2. Create `src/components/AdminUserManagement.tsx`**
- User list table with pagination
- Search/filter users by email, name, approval status
- Actions: Approve, Suspend, Delete
- View audit log in expandable section
- Confirmation dialogs for destructive actions

**3. Update `src/hooks/useAuth.ts`**
- Add `role` to user context
- Export `isAdmin` helper function

### Critical Files
- `c:\Users\T933261\mcsb_oracle\azure_sql_schema.sql` - Schema modifications
- `c:\Users\T933261\mcsb_oracle\api\admin.ts` - New file
- `c:\Users\T933261\mcsb_oracle\src\components\AdminUserManagement.tsx` - New file
- `c:\Users\T933261\mcsb_oracle\src\App.tsx` - Add admin route
- `c:\Users\T933261\mcsb_oracle\src\hooks\useAuth.ts` - Add role to context

### Verification Steps
1. Run schema migration script against Azure SQL
2. Verify tom.galia@outlook.com has `role='admin'` in database
3. Start dev server: `npm run dev:all`
4. Login as admin user
5. Navigate to `/admin/users` - should see user management UI
6. Test approve/suspend/delete actions
7. Verify audit log entries are created
8. Login as regular user - admin menu should not appear
9. Attempt to access `/api/admin/users` as regular user - should get 403 error

---

## Phase 2: Stored Procedures Migration

### Objective
Migrate critical SQL queries to stored procedures for performance optimization (query plan caching) and security.

### Priority 1: Eliminate N+1 Query Problem (CRITICAL)

**Create `sp_BuildCodeSet_Hierarchical`**

Current problem: `api/codeset.ts` lines 204-337 executes an 8-join query 30 times for 10 concepts.

```sql
CREATE PROCEDURE sp_BuildCodeSet_Hierarchical
    @ConceptIds NVARCHAR(MAX),  -- Comma-separated list or JSON array
    @VocabularyIds NVARCHAR(MAX)
AS
BEGIN
    -- Parse concept IDs into temp table
    -- Execute SINGLE batch query for all concepts
    -- Return all descendants with mapped codes in one result set
END
```

**Benefits**:
- 30 roundtrips → 1 roundtrip
- 15 seconds → ~1-2 seconds (estimated)
- Query plan caching reduces SQL compilation overhead

**TypeScript Changes** (`api/codeset.ts`):
```typescript
// Replace loop at lines 204-337 with single stored procedure call
const result = await pool.request()
  .input('ConceptIds', sql.NVarChar, JSON.stringify(conceptIds))
  .input('VocabularyIds', sql.NVarChar, JSON.stringify(vocabularyIds))
  .execute('sp_BuildCodeSet_Hierarchical');
```

### Priority 2: Optimize Hierarchy Lookup

**Create `sp_GetConceptHierarchy`**

Current pattern: `api/hierarchy.ts` lines 49-154 does two roundtrips (domain_id lookup, then hierarchy query).

```sql
CREATE PROCEDURE sp_GetConceptHierarchy
    @ConceptId INT
AS
BEGIN
    -- Combined single-query for domain + hierarchy
    -- Return hierarchical path in one result set
END
```

### Priority 3: Optimize Search Query

**Create `sp_SearchConcepts`**

Current query: `api/search.ts` lines 87-196 has 3-CTE complex query executed on every search.

```sql
CREATE PROCEDURE sp_SearchConcepts
    @SearchTerm NVARCHAR(255),
    @VocabularyIds NVARCHAR(MAX) = NULL,
    @Limit INT = 100
AS
BEGIN
    -- Cached 3-CTE query with mapping logic
END
```

### Migration Strategy

**Phase 2A: Create & Test Stored Procedures**
1. Create stored procedures in development environment
2. Test with representative data
3. Benchmark performance vs dynamic queries
4. Document parameters and return schemas

**Phase 2B: Dual-Path Implementation**
1. Implement stored procedure calls in TypeScript
2. Keep dynamic query code as fallback
3. Add feature flag: `USE_STORED_PROCEDURES=true`
4. Deploy to production with feature flag OFF

**Phase 2C: Gradual Rollout**
1. Enable feature flag in production
2. Monitor performance metrics and error rates
3. If issues occur, disable flag (instant rollback)
4. After 1 week stable, remove dynamic query fallback code

### Critical Files
- `c:\Users\T933261\mcsb_oracle\stored_procedures\sp_BuildCodeSet_Hierarchical.sql` - New file
- `c:\Users\T933261\mcsb_oracle\stored_procedures\sp_GetConceptHierarchy.sql` - New file
- `c:\Users\T933261\mcsb_oracle\stored_procedures\sp_SearchConcepts.sql` - New file
- `c:\Users\T933261\mcsb_oracle\api\codeset.ts` - Refactor lines 204-337
- `c:\Users\T933261\mcsb_oracle\api\hierarchy.ts` - Refactor lines 49-154
- `c:\Users\T933261\mcsb_oracle\api\search.ts` - Refactor lines 87-196
- `c:\Users\T933261\mcsb_oracle\.env` - Add `USE_STORED_PROCEDURES` flag

### Verification Steps
1. Run stored procedure creation scripts in Azure SQL
2. Test each stored procedure directly with sample data
3. Benchmark performance:
   - Hierarchical: Test with 100 concepts, measure time
   - Hierarchy: Test with 10 different concepts, measure roundtrips
   - Search: Test with 20 search terms, measure response time
4. Start dev server with `USE_STORED_PROCEDURES=false` - should use dynamic queries
5. Test all code set builder types (hierarchical/direct/labtest)
6. Enable `USE_STORED_PROCEDURES=true`
7. Test all code set builder types again - should be faster
8. Verify identical results between dynamic and stored procedure paths
9. Monitor error logs for SQL errors

---

## Phase 3: Multi-Tenancy Architecture

### Objective
Enable multiple companies to use the application with organization-based user segregation, while maintaining personal workspaces.

### Database Schema Changes

**1. Create `organizations` table**
```sql
CREATE TABLE organizations (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(255) NOT NULL,
    slug NVARCHAR(100) NOT NULL UNIQUE,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    is_active BIT DEFAULT 1
);

CREATE INDEX idx_organizations_slug ON organizations(slug);
```

**2. Create `organization_members` table**
```sql
CREATE TABLE organization_members (
    id INT IDENTITY(1,1) PRIMARY KEY,
    organization_id UNIQUEIDENTIFIER NOT NULL,
    user_id UNIQUEIDENTIFIER NOT NULL,
    role NVARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    joined_at DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE,
    UNIQUE(organization_id, user_id)
);

CREATE INDEX idx_org_members_org ON organization_members(organization_id);
CREATE INDEX idx_org_members_user ON organization_members(user_id);
```

**3. Add `owner_type` to `saved_code_sets`**
```sql
ALTER TABLE saved_code_sets
ADD owner_type NVARCHAR(20) NOT NULL DEFAULT 'personal' CHECK (owner_type IN ('personal', 'organization'));

ALTER TABLE saved_code_sets
ADD organization_id UNIQUEIDENTIFIER NULL;

ALTER TABLE saved_code_sets
ADD CONSTRAINT FK_saved_code_sets_organization
FOREIGN KEY (organization_id) REFERENCES organizations(id);

CREATE INDEX idx_saved_code_sets_org ON saved_code_sets(organization_id) WHERE organization_id IS NOT NULL;
```

**4. Add multi-tenant constraints**
```sql
-- Ensure personal code sets have no organization_id
ALTER TABLE saved_code_sets
ADD CONSTRAINT CK_personal_no_org
CHECK (owner_type = 'personal' AND organization_id IS NULL OR owner_type = 'organization' AND organization_id IS NOT NULL);
```

### Backend API Changes

**1. Create `api/organizations.ts`** - Organization management:
```typescript
// GET /api/organizations - List user's organizations
// POST /api/organizations - Create new organization (owner role)
// GET /api/organizations/:slug - Get organization details
// PUT /api/organizations/:slug - Update organization (owner/admin only)
// DELETE /api/organizations/:slug - Delete organization (owner only)

// GET /api/organizations/:slug/members - List members
// POST /api/organizations/:slug/members - Invite user (owner/admin only)
// PUT /api/organizations/:slug/members/:userId - Update member role
// DELETE /api/organizations/:slug/members/:userId - Remove member
```

**2. Update `api/codeset.ts`** - Multi-tenant code set access:
```typescript
// GET /api/code-sets?context=personal|organization&orgSlug=acme-corp
// POST /api/code-sets { ownerType: 'personal' | 'organization', organizationId?: string }
// Add authorization checks: user must be member of org to access org code sets
```

**3. Create middleware `api/middleware/organizationAuth.ts`**:
```typescript
// Verify user membership in organization
// Check user role for permission (owner > admin > member > viewer)
// Attach organization context to request
```

### Frontend UI Changes

**1. Create `src/components/OrganizationSwitcher.tsx`**
- Dropdown to switch between "Personal" and organization workspaces
- Show user's organizations with role badges
- "Create Organization" button

**2. Create `src/components/OrganizationSettings.tsx`**
- Organization profile (name, slug)
- Member management table
- Invite user form
- Role management (owner/admin only)

**3. Update `src/components/SavedCodeSets.tsx`**
- Add organization context filter
- Show owner type badge (Personal/Org name)
- Filter code sets by current workspace context

**4. Update navigation** (`src/App.tsx`)
- Add organization routes: `/orgs/:slug`, `/orgs/:slug/settings`
- Context-aware breadcrumbs showing current workspace

### Role Hierarchy & Permissions

| Role | Create Org | Manage Members | Edit Code Sets | View Code Sets | Delete Org |
|------|-----------|----------------|----------------|----------------|------------|
| Owner | ✓ | ✓ | ✓ | ✓ | ✓ |
| Admin | ✗ | ✓ | ✓ | ✓ | ✗ |
| Member | ✗ | ✗ | ✓ | ✓ | ✗ |
| Viewer | ✗ | ✗ | ✗ | ✓ | ✗ |

### Migration Strategy

**Phase 3A: Schema & Backend**
1. Add organizations and organization_members tables
2. Update saved_code_sets schema (non-breaking: all existing code sets default to personal)
3. Implement organization APIs
4. Add authorization middleware

**Phase 3B: Frontend Workspaces**
1. Add organization switcher to navigation
2. Update code set UI to show workspace context
3. Default all users to "Personal" workspace initially
4. Test creating organizations and switching contexts

**Phase 3C: Member Management**
1. Build organization settings UI
2. Implement invite/role management
3. Test permission enforcement

### Critical Files
- `c:\Users\T933261\mcsb_oracle\azure_sql_schema.sql` - Schema modifications
- `c:\Users\T933261\mcsb_oracle\api\organizations.ts` - New file
- `c:\Users\T933261\mcsb_oracle\api\middleware\organizationAuth.ts` - New file
- `c:\Users\T933261\mcsb_oracle\api\codeset.ts` - Add multi-tenant authorization
- `c:\Users\T933261\mcsb_oracle\src\components\OrganizationSwitcher.tsx` - New file
- `c:\Users\T933261\mcsb_oracle\src\components\OrganizationSettings.tsx` - New file
- `c:\Users\T933261\mcsb_oracle\src\components\SavedCodeSets.tsx` - Add workspace filter
- `c:\Users\T933261\mcsb_oracle\src\App.tsx` - Add organization routes

### Verification Steps
1. Run schema migration scripts against Azure SQL
2. Verify all existing code sets have `owner_type='personal'` and `organization_id=NULL`
3. Start dev server: `npm run dev:all`
4. Login and verify default workspace is "Personal"
5. Create new organization "Test Org" with slug "test-org"
6. Verify user is automatically added as owner role
7. Switch workspace context to "Test Org"
8. Create code set in organization context - verify `owner_type='organization'` in database
9. Switch back to "Personal" - organization code set should not appear
10. Invite second user to "Test Org" as member
11. Login as second user - should see "Test Org" in workspace switcher
12. Test permission enforcement: member cannot delete organization
13. Test data isolation: User A in Org1 cannot see Org2 code sets

---

## Recommended Implementation Order

### Priority Ranking
1. **Phase 2 (Stored Procedures)** - HIGHEST PRIORITY
   - Addresses critical performance issue (15-second hierarchical code set build)
   - Low risk with dual-path implementation and feature flag rollback
   - Immediate user experience improvement

2. **Phase 1 (Administrator)** - MEDIUM PRIORITY
   - Foundation for user management as application grows
   - Required before Phase 3 (organizations need admin approval workflow)
   - Relatively straightforward implementation

3. **Phase 3 (Multi-Tenancy)** - FUTURE CONSIDERATION
   - Needed only when serving multiple companies
   - Most complex architecture change
   - Should be implemented before onboarding second company

### Suggested Sequence
1. Start with **Phase 2A** (Create stored procedures) - Immediate performance win
2. Then **Phase 1** (Admin functionality) - Establish governance
3. Finally **Phase 3** (Multi-tenancy) - When needed for growth

---

## Risk Assessment

### Phase 1 Risks
- **Low Risk**: Additive changes only, no breaking changes
- **Mitigation**: Test admin actions thoroughly, implement audit logging from day 1

### Phase 2 Risks
- **Medium Risk**: SQL logic errors could corrupt data or return incorrect results
- **Mitigation**: Dual-path implementation with feature flag, extensive testing, gradual rollout

### Phase 3 Risks
- **High Risk**: Data isolation bugs could expose one company's data to another
- **Mitigation**: Comprehensive authorization testing, start with personal workspaces, add organizations incrementally

---

## Success Metrics

### Phase 1
- Admin can approve/suspend users via UI
- All admin actions logged to audit table
- Regular users cannot access admin endpoints

### Phase 2
- Hierarchical code set build time: 15s → <2s (85% improvement)
- Search response time: <500ms (current baseline unknown)
- Zero data discrepancies between old and new implementation

### Phase 3
- Users can create organizations and invite members
- 100% data isolation: no cross-organization data leakage
- Performance: organization context queries <100ms overhead vs personal
