-- ============================================================================
-- Stored Procedure: sp_LabTestPanelSearch
-- ============================================================================
-- Purpose: Find LOINC Panels that contain selected lab tests
-- Performance: Query plan cached by SQL Server for faster compilation
-- Parameters:
--   @LabTestIds - Comma-separated list of lab test concept IDs
-- Returns: Lab tests and their containing panels
-- ============================================================================

-- Drop procedure if it exists
IF EXISTS (SELECT * FROM sys.objects WHERE type = 'P' AND name = 'sp_LabTestPanelSearch')
BEGIN
    DROP PROCEDURE dbo.sp_LabTestPanelSearch;
END
GO

CREATE PROCEDURE dbo.sp_LabTestPanelSearch
    @LabTestIds NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;

    WITH selected_tests AS (
        -- The lab tests selected by the user (from shopping cart)
        SELECT
            CAST(value AS INT) AS std_concept_id,
            CONCEPT_NAME,
            CONCEPT_CODE,
            CONCEPT_CLASS_ID,
            VOCABULARY_ID,
            'Lab Test' AS lab_test_type
        FROM STRING_SPLIT(@LabTestIds, ',')
        INNER JOIN CONCEPT c ON c.CONCEPT_ID = CAST(value AS INT)
    ),
    panels AS (
        -- Find panels that contain the selected lab tests
        SELECT
            'Panel'               AS lab_test_type,
            st.std_concept_id     AS std_concept_id,
            c.CONCEPT_ID          AS panel_concept_id,
            c.CONCEPT_NAME        AS search_result,
            c.CONCEPT_CODE        AS searched_code,
            c.CONCEPT_CLASS_ID    AS searched_concept_class_id,
            c.VOCABULARY_ID       AS vocabulary_id,
            NULL                  AS property,
            NULL                  AS scale,
            NULL                  AS system,
            NULL                  AS time
        FROM selected_tests st
        INNER JOIN CONCEPT_RELATIONSHIP cr
            ON cr.CONCEPT_ID_2 = st.std_concept_id
            AND cr.RELATIONSHIP_ID = 'Contained in panel'
            AND COALESCE(cr.INVALID_REASON, '') = ''
        INNER JOIN CONCEPT c ON c.concept_id = cr.concept_id_1
    )
    -- UNION lab tests with their containing panels (only if panels exist)
    SELECT
        lab_test_type,
        std_concept_id,
        std_concept_id        AS panel_concept_id,
        CONCEPT_NAME          AS search_result,
        CONCEPT_CODE          AS searched_code,
        CONCEPT_CLASS_ID      AS searched_concept_class_id,
        VOCABULARY_ID         AS vocabulary_id,
        NULL                  AS property,
        NULL                  AS scale,
        NULL                  AS system,
        NULL                  AS time
    FROM selected_tests
    WHERE EXISTS (SELECT 1 FROM panels)

    UNION ALL

    SELECT * FROM panels

    ORDER BY std_concept_id ASC, lab_test_type ASC, searched_code ASC;
END;
GO
