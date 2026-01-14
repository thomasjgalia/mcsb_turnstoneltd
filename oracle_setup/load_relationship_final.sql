-- ============================================================================
-- Load CONCEPT_RELATIONSHIP Table - FINAL VERSION
-- ============================================================================
-- Skips header row
-- Has VARCHAR2 and DATE columns
-- ============================================================================

BEGIN
    DBMS_CLOUD.COPY_DATA(
        table_name => 'CONCEPT_RELATIONSHIP',
        credential_name => 'OBJ_STORE_CRED',
        file_uri_list => 'https://id5fadvhymxl.objectstorage.us-ashburn-1.oci.customer-oci.com/n/id5fadvhymxl/b/omop_vocab_data/o/CONCEPT_RELATIONSHIP.csv',
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
SELECT COUNT(*) AS relationship_row_count FROM CONCEPT_RELATIONSHIP;

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
SELECT * FROM CONCEPT_RELATIONSHIP WHERE ROWNUM <= 10;

-- Check relationship type distribution
SELECT relationship_id, COUNT(*) AS count
FROM CONCEPT_RELATIONSHIP
GROUP BY relationship_id
ORDER BY COUNT(*) DESC
FETCH FIRST 10 ROWS ONLY;

-- Gather statistics
BEGIN
    DBMS_STATS.GATHER_TABLE_STATS(USER, 'CONCEPT_RELATIONSHIP');
END;
/

SELECT 'CONCEPT_RELATIONSHIP load complete!' AS status FROM DUAL;
