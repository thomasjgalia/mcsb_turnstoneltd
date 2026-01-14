# Query v2 Updates - Summary

This document summarizes the updates made to use the improved Snowflake SQL queries converted to Oracle syntax.

## Updated Files

### 1. SQL Query Files (Oracle Conversions)
- **SQL_Files/Step_1_Oracle_v2.sql** - Enhanced term search
  - Inline vocabulary filtering using `CASE` with `sys.odcivarchar2list`
  - Replaces Snowflake's `ARRAY_CONSTRUCT` + `FLATTEN` pattern
  - Better performance by eliminating CTE for vocabulary lookup

- **SQL_Files/Step_2_Oracle_v2.sql** - Expanded hierarchy exploration
  - Includes all ATC hierarchy levels (1st-5th) for drug parents
  - Previously only included ATC 4th and 5th
  - Better domain-specific filtering for all medical domains

- **SQL_Files/Step_3_Oracle_v2.sql** - Enhanced code set builder
  - Detailed dose form group (DFG) labeling with 12+ categories:
    - Injectable Product
    - Oral
    - Buccal/Sublingual Product
    - Inhalant Product
    - Nasal Product
    - Ophthalmic Product
    - Topical Product
    - Transdermal/Patch Product
    - Suppository Product
    - Drug Implant Product
    - Irrigation, Intravesical, Intratracheal, Intraperitoneal Products
    - Other
  - Combination drug logic based on ingredient count (SINGLE vs COMBINATION)
  - Refined drug class filtering

### 2. API Endpoints
- **api/search.ts** - Updated to use Step_1_Oracle_v2.sql
  - Removed `buildVocabularySQL` helper dependency
  - Inline vocabulary filtering for better performance

- **api/hierarchy.ts** - Updated to use Step_2_Oracle_v2.sql
  - Expanded ATC hierarchy levels
  - Added bind parameters `:concept_id` and `:domain_id`

- **api/codeset.ts** - Updated to use Step_3_Oracle_v2.sql
  - Enhanced dose form group (DFG) labeling
  - Combination drug detection logic
  - Added bind parameters `:concept_id`, `:domain_id`, and `:combo`

### 3. Frontend Components
- **src/components/Step3CodeSet.tsx** - Enhanced to display new fields
  - Added `dfg_name` column (Dose Form Group Category)
  - Already had `combinationyesno` and `dose_form` columns
  - New column displayed as blue badge for easy identification

### 4. Styling
- **src/index.css** - Added new badge style
  - Added `.badge-info` class for DFG category display (blue badge)

### 5. TypeScript Types
- **src/lib/types.ts** - Already had all necessary types
  - `CodeSetResult` interface already included:
    - `combinationyesno?: string` (Drug domain only)
    - `dose_form?: string` (Drug domain only)
    - `dfg_name?: string` (Drug domain only)

## Key Oracle Syntax Conversions

### Snowflake → Oracle
1. **Arrays and Flatten**
   ```sql
   -- Snowflake
   ARRAY_CONSTRUCT('ICD10CM','SNOMED','ICD9CM')
   FROM TABLE(FLATTEN(input => ...))

   -- Oracle
   sys.odcivarchar2list('ICD10CM','SNOMED','ICD9CM')
   FROM TABLE(CAST(... AS sys.odcivarchar2list))
   ```

2. **Case-Insensitive Matching**
   ```sql
   -- Snowflake
   WHERE name ILIKE '%term%'

   -- Oracle
   WHERE UPPER(name) LIKE '%' || UPPER(:term) || '%'
   ```

3. **String Functions**
   ```sql
   -- Snowflake
   LEN(string)

   -- Oracle
   LENGTH(string)
   ```

4. **Variables**
   ```sql
   -- Snowflake
   SET searchterm = 'ritonavir';
   $searchterm

   -- Oracle (API bind variables)
   :searchterm
   ```

5. **Limit Clause**
   ```sql
   -- Snowflake
   LIMIT 75

   -- Oracle
   FETCH FIRST 75 ROWS ONLY
   ```

## New Features in v2

### 1. Expanded Drug Hierarchy (Step 2)
- **Before**: Only ATC 4th and 5th levels
- **After**: All ATC levels (1st through 5th)
- **Benefit**: Better visibility into high-level drug classification hierarchy

### 2. Dose Form Grouping (Step 3)
- **New Field**: `dfg_name` - Categorizes dose forms into clinically meaningful groups
- **Categories**: 12+ standardized categories (Injectable, Oral, Topical, etc.)
- **Benefit**: Easier filtering and analysis by route of administration

### 3. Combination Drug Detection (Step 3)
- **New Logic**: Counts ingredients to determine SINGLE vs COMBINATION
- **Automatic**: Detects "Multiple Ingredients" class concepts
- **Filter**: User can filter results by ALL/SINGLE/COMBINATION in UI

### 4. Inline Vocabulary Filtering (Step 1 & 2)
- **Before**: Used separate CTE with helper function
- **After**: Inline CASE statement with sys.odcivarchar2list
- **Benefit**: Better query optimization by Oracle's query planner

## Testing Checklist

Once Oracle data is loaded, test the following:

### Step 1 - Search
- [ ] Search for "ritonavir" in Drug domain
- [ ] Verify results include standard concepts from RxNorm, NDC, etc.
- [ ] Verify case-insensitive search works

### Step 2 - Hierarchy
- [ ] Select a drug concept from Step 1
- [ ] Verify ancestors include ATC 1st-5th levels
- [ ] Verify descendants show clinical drugs and ingredients

### Step 3 - Code Set
- [ ] Add multiple concepts to cart
- [ ] Build code set with "All Drugs" filter
- [ ] Verify new columns appear:
  - [ ] Combo column (SINGLE/COMBINATION)
  - [ ] Dose Form column (e.g., "Oral Tablet")
  - [ ] DFG Category column (e.g., "Oral", "Injectable Product")
- [ ] Test SINGLE filter - only single-ingredient drugs
- [ ] Test COMBINATION filter - only multi-ingredient drugs
- [ ] Export as TXT - verify all columns included
- [ ] Copy SQL snippet - verify format

## Next Steps

1. **Complete Oracle Data Load**
   - [ ] Load CONCEPT_ANCESTOR table
   - [ ] Load CONCEPT_RELATIONSHIP table
   - [ ] Run index creation script (03_create_indexes.sql)

2. **Configure Environment**
   - [ ] Set Oracle connection variables in .env
   - [ ] Test API endpoints with Postman/curl

3. **Deploy**
   - [ ] Deploy to Vercel
   - [ ] Test end-to-end workflow

## Rollback Plan

If issues arise, previous v1 queries are still available:
- SQL_Files/Step_1_Oracle.sql
- SQL_Files/Step_2_Oracle.sql
- SQL_Files/Step_3_Oracle.sql

To rollback:
1. Revert api/*.ts files to use v1 queries
2. Remove dfg_name column from Step3CodeSet.tsx
3. Git revert if needed

## Performance Notes

The v2 queries should perform **better** than v1 because:
1. Inline vocabulary filtering eliminates CTEs
2. Oracle can optimize CASE statements better than separate lookups
3. Dose form grouping is done in subquery (computed once, not per row)

Monitor query execution times in production and adjust indexes if needed.
