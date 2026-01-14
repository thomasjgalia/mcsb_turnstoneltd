# Oracle Database Setup Guide

This guide will help you set up your Oracle Cloud Autonomous Database with OMOP vocabulary data for the Medical Code Set Builder application.

## Prerequisites

- Oracle Cloud Autonomous Database (19c) - Always Free tier
- SQL Developer or SQLcl installed locally
- Oracle Wallet downloaded from your Autonomous Database
- OMOP vocabulary CSV files in `C:\OMOP_VOCAB\`:
  - `CONCEPT.csv` (1.08 GB)
  - `CONCEPT_ANCESTOR.csv` (1.99 GB)
  - `CONCEPT_RELATIONSHIP.csv` (2.24 GB)

## Setup Steps

### Step 1: Create Tables

Run the table creation script to set up the OMOP vocabulary tables:

```sql
-- File: 01_create_tables.sql
-- Run this in SQL Developer or SQLcl
@01_create_tables.sql
```

**What it does:**
- Creates `CONCEPT`, `CONCEPT_RELATIONSHIP`, and `CONCEPT_ANCESTOR` tables
- Defines primary keys and constraints
- Sets up table statistics preferences

**Expected time:** < 1 minute

---

### Step 2: Load Data

Load your pipe-delimited CSV files into the Oracle tables.

**RECOMMENDED METHOD: SQL Developer Import Wizard**

1. Open Oracle SQL Developer
2. Connect to your Autonomous Database using the wallet
3. Navigate to Tables → CONCEPT (right-click)
4. Select **Import Data**
5. Browse to `C:\OMOP_VOCAB\CONCEPT.csv`
6. Configure import settings:
   - **Delimiter:** Pipe (`|`)
   - **Header:** Check if first row contains column names
   - **Format:** CSV
7. Map columns (should auto-detect)
8. Click **Finish** and wait for completion
9. Repeat for `CONCEPT_RELATIONSHIP.csv` and `CONCEPT_ANCESTOR.csv`

**Expected time:** 10-30 minutes per file (depending on connection speed)

**ALTERNATIVE: Oracle Cloud Object Storage + DBMS_CLOUD**

If the SQL Developer method is too slow, see instructions in `02_load_data.sql` for using Object Storage with `DBMS_CLOUD.COPY_DATA`.

---

### Step 3: Create Indexes

After ALL data is loaded, create indexes for query performance:

```sql
-- File: 03_create_indexes.sql
-- Run this AFTER Step 2 is complete
@03_create_indexes.sql
```

**What it does:**
- Creates indexes on frequently queried columns
- Creates function-based indexes for case-insensitive searches
- Gathers statistics for query optimizer

**Expected time:** 10-20 minutes

---

### Step 4: Test Data Loading

Verify everything works correctly:

```sql
-- File: 04_test_queries.sql
-- Run this to validate your setup
@04_test_queries.sql
```

**What it does:**
- Checks row counts (should be millions of rows)
- Tests Step 1, 2, and 3 queries
- Validates indexes are created
- Verifies key vocabularies are present

**Expected results:**
- CONCEPT: ~7-8 million rows
- CONCEPT_RELATIONSHIP: ~30-40 million rows
- CONCEPT_ANCESTOR: ~60-70 million rows
- Search queries return results
- Hierarchy queries work
- Code set build queries succeed

---

## SQL Query Conversions

Your original PostgreSQL queries have been converted to Oracle syntax:

| Original (PostgreSQL) | Oracle Version | Notes |
|---|---|---|
| `Step_1.sql` | `Step_1_Oracle.sql` | Search query with bind variables |
| `Step_2.sql` | `Step_2_Oracle.sql` | Hierarchy exploration |
| `Step-3.sql` | `Step_3_Oracle.sql` | Code set builder |

**Key differences:**
- PostgreSQL `::text` → Oracle `TO_CHAR()`
- PostgreSQL `ILIKE` → Oracle `UPPER() + LIKE`
- PostgreSQL `unnest(ARRAY[])` → Oracle `UNION ALL` approach
- PostgreSQL `LIMIT` → Oracle `FETCH FIRST N ROWS ONLY`

---

## Troubleshooting

### Problem: "Table or view does not exist"
**Solution:** Ensure you ran `01_create_tables.sql` first

### Problem: "No data found" in test queries
**Solution:** Check that Step 2 (data loading) completed successfully. Run:
```sql
SELECT COUNT(*) FROM CONCEPT;
```
Should return millions of rows.

### Problem: Queries are very slow
**Solution:**
1. Ensure indexes are created: `@03_create_indexes.sql`
2. Gather statistics:
```sql
EXEC DBMS_STATS.GATHER_SCHEMA_STATS(USER);
```

### Problem: CSV import fails with "Invalid format"
**Solution:**
- Verify files are pipe-delimited (`|`)
- Check for special characters in data
- Try importing a sample (first 1000 rows) to test format

### Problem: "ORA-01658: unable to create INITIAL extent"
**Solution:** Your tablespace is full. For Always Free tier, you have 20 GB. You may need to:
- Drop unnecessary tables
- Use compression: `ALTER TABLE CONCEPT COMPRESS;`

---

## Next Steps

Once your Oracle database setup is complete and test queries pass:

1. ✅ Tables created
2. ✅ Data loaded
3. ✅ Indexes created
4. ✅ Test queries pass

**You're ready to proceed with application development!**

Next steps:
- Set up Node.js backend with `oracledb` package
- Configure Oracle Wallet for secure connections
- Build React frontend
- Create API endpoints using the Oracle SQL queries
- Set up Supabase for user authentication

See the main project README for application setup instructions.

---

## Storage Usage

After loading all data and indexes:

| Component | Approximate Size |
|---|---|
| CONCEPT table | 1.5-2 GB |
| CONCEPT_RELATIONSHIP table | 3-4 GB |
| CONCEPT_ANCESTOR table | 4-5 GB |
| Indexes | 3-5 GB |
| **Total** | **~12-16 GB** |

This fits comfortably in the Oracle Always Free tier (20 GB limit).

---

## Maintenance

### Periodic Statistics Refresh
Run monthly to keep queries optimized:
```sql
EXEC DBMS_STATS.GATHER_SCHEMA_STATS(USER, ESTIMATE_PERCENT => DBMS_STATS.AUTO_SAMPLE_SIZE);
```

### Index Rebuild (if needed)
If queries become slow over time:
```sql
ALTER INDEX IDX_CONCEPT_NAME REBUILD ONLINE;
```

### Backup
Oracle Autonomous Database automatically backs up your data. Manual backup:
```sql
-- Export to Data Pump (requires Object Storage)
-- Contact Oracle support for Always Free tier backup options
```
