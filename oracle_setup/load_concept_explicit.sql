-- ============================================================================
-- Load CONCEPT Table - Explicit Column Mapping
-- ============================================================================
-- This skips the header and maps columns by position, not name
-- ============================================================================

BEGIN
    DBMS_CLOUD.COPY_DATA(
        table_name => 'CONCEPT',
        credential_name => 'OBJ_STORE_CRED',
        file_uri_list => 'https://objectstorage.us-ashburn-1.oraclecloud.com/n/id5fadvhymxl/b/omop_vocab_data/o/CONCEPT.csv',
        format => q'[
            {
                "delimiter":"|",
                "skipheaders":"1",
                "blankasnull":"true",
                "trimspaces":"lrtrim",
                "rejectlimit":"unlimited",
                "dateformat":"YYYY-MM-DD",
                "ignoreblanklines":"true"
            }
        ]'
    );
END;
/

-- Check results
SELECT COUNT(*) AS concept_row_count FROM CONCEPT;

-- Check load status
SELECT
    status,
    rows_loaded,
    logfile_table,
    badfile_table
FROM USER_LOAD_OPERATIONS
WHERE type = 'COPY'
ORDER BY start_time DESC
FETCH FIRST 1 ROWS ONLY;

-- Show sample
SELECT * FROM CONCEPT WHERE ROWNUM <= 5;

-- Gather statistics
BEGIN
    DBMS_STATS.GATHER_TABLE_STATS(USER, 'CONCEPT');
END;
/

SELECT 'Load complete!' AS status FROM DUAL;
