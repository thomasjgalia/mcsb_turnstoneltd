# Phase 2: Stored Procedures - Future Cleanup Plan

## Overview

This document tracks code cleanup opportunities after stored procedures have been validated in production. The current implementation uses a **dual-path approach** with feature flag for safe rollout. Once stable, we can remove the legacy dynamic query fallback code.

## Timeline

**Cleanup After**: 2-4 weeks of stable production use with stored procedures enabled

**Prerequisites**:
- Zero stored procedure failures in production logs
- Performance metrics confirm improvements
- No data discrepancies between paths
- Team confident in rollback strategy

---

## Cleanup Tasks

### 1. Remove Dynamic Query Fallback Code

**Impact**: ~600-900 lines of code reduction across 3 files

#### File: `api/codeset.ts`

**Remove** (lines 86-337 approximately):
- `if (!useStoredProcs || allResults.length === 0)` block
- Entire dynamic query logic for hierarchical builds
- Domain-specific vocabulary building
- Complex 8-join query construction

**Simplify to**:
```typescript
// After cleanup - simple stored procedure call
const tvpRows = concept_ids.map(id => [id]);
const allResults = await executeStoredProcedure<CodeSetResult>(
  'dbo.sp_BuildCodeSet_Hierarchical',
  { ComboFilter: combo_filter },
  { name: 'ConceptIds', typeName: 'dbo.ConceptIdList', rows: tvpRows }
);
```

**Lines saved**: ~250 lines

---

#### File: `api/hierarchy.ts`

**Remove** (lines 86-154 approximately):
- Fallback to dynamic queries
- Domain lookup query
- Complex UNION query for ancestors/descendants
- Vocabulary filtering logic

**Simplify to**:
```typescript
// After cleanup
const results = await executeStoredProcedure<HierarchyResult>(
  'dbo.sp_GetConceptHierarchy',
  { ConceptId: concept_id }
);
```

**Lines saved**: ~80 lines

---

#### File: `api/search.ts`

**Remove** (lines 86-228 approximately):
- Fallback dynamic query logic
- Vocabulary list switch statement
- 3-CTE search query construction
- Complex COALESCE mapping logic

**Simplify to**:
```typescript
// After cleanup
const results = await executeStoredProcedure<SearchResult>(
  'dbo.sp_SearchConcepts',
  { SearchTerm: searchterm.trim(), DomainId: domain_id }
);
```

**Lines saved**: ~150 lines

---

### 2. Remove Unused Helper Functions

#### File: `api/lib/azuresql.ts`

**Remove**:
- `buildVocabularySQL()` function (lines 157-174)
  - Only used by dynamic query path
  - No longer needed after cleanup

**Lines saved**: ~20 lines

---

### 3. Remove Feature Flag

#### File: `.env`

**Remove**:
```env
# Feature Flags
# Set to 'true' to use stored procedures for database queries (default: false)
USE_STORED_PROCEDURES=true
```

#### Files: `api/codeset.ts`, `api/hierarchy.ts`, `api/search.ts`

**Remove**:
```typescript
const useStoredProcs = process.env.USE_STORED_PROCEDURES === 'true';
if (useStoredProcs) { ... }
```

Replace with direct stored procedure calls (no conditional logic).

**Lines saved**: ~30 lines across 3 files

---

### 4. Simplify Import Statements

#### Files: `api/codeset.ts`, `api/hierarchy.ts`, `api/search.ts`

**Remove** from imports:
```typescript
import { executeQuery, buildVocabularySQL } from './lib/azuresql.js';
```

**Keep only**:
```typescript
import { executeStoredProcedure, createErrorResponse } from './lib/azuresql.js';
```

---

## Summary

### Total Code Reduction
- **Estimated lines removed**: 600-900 lines
- **Files affected**: 4 files (3 API endpoints + 1 library)
- **Complexity reduction**: Eliminate dual-path logic, simplify error handling

### Benefits After Cleanup
1. **Maintainability**: Single code path, easier to understand
2. **Performance**: No overhead from conditional checks
3. **Reliability**: Fewer potential code paths = fewer bugs
4. **Readability**: Simpler, more focused code

### Risks
- **Loss of fallback**: Cannot instantly revert to dynamic queries
- **Mitigation**: Keep git history, can revert commit if needed

---

## Verification Steps Before Cleanup

1. **Monitor production for 2-4 weeks**:
   - Check logs for stored procedure errors
   - Verify performance improvements maintained
   - Compare result sets (stored proc vs old logs)

2. **Run final validation**:
   - Test hierarchical builds with 100+ concepts
   - Test search across all domains
   - Test hierarchy view for various concept types

3. **Backup plan**:
   - Tag current commit: `git tag phase2-before-cleanup`
   - Document rollback procedure
   - Keep stored procedure scripts in version control

4. **Cleanup execution**:
   - Create cleanup branch: `git checkout -b phase2-cleanup`
   - Remove code systematically (one file at a time)
   - Test after each file modification
   - Run full test suite before merging

---

## Files for Reference

**Stored Procedures** (keep these):
- `stored_procedures/types/ConceptIdList.sql`
- `stored_procedures/sp_BuildCodeSet_Hierarchical.sql`
- `stored_procedures/sp_GetConceptHierarchy.sql`
- `stored_procedures/sp_SearchConcepts.sql`

**Modified API Files** (cleanup targets):
- `api/codeset.ts` - Remove hierarchical build fallback
- `api/hierarchy.ts` - Remove hierarchy query fallback
- `api/search.ts` - Remove search query fallback
- `api/lib/azuresql.ts` - Remove buildVocabularySQL()

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-01-XX | Keep dual-path | Safe rollout with instant rollback |
| TBD | Execute cleanup | After 2-4 weeks stable production |

---

## Notes

- This cleanup is **optional but recommended** after validation
- The dual-path code is **not harmful**, just adds complexity
- Cleanup improves maintainability, not performance (stored procs already handle that)
- Keep this document updated as decisions are made
