-- ============================================================================
-- Load CONCEPT_ANCESTOR Table - NEW UPLOAD
-- ============================================================================
-- Skips header row
-- Has 4 numeric columns only
-- ============================================================================

BEGIN
    DBMS_CLOUD.COPY_DATA(
        table_name => 'CONCEPT_ANCESTOR',
        credential_name => 'OBJ_STORE_CRED',
        file_uri_list => 'https://objectstorage.us-ashburn-1.oraclecloud.com/n/id5fadvhymxl/b/omop_vocab_data/o/CONCEPT_ANCESTOR.csv',
        format => q'[
            {
                "delimiter":"|",
                "skipheaders":"1",
                "blankasnull":"true",
                "trimspaces":"lrtrim",
                "rejectlimit":"unlimited",
                "ignoreblanklines":"true"
            }
        ]'
    );
END;
/

-- Check results
SELECT COUNT(*) AS ancestor_row_count FROM CONCEPT_ANCESTOR;

-- Check load status
SELECT
    status,
    rows_loaded,
    logfile_table
FROM USER_LOAD_OPERATIONS
WHERE type = 'COPY'
ORDER BY start_time DESC
FETCH FIRST 1 ROWS ONLY;

-- Show sample
SELECT * FROM CONCEPT_ANCESTOR WHERE ROWNUM <= 10;

-- Gather statistics
BEGIN
    DBMS_STATS.GATHER_TABLE_STATS(USER, 'CONCEPT_ANCESTOR');
END;
/

SELECT 'CONCEPT_ANCESTOR load complete!' AS status FROM DUAL;
