-- ============================================================================
-- Stored Procedure: sp_BuildCodeSet_Direct
-- ============================================================================
-- Purpose: Direct code set build - returns concepts without hierarchical expansion
-- Performance: Query plan cached by SQL Server for faster compilation
-- Parameters:
--   @ConceptIds - Table-valued parameter containing concept IDs
-- Returns: Concept details for the provided IDs
-- ============================================================================

-- Drop procedure if it exists
IF EXISTS (SELECT * FROM sys.objects WHERE type = 'P' AND name = 'sp_BuildCodeSet_Direct')
BEGIN
    DROP PROCEDURE dbo.sp_BuildCodeSet_Direct;
END
GO

CREATE PROCEDURE dbo.sp_BuildCodeSet_Direct
    @ConceptIds dbo.ConceptIdList READONLY
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        C.CONCEPT_NAME                      AS root_concept_name,
        C.VOCABULARY_ID                     AS child_vocabulary_id,
        C.CONCEPT_CODE                      AS child_code,
        C.CONCEPT_NAME                      AS child_name,
        C.CONCEPT_ID                        AS child_concept_id,
        C.CONCEPT_CLASS_ID                  AS concept_class_id,
        NULL                                AS combinationyesno,
        NULL                                AS dose_form,
        NULL                                AS dfg_name,
        NULL                                AS concept_attribute,
        NULL                                AS value
    FROM CONCEPT C
    INNER JOIN @ConceptIds cids ON C.CONCEPT_ID = cids.concept_id
    ORDER BY C.VOCABULARY_ID, C.CONCEPT_CODE;
END;
GO
