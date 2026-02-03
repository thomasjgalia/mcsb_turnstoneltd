# Lab Test Stored Procedures - Deployment Guide

## Overview
This guide documents the creation and deployment of stored procedures for the lab test search endpoints.

## Created Stored Procedures

### 1. sp_LabTestSearch
- **File**: `stored_procedures/sp_LabTestSearch.sql`
- **Purpose**: Search for lab tests in the Measurement domain
- **Parameters**:
  - `@SearchTerm` (NVARCHAR(255)) - Search term to match against concept ID, code, or name
- **Returns**: Lab test search results with property, scale, system, time, and panel count
- **Replaces**: Inline SQL in `api/labtest-search.ts` lines 53-155

### 2. sp_LabTestPanelSearch
- **File**: `stored_procedures/sp_LabTestPanelSearch.sql`
- **Purpose**: Find LOINC Panels that contain selected lab tests
- **Parameters**:
  - `@LabTestIds` (NVARCHAR(MAX)) - Comma-separated list of lab test concept IDs
- **Returns**: Lab tests and their containing panels
- **Replaces**: Inline SQL in `api/labtest-panel-search.ts` lines 56-111

## Deployment Steps

### 1. Deploy Stored Procedures to Azure SQL
Run these SQL scripts on your Azure SQL database (in order):

```bash
# Connect to your Azure SQL database and run:
1. stored_procedures/sp_LabTestSearch.sql
2. stored_procedures/sp_LabTestPanelSearch.sql
```

### 2. Verify Deployment
```sql
-- Check that stored procedures exist
SELECT name, type_desc, create_date, modify_date
FROM sys.objects
WHERE type = 'P' AND name IN ('sp_LabTestSearch', 'sp_LabTestPanelSearch')
ORDER BY name;
```

### 3. Update TypeScript API Files
After deploying the stored procedures, update these API endpoints to use them:

#### A. Update `api/labtest-search.ts`
- Add dual-path implementation (like `api/search.ts`)
- Call `executeStoredProcedure('dbo.sp_LabTestSearch', { SearchTerm: searchValue })`
- Keep fallback to inline SQL for safety

#### B. Update `api/labtest-panel-search.ts`
- Add dual-path implementation (like `api/search.ts`)
- Call `executeStoredProcedure('dbo.sp_LabTestPanelSearch', { LabTestIds: labTestIds })`
- Keep fallback to inline SQL for safety

## Benefits

### Performance Improvements
1. **Query Plan Caching**: SQL Server caches execution plans for stored procedures
2. **Reduced Compilation**: No need to parse and compile SQL on every request
3. **Reduced Network Traffic**: Only procedure name and parameters sent, not full SQL
4. **Consistency**: All three main search endpoints now use stored procedures

### Maintenance Benefits
1. **Centralized Logic**: Query logic lives in one place (database)
2. **Easier Optimization**: DBAs can optimize without code deployment
3. **Version Control**: SQL changes tracked in git

## Testing Checklist

After deployment:
- [ ] Run lab test search with various search terms
- [ ] Verify panel search works with multiple lab test IDs
- [ ] Check that results match previous inline SQL behavior
- [ ] Monitor performance (should be faster or equal)
- [ ] Test fallback behavior if stored proc fails

## Environment Variable

Set `USE_STORED_PROCEDURES=true` in your environment to enable stored procedure execution.

## Related Files
- `api/labtest-search.ts` - Needs conversion
- `api/labtest-panel-search.ts` - Needs conversion
- `api/search.ts` - Example of dual-path implementation
- `api/hierarchy.ts` - Example of dual-path implementation
- `api/codeset.ts` - Example of dual-path implementation
